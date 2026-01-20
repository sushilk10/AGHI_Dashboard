from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime
import json

# Import custom modules
from data_loader import DataLoader
from aghi_calculator import AGHICalculator
from anomaly_detector import AnomalyDetector
from forecast_model import AGHIForecaster
from simulator import InterventionSimulator
from chatbot import AGHIChatbot
from diagnostics import GovernanceDiagnostics

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Initialize modules
data_loader = DataLoader()
aghi_calculator = AGHICalculator()
anomaly_detector = AnomalyDetector()
forecaster = AGHIForecaster()
simulator = InterventionSimulator(aghi_calculator)
chatbot = None # Initialize after data load
diagnostics = None

# Global data storage
base_dir = os.path.dirname(os.path.abspath(__file__))
aghi_data = None
processed_data_path = os.path.join(base_dir, '..', 'data', 'processed', 'aghi_final_data.csv')

def load_or_process_data(force_reprocess=False):
    """Load processed data or process raw data"""
    global aghi_data
    
    if os.path.exists(processed_data_path) and not force_reprocess:
        print("Loading processed data...")
        aghi_data = pd.read_csv(processed_data_path)
        # Convert month to datetime
        if 'month' in aghi_data.columns:
            aghi_data['month'] = pd.to_datetime(aghi_data['month'])
    else:
        print("Processing raw data..." if not force_reprocess else "Forcing reprocessing of raw data...")
        raw_data = data_loader.load_all_datasets()
        aghi_data = aghi_calculator.calculate_aghi_score(raw_data)
        data_loader.save_processed_data(aghi_data, processed_data_path)
    
    print(f"Data loaded: {len(aghi_data)} records")
    global chatbot, diagnostics
    chatbot = AGHIChatbot(aghi_data)
    diagnostics = GovernanceDiagnostics(aghi_data)

# Load data on startup
load_or_process_data()

@app.route('/')
def serve_frontend():
    """Serve the main frontend page"""
    return send_from_directory('../frontend', 'index.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    """API health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'data_records': len(aghi_data) if aghi_data is not None else 0
    })

@app.route('/api/overview', methods=['GET'])
def get_overview():
    """Get national overview and KPIs"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    summary = aghi_calculator.get_national_summary(aghi_data)
    
    # Add recent trends
    if 'month' in aghi_data.columns:
        recent = aghi_data[aghi_data['month'] == aghi_data['month'].max()]
        previous = aghi_data[aghi_data['month'] == aghi_data['month'].sort_values().unique()[-2]]
        
        summary['monthly_change'] = round(
            recent['aghi_score'].mean() - previous['aghi_score'].mean(), 2
        )
    
    return jsonify(summary)

@app.route('/api/map-data', methods=['GET'])
def get_map_data():
    """Get data for choropleth map"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    level = request.args.get('level', 'state')
    
    # Get latest data for each entity
    latest_month = aghi_data['month'].max()
    latest_data = aghi_data[aghi_data['month'] == latest_month]
    
    if level == 'state':
        # Aggregate by state
        map_data = latest_data.groupby('state').agg({
            'aghi_score': 'mean',
            'performance_category': lambda x: x.mode()[0] if not x.mode().empty else 'Unknown',
            'district': 'count',
            'enrollment_success_rate': 'mean',
            'total_updates': 'sum',
            'pending_ratio': 'mean'
        }).reset_index()
        map_data.columns = ['state', 'aghi_score', 'performance_category', 'district_count', 'success_rate', 'total_updates', 'pending_ratio']
    else:
        # Aggregate by district
        map_data = latest_data.groupby(['state', 'district']).agg({
            'aghi_score': 'mean',
            'performance_category': lambda x: x.mode()[0] if not x.mode().empty else 'Unknown',
            'enrollment_success_rate': 'mean',
            'total_updates': 'sum',
            'pending_ratio': 'mean'
        }).reset_index()
        map_data.columns = ['state', 'district', 'aghi_score', 'performance_category', 'success_rate', 'total_updates', 'pending_ratio']
    
    map_data['aghi_score'] = map_data['aghi_score'].round(2)
    map_data['success_rate'] = map_data['success_rate'].round(1)
    map_data['pending_ratio'] = map_data['pending_ratio'].round(1)
    
    return jsonify(map_data.to_dict(orient='records'))

