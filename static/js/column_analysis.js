document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentDatasetId = null;
    let currentColumns = []; // Stores { name: 'col_name', type: 'dtype' }
    let currentColumn = null; // Stores the selected column's full info object

    // DOM Elements
    const datasetSelect = document.getElementById('column-dataset-select');
    const refreshButton = document.getElementById('refresh-column-datasets');
    const columnSelector = document.getElementById('column-selector');
    const columnSelect = document.getElementById('column-select');
    const analyzeColumnBtn = document.getElementById('analyze-column');
    const columnOverview = document.getElementById('column-overview');
    const analysisTabs = document.getElementById('analysis-tabs');
    const columnActions = document.getElementById('column-actions');
    const loadingModal = document.getElementById('column-loading-modal');

    // Tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Initialize
    loadDatasets();
    setupEventListeners();
    
    // Utility function to safely format numbers
    function safeFormat(value, decimals = 3) {
        if (value === null || value === undefined || isNaN(value)) {
            return 'N/A';
        }
        return typeof value === 'number' ? value.toFixed(decimals) : value;
    }

    function setupEventListeners() {
        refreshButton.addEventListener('click', loadDatasets);
        datasetSelect.addEventListener('change', handleDatasetSelection);
        columnSelect.addEventListener('change', handleColumnSelection); // Added for when column is selected
        analyzeColumnBtn.addEventListener('click', analyzeColumn);

        // Tab switching
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                switchTab(tabName);
            });
        });

        // Analysis buttons - These will trigger specific API calls within analyzeColumn or separate handlers
        document.getElementById('transform-column').addEventListener('click', () => showMessage('Transform options', 'info'));
        document.getElementById('clean-column').addEventListener('click', () => showMessage('Cleaning options', 'info'));
        document.getElementById('encode-column').addEventListener('click', () => showMessage('Encoding options', 'info'));
        document.getElementById('export-analysis').addEventListener('click', () => showMessage('Export analysis', 'info'));

        // Relationship analysis
        document.getElementById('analyze-relationship').addEventListener('click', analyzeRelationship);

        // Distribution buttons
        document.getElementById('show-histogram').addEventListener('click', () => showDistribution('histogram'));
        document.getElementById('show-boxplot').addEventListener('click', () => showDistribution('boxplot'));
        document.getElementById('show-value-counts').addEventListener('click', () => showDistribution('value_counts'));
    }

    async function loadDatasets() {
        showLoading();
        try {
            const response = await fetch('/api/data/datasets'); // Or your unified endpoint
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            datasetSelect.innerHTML = '<option value="">Choose a dataset...</option>';
            if (data.success && data.datasets) {
                data.datasets.forEach(dataset => {
                    const option = document.createElement('option');
                    option.value = dataset.id;
                    // Assuming dataset object has 'name' or 'filename' property
                    option.textContent = `${dataset.filename || dataset.name} (${dataset.rows} rows, ${dataset.columns} cols)`;
                    datasetSelect.appendChild(option);
                });
            } else {
                showError('No datasets found. Please upload a dataset.');
            }
        } catch (error) {
            console.error('Error loading datasets:', error);
            showError('Failed to load datasets. Please check your connection.');
        } finally {
            hideLoading();
        }
    }

    async function handleDatasetSelection() {
        const selectedId = datasetSelect.value;

        if (!selectedId) {
            columnSelector.style.display = 'none';
            hideAnalysisUI();
            currentDatasetId = null;
            currentColumns = [];
            columnSelect.innerHTML = '<option value="">Choose a column...</option>'; // Clear column select
            return;
        }

        currentDatasetId = selectedId;
        await loadDatasetColumns(selectedId);
        columnSelector.style.display = 'block';
        hideAnalysisUI(); // Hide previous analysis when dataset changes
    }

    async function loadDatasetColumns(datasetId) {
        showLoading();
        try {
            // Fetch columns for the selected dataset
            const response = await fetch(`/api/data/columns/${datasetId}`); // Adjust endpoint if needed
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (data.success && data.columns) {
                currentColumns = data.columns; // Store column names and types
                populateColumnSelect(data.columns);
            } else {
                throw new Error(data.error || 'Failed to load columns');
            }
        } catch (error) {
            console.error('Error loading columns:', error);
            showError('Failed to load dataset columns: ' + error.message);
            currentColumns = []; // Clear columns on error
            columnSelect.innerHTML = '<option value="">Choose a column...</option>';
        } finally {
            hideLoading();
        }
    }

    function populateColumnSelect(columns) {
        columnSelect.innerHTML = '<option value="">Choose a column...</option>';
        const compareSelect = document.getElementById('compare-column');
        if (compareSelect) {
            compareSelect.innerHTML = '<option value="">Select column to compare...</option>';
        }

        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column.name;
            option.textContent = `${column.name} (${column.type})`;
            columnSelect.appendChild(option);

            if (compareSelect) {
                const compareOption = document.createElement('option');
                compareOption.value = column.name;
                compareOption.textContent = column.name;
                compareSelect.appendChild(compareOption);
            }
        });
    }

    async function handleColumnSelection() {
        const selectedColumnName = columnSelect.value;
        if (!selectedColumnName || !currentColumns) {
            hideAnalysisUI();
            currentColumn = null;
            return;
        }
        // Find the full column object from our cached list
        currentColumn = currentColumns.find(col => col.name === selectedColumnName);
        // Optionally, you could fetch more detailed column info here if needed
        // For now, we'll assume currentColumns contains enough basic info
        if (currentColumn) {
            displayColumnOverview(currentColumn); // Display basic info immediately
            analysisTabs.style.display = 'block'; // Show tabs for analysis
            columnActions.style.display = 'block';
        } else {
            hideAnalysisUI();
            currentColumn = null;
        }
    }

    async function analyzeColumn() {
        if (!currentDatasetId || !columnSelect.value) {
            showError('Please select a dataset and a column to analyze.');
            return;
        }

        const selectedColumnName = columnSelect.value;
        currentColumn = currentColumns.find(col => col.name === selectedColumnName);

        if (!currentColumn) {
            showError('Selected column not found in current dataset.');
            return;
        }

        showLoading();

        try {
            // Fetch comprehensive summary first, which will likely include stats and quality
            // The structure of the response from your backend will dictate how you parse this.
            // Assuming a single endpoint returning a detailed analysis object for the column.
            // Let's use /api/column_analysis/summary/<dataset_id>?column=<column_name>
            const response = await fetch(`/api/column_analysis/summary/${currentDatasetId}?column=${encodeURIComponent(selectedColumnName)}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.summary) {
                const analysis = data.summary; // The comprehensive summary object

                // Update Column Overview
                displayColumnOverview(analysis); // Pass the full analysis object

                // Populate different analysis sections based on the API response
                displayBasicStats(analysis.basic_statistics);
                displayDistribution(analysis.distribution_summary, analysis.data_type); // Pass data_type to handle numeric/categorical
                displayPatterns(analysis.insights); // Using insights as a placeholder for patterns
                displayQuality(analysis.quality_metrics); // Assuming quality_metrics is a dict

                columnOverview.style.display = 'block';
                analysisTabs.style.display = 'block';
                columnActions.style.display = 'block';

            } else {
                throw new Error(data.error || 'Failed to analyze column');
            }

        } catch (error) {
            console.error('Error analyzing column:', error);
            showError('Failed to analyze column: ' + error.message);
            hideAnalysisUI(); // Hide UI if analysis fails
        } finally {
            hideLoading();
        }
    }

    function displayColumnOverview(columnInfo) {
        // Use the fetched analysis data, not mock data
        document.getElementById('column-name').textContent = columnInfo.column_name || '-';
        document.getElementById('column-type').textContent = columnInfo.data_type || '-';

        // Assuming basic_statistics contains these values
        const basicStats = columnInfo.basic_statistics || {};
        document.getElementById('non-null-count').textContent = basicStats.non_null_count ? basicStats.non_null_count.toLocaleString() : '-';
        const missingPercentage = safeFormat(basicStats.null_percentage, 1) !== 'N/A' ? safeFormat(basicStats.null_percentage, 1) : '-';
        document.getElementById('missing-values').textContent = `${basicStats.null_count ? basicStats.null_count.toLocaleString() : '-'} (${missingPercentage}%)`;
        document.getElementById('unique-values').textContent = basicStats.unique_count ? basicStats.unique_count.toLocaleString() : '-';
        document.getElementById('memory-usage').textContent = basicStats.memory_usage ? formatBytes(basicStats.memory_usage) : '-';
    }

    function displayBasicStats(stats) {
        const container = document.getElementById('basic-stats-content');
        container.innerHTML = ''; // Clear previous content

        if (!stats) {
            container.innerHTML = '<p>No descriptive statistics available.</p>';
            return;
        }

        let html = '';
        if (currentColumn && currentColumn.type && (currentColumn.type.toLowerCase().includes('int') || currentColumn.type.toLowerCase().includes('float'))) { // Numeric
            html += '<div class="stats-grid">';
            html += `
                <div class="stat-item">
                    <strong>MEAN</strong>
                    <span>${safeFormat(stats.mean)}</span>
                </div>
                <div class="stat-item">
                    <strong>MEDIAN</strong>
                    <span>${safeFormat(stats.median)}</span>
                </div>
                <div class="stat-item">
                    <strong>STD DEV</strong>
                    <span>${safeFormat(stats.std)}</span>
                </div>
                <div class="stat-item">
                    <strong>MIN</strong>
                    <span>${safeFormat(stats.min)}</span>
                </div>
                <div class="stat-item">
                    <strong>MAX</strong>
                    <span>${safeFormat(stats.max)}</span>
                </div>
                <div class="stat-item">
                    <strong>IQR</strong>
                    <span>${safeFormat(stats.iqr)}</span>
                </div>
                <div class="stat-item">
                    <strong>SKEWNESS</strong>
                    <span>${safeFormat(stats.skewness)}</span>
                </div>
                <div class="stat-item">
                    <strong>KURTOSIS</strong>
                    <span>${safeFormat(stats.kurtosis)}</span>
                </div>
            `;
            html += '</div>';
        } else if (currentColumn && currentColumn.type && (currentColumn.type === 'object' || currentColumn.type.toLowerCase().includes('category'))) { // Categorical
            html += '<div class="category-stats">';
            html += `
                <div class="stat-item">
                    <strong>UNIQUE VALUES</strong>
                    <span>${stats.unique_values ? stats.unique_values.toLocaleString() : 'N/A'}</span>
                </div>
                <div class="stat-item">
                    <strong>MOST FREQUENT</strong>
                    <span>${stats.most_frequent || 'N/A'}</span>
                </div>
                <div class="stat-item">
                    <strong>FREQUENCY</strong>
                    <span>${stats.most_frequent_count ? stats.most_frequent_count.toLocaleString() : 'N/A'}</span>
                </div>
            `;
            html += '<h5>Value Counts:</h5>';
            html += '<div class="value-counts">';
            if (stats.value_counts) {
                for (const [value, count] of Object.entries(stats.value_counts)) {
                    const percentage = (count / (stats.count || 1) * 100).toFixed(1); // Use total count from basic stats
                    html += `
                        <div class="value-count-item">
                            <span class="value">${value}</span>
                            <span class="count">${count} (${percentage}%)</span>
                        </div>
                    `;
                }
            } else {
                html += '<p>No detailed value counts available.</p>';
            }
            html += '</div>'; // Close value-counts
            html += '</div>'; // Close category-stats
        } else {
            html = '<p>No specific statistics available for this data type.</p>';
        }

        container.innerHTML = html;
    }

    function displayDistribution(distributionData, dataType) {
        const container = document.getElementById('distribution-content');
        container.innerHTML = ''; // Clear previous content

        if (!distributionData || Object.keys(distributionData).length === 0) {
            container.innerHTML = '<p>Distribution data not available.</p>';
            return;
        }

        // Logic to display based on distributionData content and dataType
        // This would ideally call specific chart rendering functions.
        // For now, we'll use placeholders as in your original JS.
        // The actual charts would need a charting library (e.g., Chart.js, Plotly.js)
        // and data structured for those libraries.

        // Example: Displaying some key distribution info if available
        let html = '<div class="chart-placeholder">';
        if (dataType && (dataType.toLowerCase().includes('int') || dataType.toLowerCase().includes('float'))) {
            html += `<p><strong>Mean:</strong> ${safeFormat(distributionData.mean)}</p>`;
            html += `<p><strong>Median:</strong> ${safeFormat(distributionData.median)}</p>`;
            html += `<p><strong>Skewness:</strong> ${safeFormat(distributionData.skewness)}</p>`;
        } else { // Categorical
            html += `<p><strong>Unique Values:</strong> ${distributionData.unique_values ?? 'N/A'}</p>`;
            html += `<p><strong>Most Frequent:</strong> ${distributionData.most_frequent || 'N/A'}</p>`;
        }
        html += '<p>Visualizations (Histogram, Box Plot, Value Counts) would appear here.</p>';
        html += '</div>';
        container.innerHTML = html;
    }

    function displayPatterns(insights) {
        const valuePatternsContainer = document.getElementById('value-patterns');
        const outlierDetectionContainer = document.getElementById('outlier-detection');
        const trendsAnalysisContainer = document.getElementById('trends-analysis');

        valuePatternsContainer.innerHTML = '<p>No specific pattern analysis performed.</p>';
        outlierDetectionContainer.innerHTML = '<p>No specific outlier detection performed.</p>';
        trendsAnalysisContainer.innerHTML = '<p>No specific trend analysis performed.</p>';

        // If insights array is populated from backend, display it.
        if (insights && insights.length > 0) {
            // Basic display, would need more structured data from backend for specific sections
            valuePatternsContainer.innerHTML = insights.map(insight => `<p>${insight}</p>`).join('');
        }
        // For more specific sections like outliers and trends, you'd need to fetch those separately
        // or ensure the backend returns structured data for them.
        // E.g., fetch outliers:
        fetchOutlierInfo();
        fetchTrendInfo(); // If applicable
    }

    function displayQuality(qualityMetrics) {
        const completenessContainer = document.getElementById('completeness-analysis');
        const consistencyContainer = document.getElementById('consistency-analysis');
        const validityContainer = document.getElementById('validity-analysis');

        // Assuming qualityMetrics is an object like { completeness: { score: 90, description: '...' }, ... }
        if (qualityMetrics) {
            completenessContainer.innerHTML = renderQualityMetric(qualityMetrics.completeness, 'good'); // Need to map score ranges to classes
            consistencyContainer.innerHTML = renderQualityMetric(qualityMetrics.consistency, 'fair'); // Placeholder
            validityContainer.innerHTML = renderQualityMetric(qualityMetrics.validity, 'good'); // Placeholder
        } else {
            completenessContainer.innerHTML = '<p>Quality metrics unavailable.</p>';
            consistencyContainer.innerHTML = '<p>Quality metrics unavailable.</p>';
            validityContainer.innerHTML = '<p>Quality metrics unavailable.</p>';
        }
    }

    function renderQualityMetric(metric, defaultClass) {
        if (!metric) return '<div class="quality-metric"><div class="metric-score">N/A</div><p>Data Unavailable</p></div>';

        const score = metric.score;
        let classToApply = defaultClass; // Default class if no specific mapping

        // Example mapping for completeness score
        if (typeof score === 'number') {
            if (score >= 95) classToApply = 'good';
            else if (score >= 80) classToApply = 'fair';
            else classToApply = 'poor';
        }

        return `
            <div class="quality-metric">
                <div class="metric-score ${classToApply}">${typeof score === 'number' ? score.toFixed(1) + '%' : 'N/A'}</div>
                <p>${metric.description || 'Data quality metric'}</p>
            </div>
        `;
    }

    async function fetchOutlierInfo() {
        if (!currentDatasetId || !currentColumn) return;
        try {
            // Fetch outliers for the current column
            const response = await fetch(`/api/column_analysis/outliers/${currentDatasetId}?column=${encodeURIComponent(currentColumn.name)}&method=iqr`);
            if (!response.ok) throw new Error('Failed to fetch outlier data');
            const data = await response.json();

            if (data.success && data.outliers) {
                const outlierData = data.outliers.outlier_detection?.iqr_method; // Assuming IQR method is primary
                if (outlierData) {
                    const percentage = safeFormat(outlierData.percentage, 1);
                    const lowerBound = safeFormat(outlierData.lower_bound, 2);
                    const upperBound = safeFormat(outlierData.upper_bound, 2);
                    const container = document.getElementById('outlier-detection');
                    container.innerHTML = `
                        <div class="outlier-result">
                            <p>${outlierData.count || 0} potential outliers detected (${percentage}% of data)</p>
                            <p>Using IQR method (bounds: ${lowerBound} - ${upperBound})</p>
                            <p>Consider investigating and handling these values.</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error("Error fetching outlier info:", error);
            document.getElementById('outlier-detection').innerHTML = '<p>Could not fetch outlier information.</p>';
        }
    }

    async function fetchTrendInfo() {
        if (!currentDatasetId || !currentColumn || !currentColumn.type || !(currentColumn.type.toLowerCase().includes('date') || currentColumn.type.toLowerCase().includes('time'))) {
             // Only fetch if column is temporal
            document.getElementById('trends-analysis').innerHTML = '<p>No temporal analysis for this column type.</p>';
            return;
        }
        try {
            // Fetch temporal analysis (which includes trends)
            const response = await fetch(`/api/column_analysis/temporal_analysis/${currentDatasetId}?column=${encodeURIComponent(currentColumn.name)}`);
            if (!response.ok) throw new Error('Failed to fetch temporal data');
            const data = await response.json();

            if (data.success && data.temporal) {
                const temporalData = data.temporal;
                const container = document.getElementById('trends-analysis');
                let trendInsight = 'No trend information available.';

                // Infer trend from temporal_summary.temporal_patterns or specific trend analysis if available
                if (temporalData.trends && temporalData.trends.note) {
                    trendInsight = temporalData.trends.note;
                } else if (temporalData.temporal_patterns && temporalData.temporal_patterns.date_range) {
                    trendInsight = `Data spans from ${temporalData.temporal_patterns.date_range.start} to ${temporalData.temporal_patterns.date_range.end}.`;
                } else {
                    trendInsight = 'No specific trend information found.';
                }
                container.innerHTML = `<div class="trends-result"><p>${trendInsight}</p></div>`;
            }
        } catch (error) {
            console.error("Error fetching trend info:", error);
            document.getElementById('trends-analysis').innerHTML = '<p>Could not fetch trend information.</p>';
        }
    }


    // Handler for when a column is selected from the dropdown
    function handleColumnSelection() {
        const selectedColumnName = columnSelect.value;
        if (!selectedColumnName) {
            hideAnalysisUI();
            currentColumn = null;
            return;
        }
        // Find the full column object from our cached list
        currentColumn = currentColumns.find(col => col.name === selectedColumnName);

        if (currentColumn) {
            // Display overview and enable tabs immediately upon selection
            displayColumnOverview(currentColumn); // Use basic info from cached currentColumns
            analysisTabs.style.display = 'block';
            columnActions.style.display = 'block';
            // Clear previous analysis results
            document.getElementById('basic-stats-content').innerHTML = '<p>Select a column and click "Analyze Column" for details.</p>';
            document.getElementById('distribution-content').innerHTML = '';
            document.getElementById('value-patterns').innerHTML = '';
            document.getElementById('outlier-detection').innerHTML = '';
            document.getElementById('trends-analysis').innerHTML = '';
            document.getElementById('completeness-analysis').innerHTML = '';
            document.getElementById('consistency-analysis').innerHTML = '';
            document.getElementById('validity-analysis').innerHTML = '';
            document.getElementById('relationship-results').innerHTML = '';
        } else {
            hideAnalysisUI();
            currentColumn = null;
        }
    }


    async function analyzeRelationship() {
        const compareColumnName = document.getElementById('compare-column').value;

        if (!currentDatasetId || !currentColumn || !compareColumnName) {
            showError('Please select a dataset, a primary column, and a column to compare with.');
            return;
        }

        if (compareColumnName === currentColumn.name) {
            showError('Please select a different column for comparison.');
            return;
        }

        showLoading();
        const container = document.getElementById('relationship-results');
        container.innerHTML = ''; // Clear previous results

        try {
            // Fetch bivariate analysis. Adjust endpoint and parameters as per your backend.
            // Assuming an endpoint like: GET /api/column_analysis/relationships/<dataset_id>?column1=<col1>&column2=<col2>
            const response = await fetch(`/api/column_analysis/relationships/${currentDatasetId}?column1=${encodeURIComponent(currentColumn.name)}&column2=${encodeURIComponent(compareColumnName)}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.analysis) {
                const analysis = data.analysis; // This should be the bivariate analysis object

                let html = `<div class="relationship-result">`;
                html += `<h5>Relationship Analysis: ${currentColumn.name} vs ${compareColumnName}</h5>`;

                if (analysis.error) {
                    html += `<p class="error">${analysis.error}</p>`;
                } else {
                    // Display correlation if available (numeric-numeric)
                    if (analysis.correlation_analysis) {
                        const corr = analysis.correlation_analysis.pearson || analysis.correlation_analysis.spearman;
                        const strength = analysis.correlation_analysis.correlation_strength || 'N/A';
                        const pValue = corr ? corr.p_value : undefined;

                        html += `
                            <div class="relationship-stats">
                                <div class="stat-item">
                                    <strong>Correlation (${corr?.method || 'Pearson'}):</strong> ${safeFormat(corr?.correlation, 4)}
                                </div>
                                <div class="stat-item">
                                    <strong>P-value:</strong> ${safeFormat(pValue, 4)}
                                </div>
                                <div class="stat-item">
                                    <strong>Significance:</strong> ${pValue !== undefined ? (pValue < 0.05 ? 'Significant' : 'Not Significant') : 'N/A'}
                                </div>
                                <div class="stat-item">
                                    <strong>Strength:</strong> ${strength.toUpperCase()}
                                </div>
                            </div>
                        `;
                    }
                    // Display association/test results if available (e.g., for categorical)
                    else if (analysis.association_analysis || analysis.statistical_tests) {
                        // Extract relevant info from association_analysis or statistical_tests
                        // This depends heavily on your backend's response structure
                        html += '<p>Association/Test results would be displayed here.</p>';
                    }

                    // Display insights
                    if (analysis.insights && analysis.insights.length > 0) {
                        html += `<div class="relationship-interpretation">
                                    <p><strong>Insights:</strong></p>
                                    <ul>${analysis.insights.map(insight => `<li>${insight}</li>`).join('')}</ul>
                                 </div>`;
                    }
                }
                html += `</div>`;
                container.innerHTML = html;
            } else {
                throw new Error(data.error || 'Failed to analyze relationship');
            }

        } catch (error) {
            console.error('Error analyzing relationship:', error);
            container.innerHTML = `<div class="error-message">Failed to analyze relationship: ${error.message}</div>`;
        } finally {
            hideLoading();
        }
    }

    function switchTab(tabName) {
        // Remove active class from all tabs and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(tabName);

        if (activeButton) activeButton.classList.add('active');
        if (activeContent) activeContent.classList.add('active');

        // Trigger specific data loading for tabs if not already loaded by analyzeColumn
        if (tabName === 'patterns' && !document.getElementById('value-patterns').innerHTML) {
            fetchOutlierInfo(); // Fetch outliers when Patterns tab is shown
            fetchTrendInfo(); // Fetch trends if applicable
        }
        // Add calls for other tabs if their data isn't loaded by default
    }

    // Placeholder for generic messages, can be used for actions that don't fetch data immediately
    function showMessage(title, type, message = '') {
        // In a real app, this might open a modal or notification
        alert(`${title} ${message || 'options would be displayed here.'}`);
    }

    // --- Helper functions for rendering ---

    // Function to format bytes for display
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }


    function showLoading() {
        loadingModal.style.display = 'flex';
    }

    function hideLoading() {
        loadingModal.style.display = 'none';
    }

    function showError(message) {
        alert(message); // In a real app, use a proper notification system
    }

    function hideAnalysisUI() {
        columnOverview.style.display = 'none';
        analysisTabs.style.display = 'none';
        columnActions.style.display = 'none';
        currentColumn = null; // Clear current column when UI is hidden
    }

    // --- Specific Tab Data Fetching ---
    // These are called when the respective tabs become active if data isn't pre-loaded

    // Example: If distribution is not loaded with analyzeColumn, call this when 'distribution' tab becomes active
    async function fetchDistributionData() {
        if (!currentDatasetId || !currentColumn) return;
        try {
            const response = await fetch(`/api/column_analysis/distribution/${currentDatasetId}?column=${encodeURIComponent(currentColumn.name)}`);
            if (!response.ok) throw new Error('Failed to fetch distribution data');
            const data = await response.json();
            if (data.success && data.distribution) {
                displayDistribution(data.distribution, currentColumn.type);
            }
        } catch (error) {
            console.error("Error fetching distribution data:", error);
            document.getElementById('distribution-content').innerHTML = '<p>Could not fetch distribution data.</p>';
        }
    }

    // Similar functions for quality, patterns, etc., if needed to be lazy-loaded per tab.
});

// Add CSS for column analysis specific styling
const columnAnalysisCSS = `
<style>
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin: 15px 0;
}

.stat-item {
    background: #f8fafc;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    text-align: center;
}

.stat-item strong {
    display: block;
    color: #374151;
    font-size: 0.9em;
    margin-bottom: 5px;
}

.stat-item span {
    font-size: 1.4em;
    font-weight: 700;
    color: #1e293b;
}

.category-stats {
    background: #f8fafc;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.value-counts {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 15px;
}

.value-count-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
}

.chart-placeholder {
    background: #f8fafc;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    color: #64748b;
}

.relationship-result {
    background: white;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin-top: 15px;
}

.relationship-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin: 15px 0;
}

.pattern-result, .outlier-result, .trends-result {
    background: #f8fafc;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid #3b82f6;
    margin-bottom: 15px;
}

.quality-metric {
    text-align: center;
    background: white;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin-bottom: 15px;
}

.metric-score {
    font-size: 2em;
    font-weight: 700;
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 8px;
}

.metric-score.good {
    background: #dcfce7;
    color: #166534;
}

.metric-score.fair {
    background: #fef3c7;
    color: #92400e;
}

.metric-score.poor {
    background: #fee2e2;
    color: #991b1b;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', columnAnalysisCSS);