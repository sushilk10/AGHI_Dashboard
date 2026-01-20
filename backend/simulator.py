import pandas as pd
import numpy as np

class InterventionSimulator:
    def __init__(self, calculator):
        self.calculator = calculator
        
    def simulate_impact(self, current_data, adjustments):
        """
        Simulate the impact of changing metrics on the AGHI score.
        adjustments: dict of metric_name -> percentage_change (e.g. {'enrollment_success_rate': 0.1} for +10%)
        """
        simulated_data = current_data.copy()
        
        for metric, change in adjustments.items():
            if metric in simulated_data.columns:
                # Apply percentage change
                simulated_data[metric] = simulated_data[metric] * (1 + change)
                
                # Logical caps for percentages
                if 'rate' in metric or 'ratio' in metric:
                    simulated_data[metric] = simulated_data[metric].clip(0, 100)
                else:
                    simulated_data[metric] = simulated_data[metric].clip(lower=0)
        
        # Recalculate AGHI
        result = self.calculator.calculate_aghi_score(simulated_data)
        
        # Calculate pillar impact
        pillar_impacts = {
            'efficiency': round(result['operational_efficiency_score'].mean(), 2),
            'health': round(result['data_health_score'].mean(), 2),
            'stability': round(result['system_stability_score'].mean(), 2)
        }
        
        return result, pillar_impacts

    def get_sensitivity_analysis(self, entity_data):
        """Determine which metrics have the most impact"""
        metrics_to_test = {
            'enrollment_success_rate': 'Enrollment Success',
            'update_success_rate': 'Update Success',
            'pending_ratio': 'Backlog Reduction',
            'processing_days': 'Turnaround Time'
        }
        
        impacts = []
        base_aghi = entity_data['aghi_score'].iloc[0]
        
        for metric, label in metrics_to_test.items():
            if metric in entity_data.columns:
                # Test 15% improvement
                adj = {metric: 0.15 if metric != 'pending_ratio' and metric != 'processing_days' else -0.15}
                sim_data, _ = self.simulate_impact(entity_data, adj)
                new_aghi = sim_data['aghi_score'].iloc[0]
                
                impacts.append({
                    'metric': metric,
                    'potential_improvement': round(new_aghi - base_aghi, 2),
                    'label': label
                })
        
        # Sort by impact
        impacts = sorted(impacts, key=lambda x: abs(x['potential_improvement']), reverse=True)
        return impacts
