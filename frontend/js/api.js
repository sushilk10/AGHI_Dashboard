// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

class AGHIAPI {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    // Helper method for making API calls
    async fetchAPI(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const cacheKey = url + JSON.stringify(options);
        
        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data;
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache the response
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            throw error;
        }
    }

    // Dashboard Overview
    async getOverview() {
        return this.fetchAPI('/overview');
    }

    // Map Data
    async getMapData(level = 'state') {
        return this.fetchAPI(`/map-data?level=${level}`);
    }

    // Trends
    async getTrends(state = 'National', district = null) {
        let url = `/trends?state=${encodeURIComponent(state)}`;
        if (district) {
            url += `&district=${encodeURIComponent(district)}`;
        }
        return this.fetchAPI(url);
    }

    // Rankings
    // Rankings
    async getRankings(level = 'state', limit = 10, state = null) {
        let url = `/rankings?level=${level}&limit=${limit}`;
        if (state) {
            url += `&state=${encodeURIComponent(state)}`;
        }
        return this.fetchAPI(url);
    }

    // Anomalies
    async getAnomalies() {
        return this.fetchAPI('/anomalies');
    }

    // Forecasts
    async getForecasts() {
        return this.fetchAPI('/forecasts');
    }

    // State Details
    async getStateDetails(stateName) {
        return this.fetchAPI(`/state/${encodeURIComponent(stateName)}`);
    }

    // AI Simulation
    async runSimulation(state, adjustments) {
        return this.fetchAPI('/simulate', {
            method: 'POST',
            body: JSON.stringify({ state, adjustments })
        });
    }

    // AI Chat
    async sendChatMessage(query) {
        return this.fetchAPI('/chat', {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    }

    // Benchmarking
    async getBenchmarkData(entities) {
        return this.fetchAPI('/benchmark', {
            method: 'POST',
            body: JSON.stringify({ entities })
        });
    }

    // Diagnostics
    async getDiagnosis(state) {
        return this.fetchAPI('/diagnose', {
            method: 'POST',
            body: JSON.stringify({ state })
        });
    }

    // Briefing
    async generateBriefing(state) {
        return this.fetchAPI('/generate-briefing', {
            method: 'POST',
            body: JSON.stringify({ state })
        });
    }

    // Operations Data (Real-time)
    async getOperationsData(state = 'National') {
        return this.fetchAPI(`/operations?state=${encodeURIComponent(state)}`);
    }

    // Refresh Data
    async refreshData() {
        try {
            const response = await fetch(`${API_BASE_URL}/refresh-data`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to refresh data');
            }
            
            // Clear cache on refresh
            this.cache.clear();
            
            return await response.json();
        } catch (error) {
            console.error('Error refreshing data:', error);
            throw error;
        }
    }

    // Health Check
    async checkHealth() {
        return this.fetchAPI('/health');
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Get cache info
    getCacheInfo() {
        const entries = Array.from(this.cache.entries());
        return {
            size: entries.length,
            entries: entries.map(([key, value]) => ({
                key: key.substring(0, 100) + (key.length > 100 ? '...' : ''),
                age: Date.now() - value.timestamp,
                data: value.data
            }))
        };
    }
}

// Create singleton instance
const api = new AGHIAPI();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}