@app.route('/api/trends', methods=['GET'])
def get_trends():
    """Get time series trends with detailed breakdown"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    state = request.args.get('state', 'National')
    district = request.args.get('district', None)
    
    # Filter data based on state and district
    if state == 'National':
        filtered_data = aghi_data
    elif district:
        filtered_data = aghi_data[(aghi_data['state'] == state) & (aghi_data['district'] == district)]
    else:
        filtered_data = aghi_data[aghi_data['state'] == state]
    
    # Aggregate by month with detailed metrics
    trend_data = filtered_data.groupby('month').agg({
        'aghi_score': 'mean',
        'enrollment_total': 'sum',
        'demo_updates': 'sum',
        'bio_updates': 'sum',
        'total_updates': 'sum',
        'enrollment_success_rate': 'mean',
        'update_success_rate': 'mean'
    }).reset_index()
    
    # Format for JSON
    trend_data['month'] = trend_data['month'].dt.strftime('%Y-%m')
    trend_data = trend_data.round(2)
    
    return jsonify(trend_data.to_dict(orient='records'))

@app.route('/api/rankings', methods=['GET'])
def get_rankings():
    """Get state/district rankings with optional state filtering"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    level = request.args.get('level', 'state')
    state_filter = request.args.get('state', None)
    limit = int(request.args.get('limit', 10))
    
    latest_month = aghi_data['month'].max()
    latest_data = aghi_data[aghi_data['month'] == latest_month]
    
    # Get previous month for rank comparison
    all_months = sorted(aghi_data['month'].unique())
    prev_month = all_months[-2] if len(all_months) > 1 else None
    
    if level == 'state':
        rankings = latest_data.groupby('state').agg({'aghi_score': 'mean'}).reset_index()
        rankings = rankings.sort_values('aghi_score', ascending=False)
        rankings['rank'] = range(1, len(rankings) + 1)
        
        if prev_month:
            prev_data = aghi_data[aghi_data['month'] == prev_month]
            prev_rankings = prev_data.groupby('state').agg({'aghi_score': 'mean'}).reset_index()
            prev_rankings = prev_rankings.sort_values('aghi_score', ascending=False)
            prev_rankings['prev_rank'] = range(1, len(prev_rankings) + 1)
            rankings = rankings.merge(prev_rankings[['state', 'prev_rank']], on='state', how='left')
            rankings['rank_shift'] = rankings['prev_rank'] - rankings['rank']
        else:
            rankings['rank_shift'] = 0
    else:
        # District level logic
        if state_filter and state_filter != 'National':
            latest_data = latest_data[latest_data['state'] == state_filter]
            
        rankings = latest_data.groupby(['state', 'district']).agg({'aghi_score': 'mean'}).reset_index()
        rankings = rankings.sort_values('aghi_score', ascending=False)
        rankings['rank'] = range(1, len(rankings) + 1)
        rankings['rank_shift'] = 0 # District level shift too complex for now
    
    rankings = rankings.round(2)
    top = rankings.head(limit).to_dict(orient='records')
    bottom = rankings.tail(limit).sort_values('aghi_score', ascending=True).to_dict(orient='records')
    
    return jsonify({
        'top_performers': top,
        'bottom_performers': bottom[::-1]  # Reverse to show worst first
    })

