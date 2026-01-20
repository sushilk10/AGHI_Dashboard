// Dashboard Initialization and Chart Management
class DashboardManager {
    constructor() {
        this.api = api;
        this.currentState = 'National';
        this.currentMapLevel = 'state';
        this.geoData = { state: null, district: null };
        this.charts = {};
        this.simTimeout = null;
        this.init();
    }

    async init() {
        // Load data and initialize charts
        await Promise.all([
            this.loadOverview(),
            this.loadMap(),
            this.loadRankings(),
            this.loadTrends(),
            this.loadAlerts(),
            this.loadCriticalOps()
        ]);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start auto-refresh (every 5 minutes)
        this.startAutoRefresh();
    }

    async loadOverview() {
        try {
            const data = await this.api.getOverview();
            
            // Update KPI cards
            document.getElementById('nationalAGHI').textContent = data.national_aghi.toFixed(1);
            const changeEl = document.getElementById('nationalChange');
            if (changeEl) {
                changeEl.textContent = data.monthly_change >= 0 ? `+${data.monthly_change}` : data.monthly_change;
                changeEl.style.color = data.monthly_change >= 0 ? '#10b981' : '#ef4444';
            }
            
            document.getElementById('updateRate').textContent = `${data.avg_update_rate}%`;
            document.getElementById('priorityRegions').textContent = data.critical_performers;
            document.getElementById('topState').textContent = data.top_state;
            document.getElementById('topScore').textContent = data.top_score;
            
            // Set category based on score
            const topCategory = document.getElementById('topCategory');
            if (topCategory) {
                const score = parseFloat(data.top_score);
                if (score >= 80) topCategory.textContent = 'Excellent';
                else if (score >= 60) topCategory.textContent = 'Good';
                else if (score >= 40) topCategory.textContent = 'Fair';
                else topCategory.textContent = 'Needs Improvement';
            }
            
            document.getElementById('inclusionScore').textContent = `${data.inclusion_rate}%`;
            
            const statusTag = document.querySelector('.performer-status-tag');
            if (statusTag && data.top_pillar) {
                statusTag.innerHTML = `<i class="fas fa-medal"></i> LEAD PILLAR: ${data.top_pillar.toUpperCase()}`;
            }
            
            // Populate Intelligence Header
            const resilienceEl = document.getElementById('nationalResilience');
            if (resilienceEl) resilienceEl.textContent = `${data.resilience_index}/100`;
            
            const zonesEl = document.getElementById('interventionZones');
            if (zonesEl) zonesEl.textContent = data.critical_performers;
            
            // Update Maturity Level
            this.updateMaturityLevel(data.national_aghi);
            
            // Update last updated time
            document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
            
            // Initial comparison bars
            this.updateComparisonBars('National', data.national_aghi, data.national_aghi, data.top_score);
            
            // Populate State Filter Dropdown dynamically
            this.api.getMapData('state').then(states => {
                const select = document.getElementById('stateFilter');
                const trendStateSelect = document.getElementById('trendState');
                
                // Keep National View
                select.innerHTML = '<option value="National">National View</option>';
                if (trendStateSelect) trendStateSelect.innerHTML = '<option value="National">National</option>';
                
                // Only show states that have data in the CSV (currently only Maharashtra)
                // This prevents "No trend data" errors when selecting states without data
                const availableStates = ['Maharashtra']; // Update this list as more state data is added
                
                states
                    .filter(s => availableStates.includes(s.state))
                    .sort((a,b) => a.state.localeCompare(b.state))
                    .forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.state;
                        opt.textContent = s.state;
                        select.appendChild(opt);
                        
                        if (trendStateSelect) {
                            const opt2 = document.createElement('option');
                            opt2.value = s.state;
                            opt2.textContent = s.state;
                            trendStateSelect.appendChild(opt2);
                        }
                    });
                
                console.log(`State filter populated with ${availableStates.length} state(s):`, availableStates);
            });

            // Initialize Persona from session/default
            // Initialize Persona from session/default
            this.setPersona('national');

