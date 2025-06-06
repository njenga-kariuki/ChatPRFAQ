// Reporting Dashboard JavaScript

// Global state
let currentPage = 1;
let charts = {};

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadUsageAnalytics(); // Load default tab data
});

// Tab Management
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Load data for the active tab
            switch(targetTab) {
                case 'usage':
                    loadUsageAnalytics();
                    break;
                case 'ideas':
                    loadIdeasList();
                    break;
                case 'analytics':
                    loadAnalyticsDashboard();
                    break;
            }
        });
    });
}

// Utility Functions
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('error').classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${(seconds/60).toFixed(1)}m`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
}

function formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString();
}

// API Functions
async function apiCall(endpoint, params = {}) {
    try {
        const url = new URL(endpoint, window.location.origin);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== '') {
                url.searchParams.append(key, params[key]);
            }
        });
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data.data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Usage Analytics Functions
async function loadUsageAnalytics() {
    try {
        showLoading();
        
        const params = {
            start_date: document.getElementById('usageStartDate').value,
            end_date: document.getElementById('usageEndDate').value,
            granularity: document.getElementById('usageGranularity').value
        };
        
        const data = await apiCall('/api/reporting/usage', params);
        
        renderUsageKPIs(data.summary);
        renderTrendsChart(data.daily_trends);
        renderStepPerformanceTable(data.step_analytics);
        
    } catch (error) {
        showError(`Failed to load usage analytics: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function renderUsageKPIs(summary) {
    document.getElementById('totalSessions').textContent = formatNumber(summary.total_sessions);
    document.getElementById('successRate').textContent = `${summary.success_rate.toFixed(1)}%`;
    document.getElementById('avgDuration').textContent = formatDuration(summary.avg_duration_seconds);
    document.getElementById('completedSessions').textContent = formatNumber(summary.completed_sessions);
}

