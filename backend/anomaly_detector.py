import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

class AnomalyDetector:
    def __init__(self, contamination=0.1):
        self.contamination = contamination
        self.model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42,
            n_jobs=-1
        )
        self.scaler = StandardScaler()
        
    def detect_anomalies(self, df):
        """Detect anomalous districts/states"""
        # Prepare features for anomaly detection
        features = self._prepare_features(df)
        
        if len(features) < 10:
            return pd.DataFrame()  # Not enough data
        
        # Scale features
        scaled_features = self.scaler.fit_transform(features)
        
        # Fit model and predict
        df['anomaly_score'] = self.model.fit_predict(scaled_features)
        df['anomaly_confidence'] = self.model.decision_function(scaled_features)
        
        # Identify anomalies (outliers)
        anomalies = df[df['anomaly_score'] == -1].copy()
        
        if not anomalies.empty:
            # Rank anomalies by confidence (more negative = more anomalous)
            anomalies = anomalies.sort_values('anomaly_confidence')
            
            # Categorize anomalies
            anomalies['anomaly_type'] = anomalies.apply(self._categorize_anomaly, axis=1)
            
            # Generate alert messages
            anomalies['alert_message'] = anomalies.apply(self._generate_alert, axis=1)
        
        return anomalies
    
    def _prepare_features(self, df):
        """Select and prepare features for anomaly detection"""
        feature_cols = []
        
        # Select relevant columns if they exist
        possible_features = [
            'aghi_score', 'enrollment_success_rate', 'update_success_rate',
            'pending_ratio', 'total_updates', 'enrollment_rejected',
            'demo_rejected', 'bio_rejected'
        ]
        
        for col in possible_features:
            if col in df.columns:
                feature_cols.append(col)
        
        if not feature_cols:
            # Use all numeric columns
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            feature_cols = list(numeric_cols)[:8]  # Use first 8 numeric columns
        
        features = df[feature_cols].fillna(0)
        
        # Handle infinite values
        features = features.replace([np.inf, -np.inf], 0)
        
        return features
    
    def _categorize_anomaly(self, row):
        """Categorize the type of anomaly"""
        if 'aghi_score' in row.index:
            if row['aghi_score'] < 40:
                return 'Critical Performance'
            elif row['aghi_score'] < 60:
                return 'Underperforming'
        
        if 'pending_ratio' in row.index and row['pending_ratio'] > 50:
            return 'High Backlog'
        
        if 'enrollment_rejected' in row.index and row['enrollment_rejected'] > row.get('enrollment_total', 1) * 0.3:
            return 'High Rejection Rate'
        
        return 'Operational Anomaly'
    
    def _generate_alert(self, row):
        """Generate authoritative alert message"""
        district = row.get('district', 'N/A')
        state = row.get('state', 'N/A')
        
        if row['anomaly_type'] == 'Critical Performance':
            return f"Strategic Alert: {district} ({state}) is operating significantly below the national AGHI baseline. System resilience is compromised."
        elif row['anomaly_type'] == 'High Backlog':
            return f"Operational Bottleneck: {district} ({state}) shows a backlog ratio of {row.get('pending_ratio', 0):.1f}%, exceeding safety thresholds."
        elif row['anomaly_type'] == 'High Rejection Rate':
            return f"Metric Alert: Significant processing friction detected in {district}. Enrollment rejection rate is anomalous."
        
        return f"System Signal: Non-standard operational patterns identified in {district}. Recommended for secondary review."
    
    def get_priority_interventions(self, anomalies, top_n=10):
        """Get top N priority interventions"""
        if anomalies.empty:
            return pd.DataFrame()
        
        # Sort by anomaly confidence and AGHI score
        priorities = anomalies.sort_values(['anomaly_confidence', 'aghi_score']).head(top_n)
        
        # Add recommended actions
        priorities['recommended_action'] = priorities.apply(self._recommend_action, axis=1)
        
        return priorities[['state', 'district', 'aghi_score', 'anomaly_type', 
                          'alert_message', 'recommended_action']]
    
    def _recommend_action(self, row):
        """Generate high-impact recommended actions"""
        if row['anomaly_type'] == 'Critical Performance':
            return "Command Review: Immediate reallocation of technical resources and mandatory audit of regional service centers."
        elif row['anomaly_type'] == 'High Backlog':
            return "Resource Dispatch: Deploy rapid-response processing teams and authorize temporary 12-hour operational windows."
        elif row['anomaly_type'] == 'High Rejection Rate':
            return "Service Audit: Investigate biometric capture hardware quality and initiate mandatory staff retraining on processing protocols."
        else:
            return "Diagnostic Sync: Initiate deep-dive root cause analysis and sync with regional coordinators."

# Example usage
if __name__ == "__main__":
    detector = AnomalyDetector()
    # Load your data
    # data = pd.read_csv("../data/processed/aghi_final_data.csv")
    # anomalies = detector.detect_anomalies(data)
    # priorities = detector.get_priority_interventions(anomalies)
    # print(f"Found {len(anomalies)} anomalies")