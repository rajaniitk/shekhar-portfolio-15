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

        // Analysis buttons - These will trigger specific API calls
        document.getElementById('transform-column').addEventListener('click', handleTransformColumn);
        document.getElementById('clean-column').addEventListener('click', handleCleanColumn);
        document.getElementById('encode-column').addEventListener('click', handleEncodeColumn);
        document.getElementById('export-analysis').addEventListener('click', handleExportAnalysis);

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

        // Trigger specific data loading for tabs
        if (!currentDatasetId || !currentColumn) return;

        switch(tabName) {
            case 'basic-stats':
                // Basic stats are already loaded by analyzeColumn
                break;
            case 'distribution':
                fetchDistributionData();
                break;
            case 'patterns':
                fetchPatternsData();
                break;
            case 'quality':
                fetchQualityData();
                break;
            case 'relationships':
                // Relationships need user interaction to select compare column
                break;
        }
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

    async function fetchPatternsData() {
        if (!currentDatasetId || !currentColumn) return;
        
        // Fetch patterns data
        try {
            const response = await fetch(`/api/column_analysis/patterns/${currentDatasetId}?column=${encodeURIComponent(currentColumn.name)}`);
            if (!response.ok) throw new Error('Failed to fetch patterns data');
            const data = await response.json();
            
            if (data.success && data.patterns) {
                const patterns = data.patterns;
                const valuePatternsContainer = document.getElementById('value-patterns');
                
                let html = '<div class="pattern-result">';
                if (patterns.string_patterns) {
                    const sp = patterns.string_patterns;
                    html += `
                        <h6>String Patterns</h6>
                        <p>Average Length: ${safeFormat(sp.average_length, 1)} characters</p>
                        <p>Contains Numbers: ${sp.contains_numbers ? 'Yes' : 'No'}</p>
                        <p>Contains Special Characters: ${sp.contains_special_chars ? 'Yes' : 'No'}</p>
                        <p>Uppercase Values: ${sp.all_uppercase}</p>
                        <p>Lowercase Values: ${sp.all_lowercase}</p>
                    `;
                } else {
                    html += '<p>No specific patterns detected.</p>';
                }
                html += '</div>';
                valuePatternsContainer.innerHTML = html;
            }
        } catch (error) {
            console.error("Error fetching patterns data:", error);
            document.getElementById('value-patterns').innerHTML = '<p>Could not fetch patterns data.</p>';
        }

        // Also fetch outlier and trend info as before
        fetchOutlierInfo();
        fetchTrendInfo();
    }

    async function fetchQualityData() {
        if (!currentDatasetId || !currentColumn) return;
        try {
            const response = await fetch(`/api/column_analysis/data_quality/${currentDatasetId}?column=${encodeURIComponent(currentColumn.name)}`);
            if (!response.ok) throw new Error('Failed to fetch quality data');
            const data = await response.json();
            
            if (data.success && data.quality) {
                const quality = data.quality;
                
                // Update quality sections
                document.getElementById('completeness-analysis').innerHTML = renderQualityMetric(quality.completeness, 'good');
                document.getElementById('consistency-analysis').innerHTML = renderQualityMetric(quality.consistency, 'good');
                document.getElementById('validity-analysis').innerHTML = renderQualityMetric(quality.validity, 'good');
            }
        } catch (error) {
            console.error("Error fetching quality data:", error);
            document.getElementById('completeness-analysis').innerHTML = '<p>Could not fetch quality data.</p>';
            document.getElementById('consistency-analysis').innerHTML = '<p>Could not fetch quality data.</p>';
            document.getElementById('validity-analysis').innerHTML = '<p>Could not fetch quality data.</p>';
        }
    }

    // --- Action Handlers ---
    async function handleTransformColumn() {
        if (!currentDatasetId || !currentColumn) {
            showError('Please select a dataset and column first.');
            return;
        }

        const transformationType = prompt('Enter transformation type (standardize, normalize, log, sqrt):') || 'standardize';
        
        showLoading();
        try {
            const response = await fetch(`/api/column_analysis/transform/${currentDatasetId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    column: currentColumn.name,
                    transformation_type: transformationType
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to transform column');
            }

            const data = await response.json();
            if (data.success) {
                alert(`Success: ${data.message}`);
            } else {
                throw new Error(data.error || 'Transform failed');
            }
        } catch (error) {
            console.error('Transform error:', error);
            showError('Failed to transform column: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    async function handleCleanColumn() {
        if (!currentDatasetId || !currentColumn) {
            showError('Please select a dataset and column first.');
            return;
        }

        const cleaningOptions = {
            remove_nulls: confirm('Remove null values?'),
            remove_duplicates: confirm('Remove duplicate values?'),
            remove_outliers: confirm('Remove outliers?')
        };

        showLoading();
        try {
            const response = await fetch(`/api/column_analysis/clean/${currentDatasetId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    column: currentColumn.name,
                    options: cleaningOptions
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to clean column');
            }

            const data = await response.json();
            if (data.success) {
                alert(`Success: ${data.message}`);
            } else {
                throw new Error(data.error || 'Cleaning failed');
            }
        } catch (error) {
            console.error('Clean error:', error);
            showError('Failed to clean column: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    async function handleEncodeColumn() {
        if (!currentDatasetId || !currentColumn) {
            showError('Please select a dataset and column first.');
            return;
        }

        const encodingType = prompt('Enter encoding type (label, onehot, target, ordinal):') || 'label';

        showLoading();
        try {
            const response = await fetch(`/api/column_analysis/encode/${currentDatasetId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    column: currentColumn.name,
                    encoding_type: encodingType
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to encode column');
            }

            const data = await response.json();
            if (data.success) {
                alert(`Success: ${data.message}`);
            } else {
                throw new Error(data.error || 'Encoding failed');
            }
        } catch (error) {
            console.error('Encode error:', error);
            showError('Failed to encode column: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    async function handleExportAnalysis() {
        if (!currentDatasetId || !currentColumn) {
            showError('Please select a dataset and column first.');
            return;
        }

        const exportFormat = prompt('Enter export format (json, csv, xlsx):') || 'json';

        showLoading();
        try {
            const response = await fetch(`/api/column_analysis/export/${currentDatasetId}?column=${encodeURIComponent(currentColumn.name)}&format=${exportFormat}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to export analysis');
            }

            const data = await response.json();
            if (data.success) {
                alert(`Success: ${data.message}\nDownload URL: ${data.export_info.download_url}`);
            } else {
                throw new Error(data.error || 'Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            showError('Failed to export analysis: ' + error.message);
        } finally {
            hideLoading();
        }
    }
});

// Add CSS for column analysis specific styling
const columnAnalysisCSS = `
<style>
/* Main container styling */
.column-analysis-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.dashboard-header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
}

.dashboard-header h2 {
    margin: 0 0 10px 0;
    font-size: 2em;
}

.dashboard-header p {
    margin: 0;
    opacity: 0.9;
}

/* Dataset and column selectors */
.dataset-selector, .column-selector {
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #374151;
}

.form-control {
    width: 100%;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s ease;
}

.form-control:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Overview cards */
.column-overview {
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    margin-bottom: 25px;
}

.overview-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.overview-card {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    border: 1px solid #e2e8f0;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.overview-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.overview-card h4 {
    margin: 0 0 10px 0;
    color: #6b7280;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.overview-card span {
    font-size: 1.8em;
    font-weight: 700;
    color: #1e293b;
    display: block;
}

/* Tabs styling */
.analysis-tabs {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    margin-bottom: 25px;
    overflow: hidden;
}

.tab-buttons {
    display: flex;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}

.tab-button {
    flex: 1;
    padding: 15px 20px;
    border: none;
    background: transparent;
    color: #6b7280;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    border-bottom: 3px solid transparent;
}

.tab-button:hover {
    background: #e2e8f0;
    color: #374151;
}

.tab-button.active {
    background: white;
    color: #3b82f6;
    border-bottom-color: #3b82f6;
}

.tab-content {
    display: none;
    padding: 25px;
}

.tab-content.active {
    display: block;
}

/* Statistics grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.stat-item {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    text-align: center;
    transition: transform 0.2s ease;
}

.stat-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.stat-item strong {
    display: block;
    color: #6b7280;
    font-size: 0.85em;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stat-item span {
    font-size: 1.6em;
    font-weight: 700;
    color: #1e293b;
    display: block;
}

/* Category stats */
.category-stats {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 25px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.value-counts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
    max-height: 300px;
    overflow-y: auto;
}

.value-count-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    transition: background-color 0.2s ease;
}

.value-count-item:hover {
    background: #f3f4f6;
}

.value-count-item .value {
    font-weight: 600;
    color: #374151;
}

.value-count-item .count {
    color: #6b7280;
    font-size: 0.9em;
}

/* Chart placeholder */
.chart-placeholder {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    padding: 60px 40px;
    text-align: center;
    color: #64748b;
    font-size: 1.1em;
}

/* Results styling */
.relationship-result, .pattern-result, .outlier-result, .trends-result {
    background: white;
    padding: 20px;
    border-radius: 12px;
    border-left: 4px solid #3b82f6;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.relationship-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

/* Quality metrics */
.quality-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
}

.quality-section h5 {
    margin: 0 0 15px 0;
    color: #374151;
    font-size: 1.2em;
}

.quality-metric {
    text-align: center;
    background: white;
    padding: 25px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    transition: transform 0.2s ease;
}

.quality-metric:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.metric-score {
    font-size: 2.5em;
    font-weight: 700;
    margin-bottom: 15px;
    padding: 15px;
    border-radius: 12px;
    transition: all 0.3s ease;
}

.metric-score.good {
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    color: #166534;
}

.metric-score.fair {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    color: #92400e;
}

.metric-score.poor {
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    color: #991b1b;
}

/* Action buttons */
.column-actions {
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    margin-bottom: 25px;
}

.action-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-top: 15px;
}

.btn {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
    text-align: center;
}

.btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
}

.btn-primary:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
}

.btn-secondary {
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    color: white;
}

.btn-secondary:hover {
    background: linear-gradient(135deg, #5b6470 0%, #374151 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(107, 114, 128, 0.3);
}

/* Loading modal */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    padding: 40px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Responsive design */
@media (max-width: 768px) {
    .column-analysis-container {
        padding: 10px;
    }
    
    .overview-cards,
    .stats-grid,
    .action-buttons {
        grid-template-columns: 1fr;
    }
    
    .tab-buttons {
        flex-wrap: wrap;
    }
    
    .tab-button {
        flex: none;
        min-width: 120px;
    }
}

/* Error and success states */
.error-message {
    background: #fee2e2;
    color: #991b1b;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid #f87171;
    margin: 10px 0;
}

.success-message {
    background: #dcfce7;
    color: #166534;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid #22c55e;
    margin: 10px 0;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', columnAnalysisCSS);