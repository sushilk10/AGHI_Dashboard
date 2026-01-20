import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler

class AGHICalculator:
    def __init__(self):
        # Define pillar weights
        self.pillar_weights = {
            'operational_efficiency': 0.40,
            'data_health': 0.35,
            'system_stability': 0.25
        }
        
        # Define indicators for each pillar
        self.indicators = {
            'operational_efficiency': [
                'enrollment_success_rate',
                'processing_days',
                'pending_ratio'
            ],
            'data_health': [
                'update_success_rate',
                'total_updates_per_enrollment' # Relative volume
            ],
            'system_stability': [
                'pending_ratio',
                'enrollment_rejection_rate',
                'governance_imbalance'
            ]
        }
    
    def calculate_aghi_score(self, df):
        """Calculate AGHI score for each row"""
        # Create a copy to avoid modifying original
        df_scored = df.copy()
        
        # Calculate pillar scores
        pillar_scores = {}
        
        for pillar, indicators in self.indicators.items():
            pillar_score = 0
            available_indicators = 0
            
            for indicator in indicators:
                if indicator in df_scored.columns:
                    # Normalize indicator (0-100)
                    normalized = self._normalize_indicator(df_scored, indicator, pillar)
                    pillar_score += normalized
                    available_indicators += 1
            
            # Average available indicators
            if available_indicators > 0:
                pillar_scores[pillar] = pillar_score / available_indicators
            else:
                pillar_scores[pillar] = 50  # Default score
        
        # Calculate composite AGHI score
        df_scored['aghi_score'] = (
            pillar_scores['operational_efficiency'] * self.pillar_weights['operational_efficiency'] +
            pillar_scores['data_health'] * self.pillar_weights['data_health'] +
            pillar_scores['system_stability'] * self.pillar_weights['system_stability']
        )
        
        # Add pillar scores to dataframe
        for pillar, score in pillar_scores.items():
            df_scored[f'{pillar}_score'] = score
        
        # Categorize performance
        df_scored['performance_category'] = pd.cut(
            df_scored['aghi_score'],
            bins=[0, 40, 60, 80, 100],
            labels=['Critical', 'Needs Improvement', 'Good', 'Excellent'],
            include_lowest=True
        )
        
        return df_scored
    
    def _normalize_indicator(self, df, indicator, pillar):
        """Normalize indicator values to 0-100 scale"""
        # Handle special cases
        if indicator == 'processing_days':
            # Lower processing days is better
            max_val = df[indicator].max()
            if max_val > 0:
                return 100 * (1 - df[indicator] / max_val)
            return 100
        
        elif indicator in ['enrollment_rejected', 'enrollment_pending', 'demo_rejected', 'bio_rejected']:
            # Lower is better for rejections and pending items
            max_val = df[indicator].max()
            if max_val > 0:
                return 100 * (1 - df[indicator] / max_val)
            return 100
        
        elif indicator in ['pending_ratio', 'enrollment_rejection_rate', 'governance_imbalance']:
            # Lower ratio/rate/imbalance is better
            return np.where(df[indicator] <= 100, 100 - df[indicator], 0)
        
        else:
            # Higher is better for most indicators
            scaler = MinMaxScaler(feature_range=(0, 100))
            normalized = scaler.fit_transform(df[[indicator]])
            return normalized.flatten()
    
    def get_national_summary(self, df):
        """Calculate national-level summary statistics"""
        top_row = df.loc[df['aghi_score'].idxmax()] if 'aghi_score' in df.columns else None
        
        summary = {
            'national_aghi': round(df['aghi_score'].mean(), 2),
            'top_state': top_row['state'] if top_row is not None else 'N/A',
            'top_score': round(top_row['aghi_score'], 2) if top_row is not None else 0,
            'top_pillar': self._get_top_pillar(top_row) if top_row is not None else 'N/A',
            'bottom_state': df.loc[df['aghi_score'].idxmin(), 'state'] if 'state' in df.columns else 'N/A',
            'bottom_score': round(df['aghi_score'].min(), 2),
            'total_districts': df['district'].nunique() if 'district' in df.columns else 0,
            'excellent_performers': len(df[df['performance_category'] == 'Excellent']),
            'critical_performers': len(df[df['performance_category'] == 'Critical']),
            'avg_enrollment_rate': round(df['enrollment_success_rate'].mean(), 2) if 'enrollment_success_rate' in df.columns else 0,
            'avg_update_rate': round(df['update_success_rate'].mean(), 2) if 'update_success_rate' in df.columns else 0,
            'inclusion_rate': round(df['youth_coverage_ratio'].mean(), 2) if 'youth_coverage_ratio' in df.columns else 0,
            'resilience_index': round(100 - (df['aghi_score'].std() / df['aghi_score'].mean() * 100), 2) if df['aghi_score'].mean() > 0 else 50
        }
        return summary

    def _get_top_pillar(self, row):
        """Identify the highest scoring pillar for a row"""
        pillars = {
            'Efficiency': row.get('operational_efficiency_score', 0),
            'Health': row.get('data_health_score', 0),
            'Stability': row.get('system_stability_score', 0)
        }
        return max(pillars, key=pillars.get)

# Example usage
if __name__ == "__main__":
    calculator = AGHICalculator()
    # Load your data
    # data = pd.read_csv("../data/processed/aghi_final_data.csv")
    # scored_data = calculator.calculate_aghi_score(data)
    # summary = calculator.get_national_summary(scored_data)
    # print(summary)