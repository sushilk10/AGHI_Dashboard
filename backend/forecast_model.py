import pandas as pd
import numpy as np
from prophet import Prophet
import warnings
warnings.filterwarnings('ignore')

class AGHIForecaster:
    def __init__(self):
        self.models = {}
        
    def prepare_time_series(self, df, entity_col='state', entity_id=None):
        """Prepare data for time series forecasting"""
        if 'month' not in df.columns:
            raise ValueError("Data must contain 'month' column for forecasting")
        
        if entity_id:
            entity_data = df[df[entity_col] == entity_id].copy()
        else:
            entity_data = df.copy()
        
        # Aggregate by month
        ts_data = entity_data.groupby('month').agg({
            'aghi_score': 'mean',
            'enrollment_total': 'sum',
            'total_updates': 'sum'
        }).reset_index()
        
        # Prepare for Prophet
        prophet_df = pd.DataFrame({
            'ds': pd.to_datetime(ts_data['month']),
            'y': ts_data['aghi_score']
        })
        
        # Add additional regressors if available
        if 'enrollment_total' in ts_data.columns:
            prophet_df['enrollment'] = ts_data['enrollment_total']
        if 'total_updates' in ts_data.columns:
            prophet_df['updates'] = ts_data['total_updates']
        
        return prophet_df
    
    def train_forecast_model(self, df, periods=6):
        """Train forecasting model for given data"""
        # Prepare data only if it hasn't been prepared yet
        if isinstance(df, pd.DataFrame) and 'month' in df.columns:
            prophet_df = self.prepare_time_series(df)
        else:
            prophet_df = df
        
        # Initialize and configure model
        model = Prophet(
            yearly_seasonality=False, # Not enough data for yearly seasonality with only 11 months
            weekly_seasonality=False,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )
        
        # Add additional regressors if they exist in the prepared dataframe
        if 'enrollment' in prophet_df.columns:
            model.add_regressor('enrollment')
        if 'updates' in prophet_df.columns:
            model.add_regressor('updates')
        
        # Fit model
        model.fit(prophet_df)
        
        # Create future dataframe (MS = Month Start to match our input data)
        future = model.make_future_dataframe(periods=periods, freq='MS')
        
        # Add regressors to future dataframe (using last known values for simplicity)
        if 'enrollment' in prophet_df.columns:
            future['enrollment'] = prophet_df['enrollment'].iloc[-1]
        if 'updates' in prophet_df.columns:
            future['updates'] = prophet_df['updates'].iloc[-1]
        
        # Make forecast
        forecast = model.predict(future)
        
        return model, forecast
    
    def forecast_aghi_trends(self, df, entity_col='state', top_n=5):
        """Forecast trends for top entities"""
        results = {}
        
        # Get top entities by recent AGHI
        recent_data = df[df['month'] == df['month'].max()]
        top_entities = recent_data.nlargest(top_n, 'aghi_score')[entity_col].tolist()
        bottom_entities = recent_data.nsmallest(top_n, 'aghi_score')[entity_col].tolist()
        
        # Forecast for top entities
        for entity in top_entities + bottom_entities:
            try:
                entity_data = self.prepare_time_series(df, entity_col, entity)
                if len(entity_data) < 6:  # Need minimum data points
                    continue
                
                model, forecast = self.train_forecast_model(entity_data, periods=6)
                
                results[entity] = {
                    'historical': entity_data[['ds', 'y']].rename(columns={'ds': 'date', 'y': 'aghi'}),
                    'forecast': forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].rename(
                        columns={'ds': 'date', 'yhat': 'forecast', 'yhat_lower': 'lower_bound', 'yhat_upper': 'upper_bound'}
                    ),
                    'trend': 'improving' if forecast['yhat'].iloc[-1] > forecast['yhat'].iloc[-7] else 'declining',
                    'next_month': round(forecast['yhat'].iloc[-6], 2),
                    'six_month': round(forecast['yhat'].iloc[-1], 2)
                }
            except Exception as e:
                print(f"Error forecasting for {entity}: {str(e)}")
                continue
        
        return results
    
    def generate_insights(self, forecast_results):
        """Generate actionable insights from forecasts"""
        insights = []
        
        for entity, data in forecast_results.items():
            trend = data['trend']
            next_month = data['next_month']
            six_month = data['six_month']
            
            if trend == 'improving' and six_month > next_month:
                insight = {
                    'entity': entity,
                    'type': 'positive',
                    'message': f"{entity} shows strong improving trend. Expected to reach {six_month} AGHI in 6 months.",
                    'recommendation': 'Maintain current policies and consider scaling successful initiatives.'
                }
            elif trend == 'declining' and six_month < next_month:
                insight = {
                    'entity': entity,
                    'type': 'warning',
                    'message': f"{entity} shows concerning decline. Projected to fall to {six_month} AGHI in 6 months.",
                    'recommendation': 'Immediate intervention required. Review operational bottlenecks.'
                }
            else:
                insight = {
                    'entity': entity,
                    'type': 'neutral',
                    'message': f"{entity} shows stable performance around {next_month} AGHI.",
                    'recommendation': 'Monitor closely and optimize existing processes.'
                }
            
            insights.append(insight)
        
        return insights

# Example usage
if __name__ == "__main__":
    forecaster = AGHIForecaster()
    # Load your data
    # data = pd.read_csv("../data/processed/aghi_final_data.csv")
    # data['month'] = pd.to_datetime(data['month'])
    # results = forecaster.forecast_aghi_trends(data)
    # insights = forecaster.generate_insights(results)
    # print(f"Generated {len(insights)} insights")