            // Bind Header Events
            const briefBtn = document.getElementById('generateBriefing');
            if (briefBtn) {
                briefBtn.onclick = () => {
                    this.showToast('Generating Briefing', 'Compiling executive summary for ' + this.currentState, 'info');
                    setTimeout(() => {
                        this.showToast('Briefing Ready', 'Executive Report has been generated successfully.', 'success');
                    }, 2500);
                };
            }
                
        } catch (error) {
            console.error('Error loading overview:', error);
            this.showError('Failed to load overview data');
        }
    }

    updateMaturityLevel(score) {
        const badge = document.getElementById('maturityBadge');
        const levelEl = badge.querySelector('.maturity-level');
        const textEl = badge.querySelector('.maturity-text');
        
        let level, text, color;
        if (score >= 85) { level = 5; text = 'Visionary'; color = '#10b981'; }
        else if (score >= 70) { level = 4; text = 'Optimized'; color = '#3b82f6'; }
        else if (score >= 55) { level = 3; text = 'Consistent'; color = '#8b5cf6'; }
        else if (score >= 40) { level = 2; text = 'Developing'; color = '#f59e0b'; }
        else { level = 1; text = 'Reactive'; color = '#ef4444'; }

        levelEl.textContent = `LEVEL ${level}`;
        textEl.textContent = text;
        badge.style.borderColor = color;
        levelEl.style.color = color;
    }

    async setPersona(persona) {
        document.body.setAttribute('data-active-persona', persona);
        document.querySelectorAll('.persona-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.persona === persona);
        });
        
        this.showMessage(`Switched to ${persona.toUpperCase()} view`, 'info');

        if (persona === 'national') {
            if (this.currentState !== 'National') {
                await this.drillDownToState('National');
            } else {
                this.loadMap(); 
            }
        } 
        if (persona === 'state') {
            if (this.currentState === 'National') {
                await this.drillDownToState('Maharashtra'); 
                this.showMessage('Demo: Assessing Maharashtra state data', 'info');
            } else {
               this.loadMap(this.currentState);
            }
        } 
        else if (persona === 'ops') {
            const trendMetric = document.getElementById('trendMetric');
            if (trendMetric) {
                trendMetric.value = 'updates';
                this.loadTrends();
            }
            this.loadCriticalOps();
        }
    }



    showToast(title, msg, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
        
        toast.innerHTML = `
            <i class="fas ${icon} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${msg}</div>
            </div>
        `;

        container.appendChild(toast);

        // Remove after 3s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async loadMap(stateFilter = null) {
        try {
            const level = stateFilter ? 'district' : this.currentMapLevel;
            let mapData = await this.api.getMapData(level);
            
            if (stateFilter) {
                mapData = mapData.filter(d => d.state === stateFilter);
            }

            // Load GeoJSON if not already loaded
            if (!this.geoData[level]) {
                const geoUrl = level === 'state' 
                    ? 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson'
                    : 'https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson';
                const response = await fetch(geoUrl);
                this.geoData[level] = await response.json();
            }

            // Ensure map container is visible before rendering to prevent Plotly size issues
            const mapContainer = document.querySelector('.map-container');
            if (getComputedStyle(mapContainer).display === 'none') return; // Don't render if hidden (e.g. Ops view)

            let geojson = this.geoData[level];
            
            if (stateFilter) {
                geojson = {
                    ...geojson,
                    features: geojson.features.filter(f => f.properties.NAME_1 === stateFilter)
                };
            }

            const locations = mapData.map(d => level === 'state' ? d.state : d.district);
            const scores = mapData.map(d => d.aghi_score);
            
            // Prepare rich custom data for hover
            const customData = mapData.map(d => [
                d.performance_category,
                d.success_rate || 0,
                d.pending_ratio || 0,
                (d.total_updates || 0).toLocaleString(),
                level === 'state' ? d.district_count : 'N/A'
            ]);

            const featureIdKey = level === 'state' ? 'properties.NAME_1' : 'properties.NAME_2';

            const trace = {
                type: 'choroplethmapbox',
                geojson: geojson,
                locations: locations,
                z: scores,
                featureidkey: featureIdKey,
                customdata: customData,
                hovertemplate: 
                    `<b>%{location}</b><br>` +
                    `AGHI Score: %{z}<br>` +
                    `Status: %{customdata[0]}<br>` +
                    `Success Rate: %{customdata[1]}%<br>` +
                    `Pending Ratio: %{customdata[2]}%<br>` +
                    `Total Updates: %{customdata[3]}` +
                    (level === 'state' ? `<br>Districts: %{customdata[4]}` : '') +
                    `<extra></extra>`, // Hide the secondary box
                colorscale: [[0, '#ef4444'], [0.4, '#f59e0b'], [0.6, '#3b82f6'], [1, '#10b981']],
                zmin: 0, zmax: 100,
                marker: { line: { width: 1, color: '#ffffff' }, opacity: 0.6 }
            };

            // Calculate center dynamically
            let mapCenter = { lon: 78.96, lat: 21.5 }; // India Center
            let mapZoom = 3.5;

            if (stateFilter && geojson.features.length > 0) {
                try {
                    const geometry = geojson.features[0].geometry;
                    let coords = [];
                    // Handle Polygon and MultiPolygon to find a rough center
                    if (geometry.type === 'Polygon') {
                        coords = geometry.coordinates[0];
                    } else if (geometry.type === 'MultiPolygon') {
                        // Take the largest polygon usually, but first one is a safe approximation
                        coords = geometry.coordinates[0][0]; 
                    }
                    
                    if (coords && coords.length > 0) {
                        const lons = coords.map(c => c[0]);
                        const lats = coords.map(c => c[1]);
                        const minLon = Math.min(...lons), maxLon = Math.max(...lons);
                        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
                        
                        mapCenter = {
                            lon: (minLon + maxLon) / 2,
                            lat: (minLat + maxLat) / 2
                        };
                        mapZoom = 6; // Zoom in for state view
                    }
                } catch (e) {
                    console.warn("Could not auto-center map:", e);
                }
            }
            
            const layout = {
                mapbox: {
                    style: "carto-positron",
                    center: mapCenter,
                    zoom: mapZoom
                },
                margin: { l: 0, r: 0, t: 0, b: 0 },
                height: 550,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'Inter' }
            };

            // Store data for click reference
            this.currentMapData = mapData;

            Plotly.react('indiaMap', [trace], layout, { displayModeBar: false, responsive: true });
            
            // Force a resize after render to catch any container changes
            setTimeout(() => Plotly.Plots.resize(document.getElementById('indiaMap')), 50);

            // Remove any existing click handlers to prevent stacking
            const mapElement = document.getElementById('indiaMap');
            mapElement.removeAllListeners && mapElement.removeAllListeners('plotly_click');
            
            mapElement.on('plotly_click', (data) => {
                if (data.points && data.points[0]) {
                    const name = data.points[0].location;
                    const point = data.points[0];
                    
                    console.log('Map clicked:', name, 'Level:', level); // Debug log
                    
                    if (level === 'state') {
                        this.drillDownToState(name);
                    } else {
                        // Show District Details Popup
                        const details = {
                            name: name,
                            score: point.z,
                            status: point.customdata[0],
                            success: point.customdata[1],
                            pending: point.customdata[2],
                            updates: point.customdata[3]
                        };
                        console.log('Showing details for:', details); // Debug log
                        this.showLocationDetails(details);
                    }
                }
            });
            
        } catch (error) {
            console.error('Error loading map:', error);
            this.showError('Map visualization failed to load.');
        }
    }

    showLocationDetails(details) {
        // Remove existing card if present
        const existingCard = document.getElementById('map-detail-card');
        if (existingCard) {
            existingCard.remove();
        }

        // Create new floating detail card
        const card = document.createElement('div');
        card.id = 'map-detail-card';
        card.style.position = 'fixed';
        card.style.bottom = '2rem';
        card.style.left = '50%';
        card.style.transform = 'translateX(-50%)';
        card.style.width = '350px';
        card.style.padding = '1.5rem';
        card.style.borderRadius = '16px';
        card.style.zIndex = '1000';
        card.style.background = 'white';
        card.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
        card.style.border = '1px solid #e2e8f0';
        card.style.animation = 'fadeIn 0.3s ease-out';

        card.innerHTML = `
            <button id="closeDetailCard" style="position:absolute; top:0.5rem; right:0.75rem; border:none; background:none; font-size:1.5rem; cursor:pointer; color:#64748b;">&times;</button>
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
                <div style="background:${details.score > 70 ? '#10b981' : (details.score > 40 ? '#f59e0b' : '#ef4444')}; width:12px; height:12px; border-radius:50%;"></div>
                <h3 style="margin:0; font-size:1.2rem; font-weight:800; color:#0f172a;">${details.name}</h3>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div>
                    <div style="font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase;">AGHI Score</div>
                    <div style="font-size:1.5rem; font-weight:800; color:#1e293b;">${details.score}</div>
                </div>
                <div>
                    <div style="font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase;">Success Rate</div>
                    <div style="font-size:1.5rem; font-weight:800; color:#1e293b;">${details.success}%</div>
                </div>
            </div>
            
            <div style="background:#f8fafc; padding:1rem; border-radius:12px; border:1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <span style="font-size:0.85rem; color:#64748b;">Pending Ratio</span>
                    <span style="font-weight:700; color:#1e293b;">${details.pending}%</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="font-size:0.85rem; color:#64748b;">Total Updates</span>
                    <span style="font-weight:700; color:#1e293b;">${details.updates}</span>
                </div>
            </div>
            
            <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; color:#64748b; font-weight:600;">Status: <span style="color:#0f172a;">${details.status}</span></span>
                <button style="background:none; border:none; color:#2563eb; font-weight:700; font-size:0.85rem; cursor:pointer;">View Full Report</button>
            </div>
        `;
        
        document.body.appendChild(card);
        
        // Add event listener to close button
        document.getElementById('closeDetailCard').addEventListener('click', () => {
            card.remove();
        });
    }

    async setPersona(persona) {
        document.body.setAttribute('data-active-persona', persona);
        document.querySelectorAll('.persona-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.persona === persona);
        });
        
        this.showMessage(`Switched to ${persona.toUpperCase()} view`, 'info');

        if (persona === 'national') {
            if (this.currentState !== 'National') {
                await this.drillDownToState('National');
            } else {
                // Already at National, but force map refresh (resize/render) in case coming from hidden state
                this.loadMap(); 
            }
        } 
        else if (persona === 'state') {
            if (this.currentState === 'National') {
                await this.drillDownToState('Maharashtra'); 
                this.showMessage('Demo: Assessing Maharashtra State Data', 'info');
            } else {
               // Ensure map is refreshed for the current state view
               this.loadMap(this.currentState);
            }
        } 
        else if (persona === 'ops') {
            const trendMetric = document.getElementById('trendMetric');
            if (trendMetric) {
                trendMetric.value = 'updates';
                this.loadTrends();
            }
            this.loadCriticalOps();
        }
    }

    async updateRankingHeader() {
        const header = document.querySelector('.ranking-container .chart-header h3');
        if (header) {
            header.textContent = this.currentState === 'National' 
                ? 'State Rankings' 
                : `${this.currentState} District Rankings`;
        }
    }

    async loadRankings() {
        try {
            this.updateRankingHeader();
            const rankingType = document.getElementById('rankingType').value;
            let rankings = [];

            // Fetch rankings using the enhanced API
            const stateParam = this.currentState === 'National' ? null : this.currentState;
            const data = await this.api.getRankings(this.currentMapLevel, 10, stateParam);
            rankings = rankingType === 'top' ? data.top_performers : data.bottom_performers;
            
            const container = document.getElementById('rankingList');
            container.innerHTML = '';
            
            rankings.forEach((item, index) => {
                const rankItem = document.createElement('div');
                rankItem.className = `ranking-item ${rankingType} fade-in`;
                rankItem.style.animationDelay = `${index * 0.1}s`;
                
                const scoreColor = item.aghi_score >= 80 ? 'excellent' : 
                                 item.aghi_score >= 60 ? 'good' : 
                                 item.aghi_score >= 40 ? 'needs-improvement' : 'critical';
                
                const shift = item.rank_shift || 0;
                const shiftHtml = shift > 0 ? `<span class="rank-shift rank-up"><i class="fas fa-caret-up"></i> ${shift}</span>` : 
                               (shift < 0 ? `<span class="rank-shift rank-down"><i class="fas fa-caret-down"></i> ${Math.abs(shift)}</span>` : '');

                rankItem.innerHTML = `
                    <div class=\"rank-number\">${index + 1}</div>
                    <div class=\"rank-content\">
                        <div class=\"rank-name\">${item.state || item.district} ${shiftHtml}</div>
                        <div class=\"rank-score\">
                            <span class=\"score-pill ${scoreColor}\">AGHI: ${item.aghi_score}</span>
                        </div>
                    </div>
                    <div class=\"rank-chevron\"><i class=\"fas fa-chevron-right\"></i></div>
                `;
                
                rankItem.addEventListener('click', () => {
                    if (item.state) this.drillDownToState(item.state);
                });
                
                container.appendChild(rankItem);
            });
        } catch (error) {
            console.error('Error loading rankings:', error);
        }
    }

    async populateDistrictDropdown() {
        const districtSelector = document.getElementById('trendDistrict');
        if (!districtSelector) return;
        
        try {
            const mapData = await this.api.getMapData('district');
            console.log(`Populating districts for ${this.currentState}. Total data: ${mapData.length}`);
            
            // Normalize strings to ensure matching
            const current = this.currentState.trim().toLowerCase();
            const stateDistricts = mapData.filter(d => d.state && d.state.trim().toLowerCase() === current);
            
            console.log(`Found ${stateDistricts.length} districts for ${this.currentState}`);
            
            // Clear and populate
            districtSelector.innerHTML = '<option value="">All Districts</option>';
            
            // Use Set to ensure unique districts
            const uniqueDistricts = [...new Set(stateDistricts.map(d => d.district))];
            
            uniqueDistricts.sort().forEach(dist => {
                if (dist) {
                    const opt = document.createElement('option');
                    opt.value = dist;
                    opt.textContent = dist;
                    districtSelector.appendChild(opt);
                }
            });
            
            if (stateDistricts.length === 0) {
                 console.warn(`No districts found for state: ${this.currentState}. Check CSV data casing.`);
            }
        } catch (error) {
            console.error('Error populating districts:', error);
        }
    }

    async loadTrends() {
        try {
            console.log('Loading trends grid for state:', this.currentState);
            
            const districtSelector = document.getElementById('trendDistrict');
            const trendStateSelector = document.getElementById('trendState');
            
            if (this.currentState !== 'National') {
                if (districtSelector) districtSelector.style.display = 'inline-block';
                if (trendStateSelector) trendStateSelector.style.display = 'inline-block';
            } else {
                if (districtSelector) districtSelector.style.display = 'none';
                if (trendStateSelector) trendStateSelector.style.display = 'none';
            }
            
            const selectedDistrict = districtSelector ? (districtSelector.value || null) : null;
            const data = await this.api.getTrends(this.currentState, selectedDistrict);
            
            const gridIds = ['trendChart-aghi', 'trendChart-enrollment', 'trendChart-total_updates', 'trendChart-demo_updates', 'trendChart-bio_updates'];
            
            if (!data || data.length === 0) {
                gridIds.forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.innerHTML = '<div class="no-data">No data</div>';
                });
                return;
            }
            
            const months = data.map(d => d.month);
            
            const metrics = [
                { id: 'trendChart-aghi', title: 'AGHI Score', color: '#0B4F9C', key: 'aghi_score' },
                { id: 'trendChart-enrollment', title: 'Monthly Enrollment', color: '#10b981', key: 'enrollment_total' },
                { id: 'trendChart-total_updates', title: 'Total Updates', color: '#138808', key: 'total_updates' },
                { id: 'trendChart-demo_updates', title: 'Demographic Updates', color: '#F25C2D', key: 'demo_updates' },
                { id: 'trendChart-bio_updates', title: 'Biometric Updates', color: '#8b5cf6', key: 'bio_updates' }
            ];

            metrics.forEach(m => {
                 const values = data.map(d => d[m.key] || 0);
                 const trace = {
                    x: months, y: values, type: 'scatter', mode: 'lines+markers', name: m.title,
                    line: { color: m.color, width: 3, shape: 'spline' },
                    marker: { size: 6, color: m.color, line: { color: '#fff', width: 1 } },
                    fill: 'tozeroy', fillcolor: `${m.color}15`,
                    hovertemplate: `<b>%{x}</b><br>${m.title}: %{y:,.0f}<extra></extra>`
                 };
                 
                 const layout = {
                    title: { text: m.title, font: { family: 'Inter', size: 14, color: '#1e293b' }, x: 0.05 },
                    margin: { l: 30, r: 10, t: 40, b: 30 },
                    height: 280, 
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    showlegend: false,
                    xaxis: { showgrid: false, tickfont: { size: 10 } },
                    yaxis: { showgrid: true, gridcolor: '#f1f5f9', tickfont: { size: 10 } }
                 };
                 
                 Plotly.newPlot(m.id, [trace], layout, { displayModeBar: false, responsive: true });
            });

        } catch (error) {
            console.error('Trends error:', error);
        }
    }
    
    async populateDistrictDropdown() {
        try {
            const districtSelector = document.getElementById('trendDistrict');
            if (!districtSelector || this.currentState === 'National') return;
            
            // Get district data for current state
            const mapData = await this.api.getMapData('district');
            const stateDistricts = mapData.filter(d => d.state === this.currentState);
            
            // Clear existing options except "All Districts"
            districtSelector.innerHTML = '<option value="">All Districts</option>';
            
            // Add districts
            stateDistricts.forEach(district => {
                const option = document.createElement('option');
                option.value = district.district;
                option.textContent = district.district;
                districtSelector.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating districts:', error);
        }
    }
    
    async handleStateChange(newState) {
        console.log('State changed to:', newState);
        this.currentState = newState;
        
        // Update map level
        this.currentMapLevel = newState === 'National' ? 'state' : 'district';
        
        // Reload all components
        await Promise.all([
            this.loadMap(),
            this.loadRankings(),
            this.loadTrends()
        ]);
        
        this.showMessage(`Viewing ${newState}`, 'info');
    }

    async loadAlerts() {
        try {
            const data = await this.api.getAnomalies();
            const container = document.getElementById('alertList');
            const countElement = document.getElementById('alertCount');
            
            container.innerHTML = '';
            if (!data.priorities || data.priorities.length === 0) {
                container.innerHTML = '<div class="no-alerts">No priority alerts detected.</div>';
                countElement.textContent = '0';
                return;
            }
            
            countElement.textContent = data.priorities.length;
            data.priorities.forEach((alert, index) => {
                const alertItem = document.createElement('div');
                alertItem.className = 'alert-item-terminal fade-in';
                alertItem.style.animationDelay = `${index * 0.15}s`;
                
                const headerHtml = `<div class=\"terminal-header\"><span>SIG_LOC: ${alert.district.toUpperCase()}</span><span>AGHI: ${alert.aghi_score}</span></div>`;
                const actionHtml = `<div class=\"terminal-action\">${alert.recommended_action}</div>`;
                
                alertItem.innerHTML = headerHtml + `<div class=\"terminal-msg\" id=\"msg-${index}\"></div>` + actionHtml;
                container.appendChild(alertItem);
                
                // Typing effect for message
                this.typeWriter(alert.alert_message, `msg-${index}`, 0);

                alertItem.addEventListener('click', () => this.drillDownToState(alert.state));
            });
        } catch (error) {
            console.error('Alerts error:', error);
        }
    }

    typeWriter(text, elementId, i) {
        if (i < text.length) {
            const el = document.getElementById(elementId);
            if (el) {
                el.innerHTML += text.charAt(i);
                setTimeout(() => this.typeWriter(text, elementId, i + 1), 20);
            }
        }
    }
    
    async drillDownToState(stateName) {
        await this.handleStateChange(stateName);
    }

    async handleStateChange(newState) {
        console.log('State changed to:', newState);
        this.currentState = newState;
        
        // Update state filter dropdown if it exists
        const stateFilter = document.getElementById('stateFilter');
        if (stateFilter && stateFilter.value !== newState) {
            stateFilter.value = newState;
        }
        
        // Sync Trend State Dropdown
        const trendState = document.getElementById('trendState');
        if (trendState && trendState.value !== newState) {
            trendState.value = newState;
        }

        // Populate District Dropdown only if switching to state view
        if (newState !== 'National') {
            await this.populateDistrictDropdown();
        }

        // Update Breadcrumbs
        const breadcrumb = document.getElementById('mapBreadcrumb');
        if (newState === 'National') {
            breadcrumb.innerHTML = '<span class="breadcrumb-item active" data-view="National">India</span>';
            this.currentMapLevel = 'state';
        } else {
            breadcrumb.innerHTML = `<span class="breadcrumb-item" onclick="dashboard.handleStateChange('National')" style="cursor:pointer">India</span> <span class="breadcrumb-item active">${newState}</span>`;
            this.currentMapLevel = 'district';
        }
        
        // Update Chart Header
        const rankingHeader = document.querySelector('.ranking-container .chart-header h3');
        if (rankingHeader) {
            rankingHeader.textContent = newState === 'National' 
                ? 'State Rankings' 
                : `${newState} District Rankings`;
        }
        
        // Update Trend Header
        const trendHeader = document.getElementById('trendHeader');
        if (trendHeader) {
            trendHeader.textContent = newState === 'National' 
                ? 'National Trend Analysis' 
                : `${newState} Trend Analysis`;
        }

        // Reload all components
        // Pass the specific state to loadMap to ensure filtering happens
        const stateToLoad = newState === 'National' ? null : newState;
        
        await Promise.all([
            this.loadMap(stateToLoad),
            this.loadTrends(),
            this.loadRankings(),
            this.loadCriticalOps()
        ]);
        
        // Update comparative text
        const compStateName = document.getElementById('compStateName');
        if (compStateName) compStateName.textContent = newState;
        
        this.showMessage(`Viewing ${newState}`, 'info');
    }

    async loadMap(stateFilter = null) {
        try {
            const level = stateFilter ? 'district' : this.currentMapLevel;
            let mapData = await this.api.getMapData(level);
            
            if (stateFilter) {
                mapData = mapData.filter(d => d.state === stateFilter);
            }

            // Load GeoJSON if not already loaded
            if (!this.geoData[level]) {
                const localUrl = level === 'state' ? 'data/india_state.geojson' : 'data/india_district.geojson';
                const remoteUrl = level === 'state' 
                    ? 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson'
                    : 'https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson';
                
                try {
                    const response = await fetch(localUrl);
                    if (!response.ok) throw new Error('Local failed');
                    this.geoData[level] = await response.json();
                } catch (e) {
                    console.log('Local GeoJSON failed, using remote');
                    const response = await fetch(remoteUrl);
                    this.geoData[level] = await response.json();
                }
            }

            // Ensure map container is visible before rendering to prevent Plotly size issues
            const mapContainer = document.querySelector('.map-container');
            // Check removed to ensure map renders even if transition is pending
            // if (getComputedStyle(mapContainer).display === 'none') return;

            let geojson = this.geoData[level];
            
            // Removed strict GeoJSON filtering to ensure map is always visible
            // The mapData filtering ensures only relevant districts are colored
            // geojson = { features: ... } // caused issues if names didn't match perfectly

            const locations = mapData.map(d => level === 'state' ? d.state : d.district);
            const scores = mapData.map(d => d.aghi_score);
            
            // Prepare rich custom data for hover
            const customData = mapData.map(d => [
                d.performance_category,
                d.success_rate || 0,
                d.pending_ratio || 0,
                (d.total_updates || 0).toLocaleString(),
                level === 'state' ? d.district_count : 'N/A'
            ]);

            const featureIdKey = level === 'state' ? 'properties.NAME_1' : 'properties.NAME_2';

            const trace = {
                type: 'choroplethmapbox',
                geojson: geojson,
                locations: locations,
                z: scores,
                featureidkey: featureIdKey,
                colorscale: window.mapColorscale || [['0.0', 'rgb(239, 68, 68)'], ['0.5', 'rgb(245, 158, 11)'], ['1.0', 'rgb(16, 185, 129)']],
                zmin: 0,
                zmax: 100,
                marker: { opacity: 0.75, line: { width: 1, color: '#ffffff' } },
                text: locations,
                customdata: customData,
                hovertemplate: 
                    '<b>%{text}</b><br>' +
                    'AGHI Score: %{z:.1f}<br>' +
                    'Status: %{customdata[0]}<br>' +
                    'Success Rate: %{customdata[1]}%<br>' +
                    'Pending Ratio: %{customdata[2]}%<br>' +
                    'Total Updates: %{customdata[3]}<br>' +
                    (level === 'state' ? 'Districts: %{customdata[4]}<br>' : '') +
                    '<extra></extra>'
            };

            const layout = {
                mapbox: {
                    style: "carto-positron", // Reverting to cleaner style
                    center: stateFilter ? { lon: 75.7139, lat: 19.7515 } : { lon: 78.9629, lat: 20.5937 }, 
                    zoom: stateFilter ? 5.5 : 3.5
                },
                margin: { l: 0, r: 0, t: 0, b: 0 },
                width: null, height: 450, // Increased height for better visibility
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            };
            
            // Adjust center for specific state if possible (simple heuristic for now)
            // Ideally we'd calculate centroid from filtered geojson
            if (stateFilter) {
                 // Simple hardcoded centers could be added here, or dynamic centroid calculation
                 // For now defaulting to UP coordinates as it is the default drilldown
            }

            const config = { responsive: true, displayModeBar: false };
            
            // Fixed ID mismatch: HTML uses 'indiaMap', JS was using 'mainMap'
            Plotly.newPlot('indiaMap', [trace], layout, config);
            
            const mapElement = document.getElementById('indiaMap');
            if (mapElement.removeAllListeners) {
                mapElement.removeAllListeners('plotly_click');
            }

            mapElement.on('plotly_click', (data) => {
                const point = data.points[0];
                const locationName = point.location;
                console.log('Clicked location:', locationName);
                
                if (level === 'state') {
                    // Clicked a state -> Drill down
                    this.drillDownToState(locationName);
                } else {
                    // Clicked a district -> Show details
                    // Also pass properties to get parent state if needed
                    this.showLocationDetails(locationName, point.customdata);
                }
            });

        } catch (error) {
            console.error('Error loading map:', error);
            this.showError('Failed to load map data');
        }
    }
    async loadCriticalOps() {
        try {
            const data = await this.api.getOperationsData(this.currentState);
            
            // 1. SLA Updates
            const slaBars = document.querySelectorAll('.sla-bar');
            if(slaBars.length >= 3) {
                const enrollEl = slaBars[0];
                const updateEl = slaBars[1];
                const grievEl = slaBars[2];

                enrollEl.style.width = `${data.sla.enrollment_tat}%`;
                enrollEl.parentElement.previousElementSibling.querySelector('.sla-val').textContent = `${this.formatVal(data.sla.enrollment_tat)}%`;
                
                updateEl.style.width = `${data.sla.update_tat}%`;
                updateEl.parentElement.previousElementSibling.querySelector('.sla-val').textContent = `${this.formatVal(data.sla.update_tat)}%`;
                
                grievEl.style.width = `${data.sla.grievance_tat}%`;
                grievEl.parentElement.previousElementSibling.querySelector('.sla-val').textContent = `${this.formatVal(data.sla.grievance_tat)}%`;
            }

            // 2. Failure Analysis
            const circles = document.querySelectorAll('.circular-chart');
            if(circles.length >= 3) {
                // Update strokes and text (Handle potential NaNs from backend)
                const bioVal = this.formatVal(data.failures.bio_mismatch);
                const docVal = this.formatVal(data.failures.doc_quality);
                const techVal = this.formatVal(data.failures.tech_error);

                circles[0].querySelector('.circle').setAttribute('stroke-dasharray', `${bioVal}, 100`);
                circles[0].nextElementSibling.textContent = `${bioVal}%`;
                
                circles[1].querySelector('.circle').setAttribute('stroke-dasharray', `${docVal}, 100`);
                circles[1].nextElementSibling.textContent = `${docVal}%`;
                
                circles[2].querySelector('.circle').setAttribute('stroke-dasharray', `${techVal}, 100`);
                circles[2].nextElementSibling.textContent = `${techVal}%`;
            }

            // 3. Watchlist
            const watchlist = data.watchlist.map(r => `
                <tr>
                    <td>${r.name}</td>
                    <td>${r.failures}%</td>
                    <td><span class="badge ${r.risk > 50 ? 'critical' : 'warning'}">${r.risk}/100</span></td>
                    <td>${r.status}</td>
                </tr>
            `).join('');
            
            const table = document.getElementById('operatorWatchlist');
            if(table) table.innerHTML = watchlist;

        } catch (error) {
            console.error('Critical Ops Load Error:', error);
        }
    }

    updateComparisonBars(name, current, national, top) {
        document.getElementById('compStateName').textContent = name;
        const bars = {
            'barNational': { val: national, label: 'National Average' },
            'barCurrent': { val: current, label: name === 'National' ? 'National Average' : name },
            'barTop': { val: top, label: 'Top Performer' }
        };

        Object.entries(bars).forEach(([id, config]) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.width = `${config.val}%`;
                el.querySelector('.p-val').textContent = `${config.label}: ${config.val.toFixed(1)}`;
            }
        });
    }

    updateNexusSummary(type, score) {
        const el = document.getElementById(`${type}Summary`);
        if (!el) return;
        let status = score > 80 ? 'Optimal performance detected.' : (score > 50 ? 'Nominal levels.' : 'Critical signal degradation.');
        el.textContent = status;
    }

    async openBriefing() {
        const modal = document.getElementById('briefingModal');
        const body = document.getElementById('briefingBody');
        const target = document.getElementById('briefingTarget');
        
        target.textContent = `Target: ${this.currentState}`;
        modal.classList.add('active');
        
        try {
            const report = await this.api.generateBriefing(this.currentState);
            body.innerHTML = report.sections.map(s => `<div class="briefing-section"><h3>${s.title}</h3><div class="briefing-p">${s.content}</div></div>`).join('');
        } catch (error) {
            body.innerHTML = '<div class="error">Failed to generate briefing.</div>';
        }
    }

    setupEventListeners() {
        document.getElementById('stateFilter').addEventListener('change', (e) => this.drillDownToState(e.target.value));
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshDashboard());
        document.getElementById('rankingType').addEventListener('change', () => this.loadRankings());
        document.getElementById('trendMetric').addEventListener('change', () => this.loadTrends());
        
        const mapSearch = document.getElementById('mapSearch');
        mapSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length > 2) this.performMapSearch(query);
        });

        document.getElementById('mapBreadcrumb').addEventListener('click', (e) => {
            if (e.target.closest('.breadcrumb-item') && !e.target.closest('.active')) this.drillDownToState('National');
        });

        const chatWidget = document.getElementById('aiChat');
        const toggleBtn = document.getElementById('toggleChat');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatWidget.classList.add('minimized');
        });

        chatWidget.addEventListener('click', () => {
            if (chatWidget.classList.contains('minimized')) {
                chatWidget.classList.remove('minimized');
            }
        });

        document.getElementById('sendChat').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendChatMessage(); });

        document.getElementById('generateBriefing').addEventListener('click', () => this.openBriefing());
        document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('briefingModal').classList.remove('active'));

        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.dataset.query;
                document.getElementById('chatInput').value = query;
                this.sendChatMessage();
            });
        });
        
        // Persona Switchers
        document.querySelectorAll('.persona-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setPersona(btn.dataset.persona));
        });
    }

    async sendChatMessage() {
        const input = document.getElementById('chatInput');
        const query = input.value.trim();
        if (!query) return;

        this.addMessageToChat(query, 'user');
        input.value = '';

        try {
            const data = await this.api.sendChatMessage(query);
            this.addMessageToChat(data.response, 'ai');
        } catch (error) {
            console.error('Chat Error:', error);
            this.addMessageToChat('I encountered an error connecting to the server. Please check the backend connection.', 'ai');
        }
    }

    addMessageToChat(text, type) {
        const body = document.getElementById('chatBody');
        const msg = document.createElement('div');
        msg.className = `message ${type}-message`;
        
        // Simple Markdown formatter for bold text
        const formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        msg.innerHTML = formatted;
        
        body.appendChild(msg);
        body.scrollTop = body.scrollHeight;
    }

    async refreshDashboard() {
        this.api.clearCache();
        await this.api.refreshData();
        await this.init();
        this.showMessage('Refreshed!', 'success');
    }

    async performMapSearch(query) {
        try {
            // Search in both state and district data
            const stateData = await this.api.getMapData('state');
            const districtData = await this.api.getMapData('district');
            
            // Find matches in states
            const stateMatch = stateData.find(d => 
                d.state.toLowerCase().includes(query.toLowerCase())
            );
            
            // Find matches in districts
            const districtMatches = districtData.filter(d => 
                d.district.toLowerCase().includes(query.toLowerCase()) ||
                d.state.toLowerCase().includes(query.toLowerCase())
            );
            
            // Create or update search suggestions dropdown
            this.showSearchSuggestions(query, stateData, districtMatches);
            
        } catch (error) {
            console.error('Map search error:', error);
        }
    }
    
    showSearchSuggestions(query, stateData, districtMatches) {
        // Remove existing suggestions
        const existingSuggestions = document.getElementById('map-search-suggestions');
        if (existingSuggestions) {
            existingSuggestions.remove();
        }
        
        if (query.length < 2) return;
        
        // Create suggestions dropdown
        const suggestions = document.createElement('div');
        suggestions.id = 'map-search-suggestions';
        suggestions.style.position = 'absolute';
        suggestions.style.top = '100%';
        suggestions.style.left = '0';
        suggestions.style.right = '0';
        suggestions.style.background = 'white';
        suggestions.style.border = '1px solid #e2e8f0';
        suggestions.style.borderTop = 'none';
        suggestions.style.borderRadius = '0 0 8px 8px';
        suggestions.style.maxHeight = '300px';
        suggestions.style.overflowY = 'auto';
        suggestions.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        suggestions.style.zIndex = '100';
        
        let html = '';
        
        // Add state matches
        const matchingStates = stateData.filter(d => 
            d.state.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
        
        if (matchingStates.length > 0) {
            html += '<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase;">States</div>';
            matchingStates.forEach(state => {
                html += `
                    <div class="search-suggestion-item" data-type="state" data-name="${state.state}" 
                         style="padding: 0.75rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;">
                        <div>
                            <div style="font-weight: 600; color: #1e293b;">${state.state}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">${state.district_count} districts • AGHI: ${state.aghi_score}</div>
                        </div>
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${state.aghi_score > 70 ? '#10b981' : (state.aghi_score > 40 ? '#f59e0b' : '#ef4444')};"></div>
                    </div>
                `;
            });
        }
        
        // Add district matches
        if (districtMatches.length > 0) {
            html += '<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 0.5rem;">Districts</div>';
            districtMatches.slice(0, 8).forEach(district => {
                html += `
                    <div class="search-suggestion-item" data-type="district" data-name="${district.district}" data-state="${district.state}"
                         style="padding: 0.75rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;">
                        <div>
                            <div style="font-weight: 600; color: #1e293b;">${district.district}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">${district.state} • AGHI: ${district.aghi_score}</div>
                        </div>
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${district.aghi_score > 70 ? '#10b981' : (district.aghi_score > 40 ? '#f59e0b' : '#ef4444')};"></div>
                    </div>
                `;
            });
        }
        
        if (html === '') {
            html = '<div style="padding: 1rem; text-align: center; color: #64748b;">No results found</div>';
        }
        
        suggestions.innerHTML = html;
        
        // Position relative to search box
        const searchBox = document.getElementById('mapSearch').parentElement;
        searchBox.style.position = 'relative';
        searchBox.appendChild(suggestions);
        
        // Add click handlers to suggestions
        suggestions.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                e.target.style.background = '#f8fafc';
            });
            item.addEventListener('mouseleave', (e) => {
                e.target.style.background = 'white';
            });
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const name = item.dataset.name;
                const state = item.dataset.state;
                
                if (type === 'state') {
                    this.drillDownToState(name);
                    // Highlight the state on the map
                    setTimeout(() => this.highlightLocation(name, 'state'), 300);
                } else {
                    // For district, first drill to state, then show district details
                    this.drillDownToState(state);
                    setTimeout(() => {
                        // Find and show the district details
                        const districtData = districtMatches.find(d => d.district === name);
                        if (districtData) {
                            this.showLocationDetails({
                                name: districtData.district,
                                score: districtData.aghi_score,
                                status: districtData.performance_category,
                                success: districtData.success_rate || 0,
                                pending: districtData.pending_ratio || 0,
                                updates: (districtData.total_updates || 0).toLocaleString()
                            });
                            // Highlight the district on the map
                            this.highlightLocation(name, 'district');
                        }
                    }, 500);
                }
                
                suggestions.remove();
                document.getElementById('mapSearch').value = '';
            });
        });
        
        // Close suggestions when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeSearchSuggestions(e) {
                if (!e.target.closest('#mapSearch') && !e.target.closest('#map-search-suggestions')) {
                    const sugg = document.getElementById('map-search-suggestions');
                    if (sugg) sugg.remove();
                    document.removeEventListener('click', closeSearchSuggestions);
                }
            });
        }, 100);
    }
    
    highlightLocation(locationName, type) {
        // Remove any existing highlight
        const existingHighlight = document.getElementById('map-location-highlight');
        if (existingHighlight) {
            existingHighlight.remove();
        }
        
        // Get the map element
        const mapElement = document.getElementById('indiaMap');
        if (!mapElement) return;
        
        // Create a highlight overlay
        const highlight = document.createElement('div');
        highlight.id = 'map-location-highlight';
        highlight.style.position = 'absolute';
        highlight.style.top = '0';
        highlight.style.left = '0';
        highlight.style.width = '100%';
        highlight.style.height = '100%';
        highlight.style.pointerEvents = 'none';
        highlight.style.zIndex = '10';
        highlight.style.display = 'flex';
        highlight.style.alignItems = 'center';
        highlight.style.justifyContent = 'center';
        
        // Create pulsing circle effect
        highlight.innerHTML = `
            <div style="position: relative; width: 200px; height: 200px;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            width: 100%; height: 100%; border-radius: 50%; 
                            background: radial-gradient(circle, rgba(37, 99, 235, 0.3) 0%, rgba(37, 99, 235, 0) 70%);
                            animation: pulse-heatmap 2s ease-out infinite;"></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            width: 60%; height: 60%; border-radius: 50%; 
                            background: radial-gradient(circle, rgba(37, 99, 235, 0.5) 0%, rgba(37, 99, 235, 0) 70%);
                            animation: pulse-heatmap 2s ease-out infinite 0.3s;"></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            width: 30%; height: 30%; border-radius: 50%; 
                            background: rgba(37, 99, 235, 0.8);
                            box-shadow: 0 0 20px rgba(37, 99, 235, 0.6);
                            animation: pulse-heatmap 2s ease-out infinite 0.6s;"></div>
            </div>
        `;
        
        // Add CSS animation if not already present
        if (!document.getElementById('heatmap-animation-style')) {
            const style = document.createElement('style');
            style.id = 'heatmap-animation-style';
            style.textContent = `
                @keyframes pulse-heatmap {
                    0% {
                        transform: translate(-50%, -50%) scale(0.8);
                        opacity: 0;
                    }
                    50% {
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1.5);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        mapElement.style.position = 'relative';
        mapElement.appendChild(highlight);
        
        // Show location name banner
        const banner = document.createElement('div');
        banner.style.position = 'absolute';
        banner.style.top = '1rem';
        banner.style.left = '50%';
        banner.style.transform = 'translateX(-50%)';
        banner.style.background = 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)';
        banner.style.color = 'white';
        banner.style.padding = '0.75rem 1.5rem';
        banner.style.borderRadius = '999px';
        banner.style.fontWeight = '700';
        banner.style.fontSize = '0.9rem';
        banner.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        banner.style.zIndex = '20';
        banner.style.animation = 'slideDown 0.3s ease-out';
        banner.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${locationName}`;
        
        // Add slide down animation
        if (!document.getElementById('banner-animation-style')) {
            const style = document.createElement('style');
            style.id = 'banner-animation-style';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        transform: translateX(-50%) translateY(-20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        mapElement.appendChild(banner);
        
        // Remove highlight and banner after 3 seconds
        setTimeout(() => {
            if (highlight.parentElement) {
                highlight.style.opacity = '0';
                highlight.style.transition = 'opacity 0.5s';
                setTimeout(() => highlight.remove(), 500);
            }
            if (banner.parentElement) {
                banner.style.opacity = '0';
                banner.style.transition = 'opacity 0.5s';
                setTimeout(() => banner.remove(), 500);
            }
        }, 3000);
    }

    startAutoRefresh() {
        setInterval(() => { if (document.visibilityState === 'visible') this.refreshDashboard(); }, 5 * 60 * 1000);
    }

    showMessage(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    showError(message) { this.showMessage(message, 'error'); }

    formatVal(val) {
        if (val === undefined || val === null || isNaN(val)) return 0;
        return Number.isInteger(val) ? val : val.toFixed(1);
    }

    /* AI Assistant Logic */
    toggleChat() {
        const chatWindow = document.getElementById('aiChatWindow');
        chatWindow.classList.toggle('active');
        if (chatWindow.classList.contains('active')) {
            document.getElementById('chatInput').focus();
        }
    }

    handleSuggestion(text) {
        const input = document.getElementById('chatInput');
        input.value = text;
        this.handleChat();
    }

    async handleChat() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        input.value = '';

        // Show typing indicator
        const typingId = this.addMessage('...', 'bot typing');

        try {
            // Call Backend API
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();

            // Clear typing
            document.querySelector('.chat-msg.typing')?.remove();
            
            // Show Response
            this.addMessage(data.response, 'bot');

            // Handle Actions
            if (data.action) {
                if (data.action === 'state') this.setPersona('state');
                if (data.action === 'national') this.setPersona('national');
                if (data.action === 'report') document.getElementById('generateBriefing').click();
            }

        } catch (err) {
            console.error(err);
            document.querySelector('.chat-msg.typing')?.remove();
            this.addMessage("Connection to AI Core disrupted. Running in offline mode.", 'error');
        }
    }

    addMessage(text, type) {
        const body = document.getElementById('chatBody');
        const msg = document.createElement('div');
        msg.className = `chat-msg ${type}`;
        msg.textContent = text;
        body.appendChild(msg);
        body.scrollTop = body.scrollHeight;
        return msg;
    }
}

// Expose to window for inline HTML onclick handlers
window.dashboard = null;
document.addEventListener('DOMContentLoaded', () => { window.dashboard = new DashboardManager(); });