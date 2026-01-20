import pandas as pd
import numpy as np
from datetime import datetime
import os

class DataLoader:
    def __init__(self, data_path=None):
        if data_path is None:
            # Get directory of this file (backend/)
            base_dir = os.path.dirname(os.path.abspath(__file__))
            # Go up one level and into data/raw
            self.data_path = os.path.join(base_dir, '..', 'data', 'raw')
        else:
            self.data_path = data_path
        
    def load_all_datasets(self):
        """Load and merge all three UIDAI datasets"""
        print("Loading UIDAI datasets...")
        
        # Load raw datasets
        enrollment = pd.read_csv(os.path.join(self.data_path, "MONTHLY_ENROLLMENT.csv"))
        demographic = pd.read_csv(os.path.join(self.data_path, "DEMOGRAPHIC_UPDATE.csv"))
        biometric = pd.read_csv(os.path.join(self.data_path, "BIOMETRIC_UPDATE.csv"))
        
        # Standardize column names
        enrollment = self._standardize_columns(enrollment, "enrollment")
        demographic = self._standardize_columns(demographic, "demographic")
        biometric = self._standardize_columns(biometric, "biometric")
        
        # Merge datasets
        merged_data = self._merge_datasets(enrollment, demographic, biometric)
        
        # Calculate derived metrics
        merged_data = self._calculate_metrics(merged_data)
        
        return merged_data
    
    def _standardize_columns(self, df, dataset_type):
        """Standardize column names across datasets"""
        df.columns = df.columns.str.strip().str.lower()
        
        # Handle existing month/year columns to avoid conflicts when renaming 'date' to 'month'
        if 'month' in df.columns and 'date' in df.columns:
            df = df.rename(columns={'month': 'month_val'})
        if 'year' in df.columns:
            df = df.rename(columns={'year': 'year_val'})
            
        # Add dataset prefix to avoid column conflicts
        if dataset_type == "enrollment":
            rename_map = {
                'total': 'enrollment_total',
                'total_biometric': 'enrollment_total',
                'rejected': 'enrollment_rejected',
                'pending': 'enrollment_pending',
                'date': 'month'
            }
        elif dataset_type == "demographic":
            rename_map = {
                'updates': 'demo_updates',
                'total_biometric': 'demo_updates',
                'rejected': 'demo_rejected',
                'date': 'month'
            }
        else:  # biometric
            rename_map = {
                'updates': 'bio_updates',
                'total_biometric': 'bio_updates',
                'rejected': 'bio_rejected',
                'date': 'month'
            }
        
        df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
        
        # Ensure required columns exist to avoid errors in calculation
        required_cols = {
            'enrollment': ['enrollment_total', 'enrollment_rejected', 'enrollment_pending'],
            'demographic': ['demo_updates', 'demo_rejected'],
            'biometric': ['bio_updates', 'bio_rejected']
        }
        for col in required_cols.get(dataset_type, []):
            if col not in df.columns:
                df[col] = 0
                
        return df
    
    def _merge_datasets(self, enroll, demo, bio):
        """Merge datasets on state, district, and month after aggregating to prevent memory explosion"""
        
        def aggregate_df(df):
            # Ensure common key columns
            if 'state' not in df.columns:
                df['state'] = 'Unknown'
            if 'district' not in df.columns:
                df['district'] = 'Unknown'
            if 'month' not in df.columns:
                # If 'month' was missing, use today, but it should have been renamed from 'date' or handled
                df['month'] = pd.Timestamp.now()
            
            # Ensure month is datetime
            df['month'] = pd.to_datetime(df['month'], errors='coerce')
            # Normalize to start of month
            df['month'] = df['month'].dt.to_period('M').dt.to_timestamp()
            
            # Identify numeric columns to sum
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            # Group by keys and sum
            agg_df = df.groupby(['state', 'district', 'month'])[numeric_cols].sum().reset_index()
            return agg_df

        print("Aggregating datasets before merge...")
        enroll_agg = aggregate_df(enroll)
        demo_agg = aggregate_df(demo)
        bio_agg = aggregate_df(bio)
        
        # Merge step by step
        print("Merging aggregated data...")
        merged = pd.merge(enroll_agg, demo_agg, on=['state', 'district', 'month'], how='outer')
        merged = pd.merge(merged, bio_agg, on=['state', 'district', 'month'], how='outer')
        
        # Fill NaN values for all metrics after merge
        numeric_cols = merged.select_dtypes(include=[np.number]).columns
        merged[numeric_cols] = merged[numeric_cols].fillna(0)
        
        return merged
    
    def _calculate_metrics(self, df):
        """Calculate key governance metrics"""
        # Efficiency metrics
        df['enrollment_success_rate'] = np.where(
            df['enrollment_total'] > 0,
            (df['enrollment_total'] - df['enrollment_rejected']) / df['enrollment_total'] * 100,
            0
        )
        
        # Update metrics
        df['total_updates'] = df['demo_updates'] + df['bio_updates']
        df['update_success_rate'] = np.where(
            df['total_updates'] > 0,
            ((df['demo_updates'] - df['demo_rejected']) + 
             (df['bio_updates'] - df['bio_rejected'])) / df['total_updates'] * 100,
            0
        )
        
        df['enrollment_rejection_rate'] = np.where(
            df['enrollment_total'] > 0,
            df['enrollment_rejected'] / df['enrollment_total'] * 100,
            0
        )
        
        df['total_updates_per_enrollment'] = np.where(
            df['enrollment_total'] > 0,
            df['total_updates'] / df['enrollment_total'],
            0
        )
        
        # Demographic Inclusion metrics (Simplified for demo)
        df['youth_coverage_ratio'] = np.where(
            df['enrollment_total'] > 0,
            (df['age_0_5'] + df['age_5_17']) / df['enrollment_total'] * 100,
            0
        )
        
        # Proxy for governance imbalance (Standardized deviation of rejections)
        df['governance_imbalance'] = (df['enrollment_rejection_rate'] + df['update_success_rate'].apply(lambda x: 100-x)) / 2
        
        # Backlog metrics
        df['pending_ratio'] = np.where(
            df['enrollment_total'] > 0,
            df['enrollment_pending'] / df['enrollment_total'] * 100,
            0
        )
        
        # Timeliness (assuming you have date columns)
        if 'application_date' in df.columns and 'completion_date' in df.columns:
            df['processing_days'] = (pd.to_datetime(df['completion_date']) - 
                                    pd.to_datetime(df['application_date'])).dt.days
        
        return df
    
    def save_processed_data(self, df, output_path="../data/processed/aghi_final_data.csv"):
        """Save processed data"""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)
        print(f"Processed data saved to {output_path}")
        return output_path

# Example usage
if __name__ == "__main__":
    loader = DataLoader()
    data = loader.load_all_datasets()
    print(f"Loaded {len(data)} records")
    print("Columns:", data.columns.tolist())