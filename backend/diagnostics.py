import pandas as pd
import numpy as np

class GovernanceDiagnostics:
    def __init__(self, data):
        self.data = data
        if data is not None and 'month' in data.columns:
            self.latest_data = data[data['month'] == data['month'].max()]
        else:
            self.latest_data = data
        self.national_avg = self.latest_data.mean(numeric_only=True) if self.latest_data is not None else None

    def diagnose_state(self, state_name):
        """Perform deep root-cause diagnosis for a specific state"""
        if self.latest_data is None:
            return {"error": "No data available"}
        
        if state_name == 'National':
            state_data = self.latest_data
        else:
            state_data = self.latest_data[self.latest_data['state'] == state_name]
            
        if state_data.empty:
            return {"error": f"No data for state: {state_name}"}
            
        state_stats = state_data.mean(numeric_only=True)
        
        # Identify the biggest gap
        pillars = {
            'operational_efficiency': 'Operational Efficiency',
            'data_health': 'Data Health',
            'system_stability': 'System Stability'
        }
        
        gaps = []
        for key, label in pillars.items():
            col = f"{key}_score" if f"{key}_score" in state_stats.index else None
            if col:
                # For National, compare against ideal score (100). For States, compare against National Avg.
                if state_name == 'National':
                    gap = 100 - state_stats[col]
                else:
                    gap = self.national_avg[col] - state_stats[col]
                
                gaps.append({
                    'id': key,
                    'label': label,
                    'score': round(state_stats[col], 1),
                    'national_avg': round(self.national_avg[col], 1),
                    'gap': round(gap, 1)
                })
        
        # Sort by biggest gap (worst performing pillar relative to national)
        gaps.sort(key=lambda x: x['gap'], reverse=True)
        primary_issue = gaps[0]
        
        # Root cause mapping
        diagnosis = self._get_root_cause(state_name, primary_issue['id'], state_data)
        
        return {
            'state': state_name,
            'primary_pillar_issue': primary_issue,
            'diagnosis': diagnosis,
            'trends': self._analyze_trends(state_name),
            'all_pillars': gaps,
            'critical_districts': state_data.sort_values('aghi_score').head(3)['district'].tolist()
        }

    def _analyze_trends(self, state_name):
        """Analyze month-over-month trends for the state"""
        state_history = self.data[self.data['state'] == state_name].sort_values('month')
        if len(state_history) < 2:
            return "Stable"
            
        recent_scores = state_history['aghi_score'].tail(3).tolist()
        if len(recent_scores) >= 2:
            change = recent_scores[-1] - recent_scores[-2]
            if change > 2: return "Improving"
            if change < -2: return "Declining"
        return "Stable"

    def _get_root_cause(self, state, pillar_id, state_data):
        """Map pillar failure to specific underlying metrics"""
        if pillar_id == 'operational_efficiency':
            rej_rate = state_data['enrollment_rejected'].mean() / state_data['enrollment_total'].mean() if state_data['enrollment_total'].mean() > 0 else 0
            if rej_rate > 0.15:
                return "Critical enrollment rejection rate detected. Likely cause: Infrastructure or training gaps at enrollment centers."
            return "General operational friction. Suggests resource allocation issues."
            
        elif pillar_id == 'data_health':
            demo_rej = state_data['demo_rejected'].mean() / state_data['demo_updates'].mean() if state_data['demo_updates'].mean() > 0 else 0
            if demo_rej > 0.2:
                return "Significant Demographic Update rejections. Primary cause: Insufficient document verification standards."
            return "Minor data integrity fluctuations. Suggests need for periodic audit."
            
        elif pillar_id == 'system_stability':
            backlog = state_data['pending_ratio'].mean()
            if backlog > 20:
                return "High backlog detected. Primary cause: Processing latency at regional data centers."
            return "System fluctuations. Monitoring required for surge capacity."
            
        return "Unspecified governance anomaly. Manual audit recommended."
