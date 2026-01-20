// Premium Chart utilities for the AGHI Dashboard
class ChartManager {
    constructor() {
        this.charts = {};
        this.theme = {
            primary: '#60a5fa',
            secondary: '#10b981',
            accent: '#f59e0b',
            danger: '#ef4444',
            bg: 'rgba(15, 23, 42, 0.8)',
            grid: 'rgba(255, 255, 255, 0.05)',
            text: '#94a3b8'
        };
        
        // Setting global Chart.js defaults for Dark Theme
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = this.theme.text;
            Chart.defaults.borderColor = this.theme.grid;
            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
            Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
            Chart.defaults.plugins.tooltip.borderWidth = 1;
            Chart.defaults.plugins.tooltip.padding = 12;
            Chart.defaults.plugins.tooltip.cornerRadius = 8;
        }
    }

    createLineChart(containerId, data, options = {}) {
        const config = {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: options.label || 'Data',
                    data: data.values || [],
                    borderColor: options.color || this.theme.primary,
                    backgroundColor: options.fillColor || 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 3,
                    fill: options.fill || true,
                    tension: options.tension || 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: options.color || this.theme.primary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: options.showLegend !== false,
                        labels: { usePointStyle: true, padding: 20 }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        beginAtZero: options.beginAtZero || false,
                        grid: { color: this.theme.grid }
                    }
                }
            }
        };

        const ctx = document.getElementById(containerId).getContext('2d');
        if (this.charts[containerId]) this.charts[containerId].destroy();
        this.charts[containerId] = new Chart(ctx, config);
        return this.charts[containerId];
    }

    createBarChart(containerId, data, options = {}) {
        const config = {
            type: 'bar',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: options.label || 'Data',
                    data: data.values || [],
                    backgroundColor: data.colors || options.color || 'rgba(96, 165, 250, 0.6)',
                    borderColor: options.borderColor || this.theme.primary,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: options.showLegend !== false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        beginAtZero: options.beginAtZero || true,
                        grid: { color: this.theme.grid }
                    }
                }
            }
        };

        const ctx = document.getElementById(containerId).getContext('2d');
        if (this.charts[containerId]) this.charts[containerId].destroy();
        this.charts[containerId] = new Chart(ctx, config);
        return this.charts[containerId];
    }

    createPieChart(containerId, data, options = {}) {
        const config = {
            type: 'pie',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: data.colors || [
                        '#60a5fa', '#10b981', '#8b5cf6', 
                        '#f59e0b', '#ef4444', '#64748b'
                    ],
                    borderWidth: 2,
                    borderColor: 'rgba(15, 23, 42, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: options.legendPosition || 'bottom',
                        labels: { usePointStyle: true, padding: 15 }
                    }
                }
            }
        };

        const ctx = document.getElementById(containerId).getContext('2d');
        if (this.charts[containerId]) this.charts[containerId].destroy();
        this.charts[containerId] = new Chart(ctx, config);
        return this.charts[containerId];
    }

    createHeatmap(containerId, data, options = {}) {
        const trace = {
            z: data.values,
            x: data.xLabels,
            y: data.yLabels,
            type: 'heatmap',
            colorscale: options.colorscale || [
                [0, 'rgba(15, 23, 42, 1)'],
                [0.5, '#3b82f6'],
                [1, '#10b981']
            ],
            showscale: options.showScale !== false,
            hoverongaps: false
        };

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: this.theme.text, family: 'Inter' },
            xaxis: { gridcolor: this.theme.grid, zeroline: false },
            yaxis: { gridcolor: this.theme.grid, zeroline: false },
            margin: { l: 80, r: 20, t: 40, b: 60 }
        };

        Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
    }

    updateChart(containerId, newData) {
        const chart = this.charts[containerId];
        if (!chart) return;
        if (newData.labels) chart.data.labels = newData.labels;
        if (newData.values) chart.data.datasets[0].data = newData.values;
        if (newData.datasets) chart.data.datasets = newData.datasets;
        chart.update();
    }

    destroyChart(containerId) {
        if (this.charts[containerId]) {
            this.charts[containerId].destroy();
            delete this.charts[containerId];
        }
    }

    getColor(index) {
        const colors = ['#60a5fa', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#14b8a6', '#f97316'];
        return colors[index % colors.length];
    }

    createComparisonChart(containerId, comparisons, options = {}) {
        const datasets = comparisons.map((item, index) => ({
            label: item.name,
            data: item.values,
            backgroundColor: this.getColor(index),
            borderColor: this.getColor(index),
            borderWidth: 0,
            borderRadius: 4
        }));

        const config = {
            type: 'bar',
            data: {
                labels: options.labels || [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true } }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: this.theme.grid } }
                }
            }
        };

        const ctx = document.getElementById(containerId).getContext('2d');
        if (this.charts[containerId]) this.charts[containerId].destroy();
        this.charts[containerId] = new Chart(ctx, config);
        return this.charts[containerId];
    }

    createTrendWithConfidence(containerId, data, options = {}) {
        const traces = [
            {
                x: data.dates,
                y: data.values,
                mode: 'lines+markers',
                name: 'Historical',
                line: { color: this.theme.primary, width: 3 },
                marker: { size: 6, color: '#fff', line: { width: 2, color: this.theme.primary } }
            },
            {
                x: data.forecastDates,
                y: data.forecastValues,
                mode: 'lines',
                name: 'AI Forecast',
                line: { color: this.theme.secondary, width: 3, dash: 'dash' }
            },
            {
                x: [...data.forecastDates].reverse().concat(data.forecastDates),
                y: [...data.upperBounds].reverse().concat(data.lowerBounds),
                fill: 'toself',
                fillcolor: 'rgba(16, 185, 129, 0.1)',
                line: { color: 'transparent' },
                name: 'Confidence Range',
                showlegend: true
            }
        ];

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: this.theme.text, family: 'Inter' },
            xaxis: { gridcolor: this.theme.grid, zeroline: false },
            yaxis: { gridcolor: this.theme.grid, zeroline: false },
            legend: { orientation: 'h', y: 1.1, x: 0.5, xanchor: 'center' },
            margin: { l: 40, r: 20, t: 30, b: 40 }
        };

        Plotly.newPlot(containerId, traces, layout, { responsive: true, displayModeBar: false });
    }
}

const chartManager = new ChartManager();
