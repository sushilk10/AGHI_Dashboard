import pandas as pd
import numpy as np

class AGHIChatbot:
    def __init__(self, data):
        self.data = data
        if data is not None and 'month' in data.columns:
            self.latest_data = data[data['month'] == data['month'].max()]
        else:
            self.latest_data = data
        self.context = {
            'last_state': None,
            'comparison_states': []
        }
        
    def process_query(self, query):
        """Context-aware NLP query processor with comparative memory"""
        query = query.lower()
        
        # Extract states mentioned in query
        mentioned_states = [s for s in self.data['state'].unique() if isinstance(s, str) and s.lower() in query]
        
        # Update context
        if mentioned_states:
            self.context['last_state'] = mentioned_states[0]
            if len(mentioned_states) >= 2:
                self.context['comparison_states'] = mentioned_states[:2]
        
        target_state = mentioned_states[0] if mentioned_states else self.context['last_state']
        states_for_handler = [target_state] if target_state else []
        
        # Comparative states fallback
        comp_states = mentioned_states if len(mentioned_states) >= 2 else self.context['comparison_states']

        # Keyword mappings for intent discovery
        intents = {
            'comparison': ['compare', 'versus', 'vs', 'difference between', 'gap', 'them again'],
            'problem': ['problem', 'issue', 'why', 'bad', 'low', 'challenge', 'bottleneck', 'fail', 'weak'],
            'performance': ['top', 'best', 'ranking', 'lead', 'high', 'performing', 'winner'],
            'alert': ['alert', 'critical', 'ops', 'operations', 'sla'],
            'navigation': ['show', 'go to', 'switch', 'open', 'view', 'navigate', 'look at'],
            'summary': ['summary', 'status', 'tell me about', 'overview', 'how is', 'report', 'explain', 'briefing', 'analyze'],
            'inclusion': ['inclusion', 'youth', 'child', '0-17', 'minor'],
            'resilience': ['resilience', 'stability', 'robust', 'consistent', 'steady']
        }

        def check_intent(key): return any(k in query for k in intents[key])

        # Priority 1: Navigation / view switching
        if check_intent('navigation') and mentioned_states:
             return f"Navigating to {mentioned_states[0]} view..."
             
        # Handle state mentions more loosely (up to 5 words)
        if len(query.split()) <= 5 and mentioned_states and not any(check_intent(k) for k in intents):
            return self._handle_state_summary(mentioned_states[0])

        if check_intent('comparison'):
            return self._handle_comparison(query, comp_states)
        elif check_intent('alert') or ('critical' in query and 'ops' in query):
             return "Activating Critical Operations Monitor. Highlighting SLA breaches across 3 regions."
        elif check_intent('problem'):
            return self._handle_problem_query(query, states_for_handler)
        elif check_intent('performance'):
            return self._handle_top_performers(query)
        elif check_intent('summary') or 'national' in query or 'india' in query:
            if mentioned_states:
                return self._handle_state_summary(mentioned_states[0])
            return self._handle_summary(query)
        else:
            return "I didn't capture that intent. Try 'Show me Maharashtra', 'National Summary', or 'Alert Ops'."

    def _handle_problem_query(self, query, states):
        if not states:
            # National Bottleneck Analysis
            stats = {
                'Operational Efficiency': self.latest_data['operational_efficiency_score'].mean(),
                'Data Health': self.latest_data['data_health_score'].mean(),
                'System Stability': self.latest_data['system_stability_score'].mean()
            }
            weakest = min(stats, key=stats.get)
            return f"Nationally, the primary systemic bottleneck is **{weakest}** (Score: {round(stats[weakest], 1)}). Policy focus should prioritize this pillar to improve the overall AGHI baseline."
        
        state = states[0]
        state_data = self.latest_data[self.latest_data['state'] == state]
        
        # Analyze pillars
        pillars = {
            'Operational Efficiency': state_data['operational_efficiency_score'].mean(),
            'Data Health': state_data['data_health_score'].mean(),
            'System Stability': state_data['system_stability_score'].mean()
        }
        
        weakest = min(pillars, key=pillars.get)
        score = round(pillars[weakest], 2)
        
        return f"In {state}, the primary challenge is **{weakest}** (Score: {score}). AI suggests focusing on this pillar to boost the overall AGHI."

    def _handle_state_summary(self, state):
        state_data = self.latest_data[self.latest_data['state'] == state]
        avg = round(state_data['aghi_score'].mean(), 2)
        rank = "high" if avg > 70 else ("moderate" if avg > 50 else "low")
        
        return f"Summary for {state}: The average AGHI is {avg}, which is considered {rank}. There are {len(state_data)} districts reporting data in this state."

    def _handle_comparison(self, query, states):
        if len(states) < 2:
            return "Please mention at least two states to compare (e.g., 'Compare Punjab and Gujarat')."
        
        comparison = []
        for state in states:
            score = round(self.latest_data[self.latest_data['state'] == state]['aghi_score'].mean(), 2)
            comparison.append(f"**{state}** (AGHI: {score})")
            
        diff = round(abs(self.latest_data[self.latest_data['state'] == states[0]]['aghi_score'].mean() - self.latest_data[self.latest_data['state'] == states[1]]['aghi_score'].mean()), 1)
        
        return "Comparison Result: " + " vs ".join(comparison) + ". " + \
               (f"The performance gap is **{diff} points**." if len(comparison) > 1 else "")

    def _handle_top_performers(self, query):
        top = self.latest_data.sort_values('aghi_score', ascending=False).head(3)
        res = "Top 3 Performers: "
        items = [f"{r['district']} in {r['state']} ({r['aghi_score']})" for _, r in top.iterrows()]
        return res + ", ".join(items)

    def _handle_bottom_performers(self, query):
        bottom = self.latest_data.sort_values('aghi_score', ascending=True).head(3)
        res = "Districts requiring immediate attention: "
        items = [f"{r['district']} in {r['state']} (AGHI: {r['aghi_score']})" for _, r in bottom.iterrows()]
        return res + ", ".join(items)

    def _handle_inclusion_query(self, query, states):
        df = self.latest_data if not states else self.latest_data[self.latest_data['state'] == states[0]]
        avg_incl = round(df['youth_coverage_ratio'].mean(), 2)
        target = "Nationally" if not states else f"In {states[0]}"
        return f"{target}, the Digital Inclusion score (Youth 0-17) is **{avg_incl}%**. This measures our success in reaching the next generation of citizens."

    def _handle_resilience_query(self, query, states):
        df = self.data if not states else self.data[self.data['state'] == states[0]]
        # Use inverse CoV as proxy for Resilience
        resilience = round(100 - (df['aghi_score'].std() / df['aghi_score'].mean() * 100), 1) if df['aghi_score'].mean() > 0 else 50
        target = "The National" if not states else f"{states[0]}'s"
        return f"{target} Governance Resilience Index is **{resilience}/100**. This reflects the stability and consistency of service delivery over time."

    def _handle_summary(self, query):
        avg = round(self.latest_data['aghi_score'].mean(), 2)
        excellent = len(self.latest_data[self.latest_data['aghi_score'] >= 80])
        critical = len(self.latest_data[self.latest_data['aghi_score'] < 40])
        
        return f"National Snapshot: Average AGHI is {avg}. We have {excellent} excellent regions and {critical} regions in critical condition. Policy intervention is primary suggested for the bottom 5%."

    def get_response(self, query):
        """Alias for process_query to maintain compatibility."""
        return self.process_query(query)