function renderTrendsChart(trends) {
    const ctx = document.getElementById('trendsChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (charts.trends) {
        charts.trends.destroy();
    }
    
    const labels = trends.map(t => t.date).reverse();
    const sessionData = trends.map(t => t.sessions).reverse();
    const completedData = trends.map(t => t.completed).reverse();
    
    charts.trends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Sessions',
                data: sessionData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }, {
                label: 'Completed Sessions',
                data: completedData,
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderStepPerformanceTable(stepAnalytics) {
    const tbody = document.querySelector('#stepPerformanceTable tbody');
    tbody.innerHTML = '';
    
    stepAnalytics.forEach(step => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${step.step_id}</td>
            <td>${step.step_name}</td>
            <td>${formatNumber(step.executions)}</td>
            <td>${formatDuration(step.avg_duration_seconds)}</td>
            <td>${formatNumber(step.total_tokens)}</td>
            <td>$${(step.total_cost || 0).toFixed(4)}</td>
        `;
    });
}

// Ideas Management Functions
async function loadIdeasList(page = 1) {
    try {
        showLoading();
        currentPage = page;
        
        const params = {
            page: page,
            limit: document.getElementById('ideasLimit').value,
            status: document.getElementById('ideasStatus').value,
            search: document.getElementById('ideasSearch').value
        };
        
        const data = await apiCall('/api/reporting/ideas', params);
        
        renderIdeasTable(data.ideas);
        renderPagination(data.pagination, 'ideasPagination', loadIdeasList);
        
    } catch (error) {
        showError(`Failed to load ideas: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function renderIdeasTable(ideas) {
    const tbody = document.querySelector('#ideasTable tbody');
    tbody.innerHTML = '';
    
    if (ideas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6b7280;">No ideas found. Process some ideas to see data here.</td></tr>';
        return;
    }
    
    ideas.forEach(idea => {
        const row = tbody.insertRow();
        const statusClass = `status-${idea.status}`;
        
        row.innerHTML = `
            <td><code>${idea.request_id}</code></td>
            <td title="${idea.idea_preview}">${idea.idea_preview}</td>
            <td><span class="${statusClass}">${idea.status.toUpperCase()}</span></td>
            <td>${formatDate(idea.created_at)}</td>
            <td>${formatDuration(idea.duration_seconds)}</td>
            <td>
                <button onclick="viewSession('${idea.request_id}')" class="btn-secondary" style="padding: 4px 8px; font-size: 12px;">
                    View Details
                </button>
            </td>
        `;
    });
}

function renderPagination(pagination, containerId, loadFunction) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (pagination.total_pages <= 1) return;
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = !pagination.has_prev;
    prevBtn.onclick = () => loadFunction(pagination.page - 1);
    container.appendChild(prevBtn);
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.total_pages, pagination.page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === pagination.page ? 'active' : '';
        pageBtn.onclick = () => loadFunction(i);
        container.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = !pagination.has_next;
    nextBtn.onclick = () => loadFunction(pagination.page + 1);
    container.appendChild(nextBtn);
}

// Session Details Functions
async function loadSessionDetails() {
    const requestId = document.getElementById('sessionRequestId').value.trim();
    if (!requestId) {
        showError('Please enter a request ID');
        return;
    }
    
    try {
        showLoading();
        const data = await apiCall(`/api/reporting/session/${requestId}`);
        renderSessionDetails(data);
    } catch (error) {
        showError(`Failed to load session details: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function viewSession(requestId) {
    // Switch to session tab
    document.querySelector('[data-tab="session"]').click();
    // Set the request ID and load
    document.getElementById('sessionRequestId').value = requestId;
    loadSessionDetails();
}

function renderSessionDetails(data) {
    const container = document.getElementById('sessionContent');
    const { session, steps, insights } = data;
    
    container.innerHTML = `
        <div class="session-card">
            <div class="session-header">
                <h3>Session Details: ${session.request_id}</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 16px;">
                    <div><strong>Status:</strong> <span class="status-${session.status}">${session.status.toUpperCase()}</span></div>
                    <div><strong>Created:</strong> ${formatDate(session.created_at)}</div>
                    <div><strong>Duration:</strong> ${formatDuration(session.total_duration_seconds)}</div>
                    <div><strong>Completed:</strong> ${formatDate(session.completed_at)}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4>Original Idea:</h4>
                <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #3b82f6; margin-top: 8px;">
                    ${session.original_idea}
                </div>
            </div>
            
            <div>
                <h4>Processing Steps (${steps.length}):</h4>
                <div id="stepsContainer">
                    ${steps.map(step => renderStepItem(step)).join('')}
                </div>
            </div>
            
            ${insights.length > 0 ? `
                <div style="margin-top: 24px;">
                    <h4>Extracted Insights (${insights.length}):</h4>
                    ${insights.map(insight => `
                        <div class="step-item" style="border-left-color: #8b5cf6;">
                            <strong>${insight.insight_label || `Step ${insight.step_id} Insight`}:</strong>
                            <div style="margin-top: 8px;">${insight.insight_text}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    // Add click handlers for collapsible sections
    addCollapsibleHandlers();
}

function renderStepItem(step) {
    const statusClass = step.output_text ? 'completed' : 'failed';
    return `
        <div class="step-item ${statusClass}">
            <div class="step-header">
                <div>
                    <div class="step-title">Step ${step.step_id}: ${step.step_name}</div>
                    <div class="step-duration">${formatDuration(step.duration_seconds)} • ${step.model_used || 'N/A'}</div>
                </div>
            </div>
            
            ${step.output_text ? `
                <div class="collapsible" onclick="toggleCollapsible(this)">
                    📄 View Output ▼
                </div>
                <div class="collapsible-content">
                    <div style="white-space: pre-wrap; font-family: system-ui;">${step.output_text}</div>
                </div>
            ` : ''}
            
            ${step.raw_llm_output ? `
                <div class="collapsible" onclick="toggleCollapsible(this)" style="margin-top: 8px;">
                    🔧 View Raw LLM Output ▼
                </div>
                <div class="collapsible-content">
                    <div style="white-space: pre-wrap; font-family: monospace; font-size: 0.9em; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 4px; overflow-x: auto;">${step.raw_llm_output}</div>
                </div>
            ` : ''}
        </div>
    `;
}

function addCollapsibleHandlers() {
    // Collapsible handlers are set via onclick in the HTML
}

function toggleCollapsible(element) {
    const content = element.nextElementSibling;
    const isVisible = content.classList.contains('show');
    
    if (isVisible) {
        content.classList.remove('show');
        element.innerHTML = element.innerHTML.replace('▲', '▼');
    } else {
        content.classList.add('show');
        element.innerHTML = element.innerHTML.replace('▼', '▲');
    }
}

// Analytics Dashboard Functions
async function loadAnalyticsDashboard() {
    try {
        showLoading();
        
        const timeframe = document.getElementById('analyticsTimeframe').value;
        const data = await apiCall('/api/reporting/analytics', { timeframe });
        
        renderAnalyticsKPIs(data);
        renderPerformanceChart(data.step_performance);
        renderSuccessChart(data.trends);
        
    } catch (error) {
        showError(`Failed to load analytics dashboard: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function renderAnalyticsKPIs(data) {
    const container = document.getElementById('analyticsKpis');
    const metrics = data.computed_metrics || {};
    
    container.innerHTML = `
        <div class="kpi-card">
            <h3>Success Rate</h3>
            <div class="kpi-value">${metrics.success_rate_percentage || 0}%</div>
        </div>
        <div class="kpi-card">
            <h3>Avg Duration</h3>
            <div class="kpi-value">${metrics.avg_duration_minutes || 0}m</div>
        </div>
        <div class="kpi-card">
            <h3>Sessions/Day</h3>
            <div class="kpi-value">${metrics.sessions_per_day || 0}</div>
        </div>
        <div class="kpi-card">
            <h3>Fastest Step</h3>
            <div class="kpi-value" style="font-size: 1.2rem;">${metrics.fastest_step || 'N/A'}</div>
        </div>
    `;
}

function renderPerformanceChart(stepPerformance) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    if (charts.performance) {
        charts.performance.destroy();
    }
    
    const labels = stepPerformance.map(step => `Step ${step.step_id}`);
    const durations = stepPerformance.map(step => step.avg_duration_seconds || 0);
    
    charts.performance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Avg Duration (seconds)',
                data: durations,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: '#3b82f6',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderSuccessChart(trends) {
    const ctx = document.getElementById('successChart').getContext('2d');
    
    if (charts.success) {
        charts.success.destroy();
    }
    
    const labels = trends.slice(-7).map(t => t.date); // Last 7 days
    const successRates = trends.slice(-7).map(t => 
        t.sessions > 0 ? (t.completed / t.sessions * 100) : 0
    );
    
    charts.success = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Success Rate (%)',
                data: successRates,
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Event Handlers for Enter key support
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const activeTab = document.querySelector('.tab-content.active').id;
        
        switch(activeTab) {
            case 'ideas':
                if (e.target.closest('#ideas')) {
                    loadIdeasList(1);
                }
                break;
            case 'session':
                if (e.target.id === 'sessionRequestId') {
                    loadSessionDetails();
                }
                break;
        }
    }
}); 