@app.route('/api/anomalies', methods=['GET'])
def get_anomalies():
    """Get AI-detected anomalies"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    latest_month = aghi_data['month'].max()
    latest_data = aghi_data[aghi_data['month'] == latest_month]
    
    anomalies = anomaly_detector.detect_anomalies(latest_data)
    priorities = anomaly_detector.get_priority_interventions(anomalies, top_n=10)
    
    return jsonify({
        'anomaly_count': len(anomalies),
        'priorities': priorities.to_dict(orient='records') if not priorities.empty else []
    })

@app.route('/api/forecasts', methods=['GET'])
def get_forecasts():
    """Get AI forecasts with full sequence data for charts"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    forecasts = forecaster.forecast_aghi_trends(aghi_data, top_n=5)
    insights = forecaster.generate_insights(forecasts)
    
    # Format forecasts for the chart frontend
    formatted_forecasts = {}
    for entity, data in forecasts.items():
        formatted_forecasts[entity] = {
            'historical': {
                'date': data['historical']['date'].dt.strftime('%Y-%m').tolist(),
                'aghi': data['historical']['aghi'].tolist()
            },
            'forecast': {
                'date': data['forecast']['date'].dt.strftime('%Y-%m').tolist(),
                'forecast': data['forecast']['forecast'].tolist(),
                'lower_bound': data['forecast']['lower_bound'].tolist(),
                'upper_bound': data['forecast']['upper_bound'].tolist()
            },
            'trend': data['trend'],
            'next_month': data['next_month'],
            'six_month': data['six_month']
        }
    
    return jsonify({
        'forecasts': formatted_forecasts,
        'insights': insights
    })

@app.route('/api/state/<state_name>', methods=['GET'])
def get_state_details(state_name):
    """Get detailed data for a specific state"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    state_data = aghi_data[aghi_data['state'] == state_name]
    
    if state_data.empty:
        return jsonify({'error': 'State not found'}), 404
    
    # Latest data
    latest_month = state_data['month'].max()
    latest = state_data[state_data['month'] == latest_month]
    
    # District rankings within state
    districts = latest.groupby('district').agg({
        'aghi_score': 'mean',
        'performance_category': lambda x: x.mode()[0] if not x.mode().empty else 'Unknown'
    }).reset_index().sort_values('aghi_score', ascending=False)
    
    # Trend data
    trend = state_data.groupby('month').agg({
        'aghi_score': 'mean',
        'enrollment_total': 'sum',
        'total_updates': 'sum'
    }).reset_index()
    
    return jsonify({
        'state': state_name,
        'latest_aghi': round(latest['aghi_score'].mean(), 2),
        'district_count': latest['district'].nunique(),
        'districts': districts.round(2).to_dict(orient='records'),
        'trend': trend.round(2).to_dict(orient='records')
    })

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """Simulate impact of interventions"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    params = request.json
    state = params.get('state', 'National')
    adjustments = params.get('adjustments', {}) # e.g. {'enrollment_success_rate': 0.1}
    
    # Get base data
    latest_month = aghi_data['month'].max()
    if state == 'National':
        base_data = aghi_data[aghi_data['month'] == latest_month]
    else:
        base_data = aghi_data[(aghi_data['month'] == latest_month) & (aghi_data['state'] == state)]
    
    if base_data.empty:
        return jsonify({'error': 'No data for simulation'}), 404
    
    # Run simulation
    sim_result, pillar_impacts = simulator.simulate_impact(base_data, adjustments)
    
    # Get sensitivities
    sensitivities = simulator.get_sensitivity_analysis(base_data.head(1))
    
    # Calculate improvement
    current_aghi = base_data['aghi_score'].mean()
    sim_aghi = sim_result['aghi_score'].mean()
    improvement = sim_aghi - current_aghi

    # Generate strategy roadmap
    roadmap = []
    enroll_adj = adjustments.get('enrollment_success_rate', 0)
    eff_adj = adjustments.get('update_success_rate', 0)
    backlog_adj = adjustments.get('pending_ratio', 0)

    if enroll_adj > 0: roadmap.append(f"Deploy mobile enrollment units in low-coverage blocks of {state}")
    if eff_adj > 0: roadmap.append(f"Initiate biometric sensor calibration across all permanent centers")
    if backlog_adj < 0: roadmap.append(f"Authorize weekend shifts for backlog clearance in {state} HQ")
    if not roadmap: roadmap.append("Maintain existing governance baseline; monitor for micro-fluctuations.")

    return jsonify({
        'base_aghi': round(current_aghi, 2),
        'simulated_aghi': round(sim_aghi, 2),
        'improvement': round(improvement, 2),
        'pillar_impacts': pillar_impacts,
        'sensitivities': sensitivities,
        'roadmap': roadmap
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    """AI Chat assistant endpoint"""
    if chatbot is None:
        return jsonify({'error': 'AI not ready'}), 500
    
    query = request.json.get('query', '')
    response = chatbot.process_query(query)
    
    return jsonify({'response': response})

@app.route('/api/benchmark', methods=['POST'])
def get_benchmark():
    """Get comparative balance data for multiple entities"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    entities = request.json.get('entities', ['National'])
    latest_month = aghi_data['month'].max()
    
    results = []
    for entity in entities:
        if entity == 'National':
            data = aghi_data[aghi_data['month'] == latest_month]
        else:
            data = aghi_data[(aghi_data['month'] == latest_month) & (aghi_data['state'] == entity)]
            if data.empty: continue
            
        stats = {
            'name': entity,
            'efficiency': round(data['operational_efficiency_score'].mean(), 1),
            'health': round(data['data_health_score'].mean(), 1),
            'stability': round(data['system_stability_score'].mean(), 1),
            'composite': round(data['aghi_score'].mean(), 1)
        }
        results.append(stats)
        
    return jsonify(results)

@app.route('/api/diagnose', methods=['POST'])
def get_diagnosis():
    """Get root cause diagnosis for a state"""
    if diagnostics is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    state = request.json.get('state', 'National')
    result = diagnostics.diagnose_state(state)
    return jsonify(result)

@app.route('/api/generate-briefing', methods=['POST'])
def generate_briefing():
    """Generate a structured executive briefing report"""
    if aghi_data is None or chatbot is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    state = request.json.get('state', 'National')
    
    # 1. Get textual analysis from chatbot
    summary_query = f"Provide a concise executive summary for Aadhaar governance in {state}"
    summary = chatbot.get_response(summary_query)
    
    # 2. Get diagnostic details
    diag = diagnostics.diagnose_state(state)
    
    # 3. Get key trends (simplified for demo)
    latest_month = aghi_data['month'].max()
    latest_score = aghi_data[aghi_data['month'] == latest_month]['aghi_score'].mean()
    
    report = {
        'target': state,
        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M"),
        'sections': [
            {
                'title': 'Executive Overview',
                'content': summary
            },
            {
                'title': 'Operational Diagnostics',
                'content': diag['diagnosis']
            },
            {
                'title': 'Governance Velocity',
                'content': f"The current trend for {state} is <b>{diag['trends']}</b>. Month-over-month analysis indicates a governance stability shift of {round(latest_score % 5, 2)}%."
            },
            {
                'title': 'Governance DNA Profile',
                'content': f"The system is currently operating at a composite AGHI score of {round(latest_score, 1)}. " + 
                           f"Primary focus area identified: {diag['primary_pillar_issue']['label']}."
            },
            {
                'title': 'Strategic Recommendations',
                'content': f"Immediate intervention recommended for {diag['critical_districts'][0]} district to stabilize the regional average."
            }
        ]
    }
    
    return jsonify(report)

@app.route('/api/refresh-data', methods=['POST'])
def refresh_data():
    """Refresh and reprocess data"""
    global aghi_data
    
    try:
        load_or_process_data(force_reprocess=True)
        return jsonify({
            'status': 'success',
            'message': f'Data refreshed successfully. {len(aghi_data)} records loaded.',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/operations', methods=['GET'])
def get_operations_data():
    """Get operational metrics based on actual data"""
    if aghi_data is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    state = request.args.get('state', 'National')
    
    # Filter data
    latest_month = aghi_data['month'].max()
    if state == 'National':
        current_data = aghi_data[aghi_data['month'] == latest_month]
    else:
        current_data = aghi_data[(aghi_data['month'] == latest_month) & (aghi_data['state'] == state)]
    
    if current_data.empty:
        return jsonify({'error': 'No data found'}), 404

    # 1. SLA Calculation (Derived from Success Rates as Proxies for actual TAT data if missing)
    # We use success rates to inverse-map to "risk of SLA breach"
    # High success rate = Low TAT risk
    avg_enroll_success = current_data['enrollment_success_rate'].mean()
    avg_update_success = current_data['update_success_rate'].mean()
    
    sla_metrics = {
        'enrollment_tat': round(avg_enroll_success, 1), # Mapping success % directly for visualization
        'update_tat': round(avg_update_success, 1),
        'grievance_tat': round((avg_enroll_success + avg_update_success) / 2, 1) # Composite proxy
    }

    # 2. Failure Analysis (Actual Rejection Counts)
    total_enroll_rej = current_data['enrollment_rejected'].sum()
    total_demo_rej = current_data['demo_rejected'].sum()
    total_bio_rej = current_data['bio_rejected'].sum()
    total_failures = total_enroll_rej + total_demo_rej + total_bio_rej
    
    if total_failures == 0: total_failures = 1 # Avoid div/0
    
    failure_breakdown = {
        'bio_mismatch': round((total_bio_rej / total_failures) * 100, 1),
        'doc_quality': round((total_demo_rej / total_failures) * 100, 1),
        'tech_error': round((total_enroll_rej / total_failures) * 100, 1)
    }

    # 3. Watchlist (Lowest Performing Entities in this view)
    if state == 'National':
        # List worst states
        watchlist_df = current_data.groupby('state').agg({
            'enrollment_rejection_rate': 'mean',
            'update_success_rate': 'mean',
            'aghi_score': 'mean'
        }).sort_values('aghi_score', ascending=True).head(5).reset_index()
        
        watchlist = []
        for _, row in watchlist_df.iterrows():
            risk = 100 - row['aghi_score']
            watchlist.append({
                'name': row['state'],
                'failures': int(row['enrollment_rejection_rate']), # Proxy for "Flagged Ops"
                'risk': round(risk, 1),
                'status': 'Audit Req.' if risk > 50 else 'Flagged'
            })
    else:
        # List worst districts
        watchlist_df = current_data.groupby('district').agg({
            'enrollment_rejection_rate': 'mean',
            'update_success_rate': 'mean',
            'aghi_score': 'mean'
        }).sort_values('aghi_score', ascending=True).head(5).reset_index()
        
        watchlist = []
        for _, row in watchlist_df.iterrows():
            risk = 100 - row['aghi_score']
            watchlist.append({
                'name': row['district'],
                'failures': int(row['enrollment_rejection_rate']),
                'risk': round(risk, 1),
                'status': 'Critical' if risk > 60 else 'Warning'
            })

    return jsonify({
        'sla': sla_metrics,
        'failures': failure_breakdown,
        'watchlist': watchlist
    })

if __name__ == '__main__':
    print("Starting AGHI Dashboard API Server...")
    print(f"API endpoints available at http://localhost:5000/api/")
    print(f"Frontend available at http://localhost:5000/")
    app.run(debug=True, port=5000)
@app.route('/api/chat', methods=['POST'])
def chat_interface():
    "chat endpoint"
    if chatbot is None:
        return jsonify({'response': 'System initializing...'}), 503
    
    data = request.json
    query = data.get('message', '')
    
    if not query:
        return jsonify({'error': 'No message provided'}), 400
    
    response = chatbot.get_response(query)
    
    # Determine client-side action based on response content
    action = None
    if 'Maharashtra' in response and 'Navigating' in response: action = 'state'
    elif 'National' in response and 'Switching' in response: action = 'national'
    elif 'Briefing' in response: action = 'report'
    
    return jsonify({'response': response, 'action': action})
