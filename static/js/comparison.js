document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let selectedDatasets = [];
    let selectedColumns = [];
    let comparisonData = {};
    
    // DOM Elements
    const dataset1Select = document.getElementById('dataset1-select');
    const dataset2Select = document.getElementById('dataset2-select');
    const colDatasetSelect = document.getElementById('col-dataset-select');
    const comparisonResults = document.getElementById('comparison-results');
    const loadingModal = document.getElementById('comparison-loading-modal');
    
    // Initialize
    loadDatasets();
    setupEventListeners();
    
    function setupEventListeners() {
        // Dataset comparison event listeners
        const compareBtn = document.getElementById('compare-datasets');
        if (compareBtn) {
            compareBtn.addEventListener('click', compareDatasets);
        }
        
        const compareColBtn = document.getElementById('compare-columns');
        if (compareColBtn) {
            compareColBtn.addEventListener('click', compareColumns);
        }
        
        const compareSegBtn = document.getElementById('compare-segments');
        if (compareSegBtn) {
            compareSegBtn.addEventListener('click', compareSegments);
        }
        
        const exportBtn = document.getElementById('export-comparison');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportComparison);
        }
        
        // Type switching buttons
        const typeButtons = document.querySelectorAll('.type-btn');
        typeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                switchComparisonType(e.target.getAttribute('data-type'));
            });
        });
        
        // Tab switching
        const tabButtons = document.querySelectorAll('.comp-tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                switchTab(e.target.getAttribute('data-tab'));
            });
        });
        
        // Dataset selectors
        if (dataset1Select) {
            dataset1Select.addEventListener('change', updateComparisonOptions);
        }
        if (dataset2Select) {
            dataset2Select.addEventListener('change', updateComparisonOptions);
        }
        if (colDatasetSelect) {
            colDatasetSelect.addEventListener('change', updateColumnOptions);
        }
        
        // Segment comparison selectors
        const segDatasetSelect = document.getElementById('seg-dataset-select');
        if (segDatasetSelect) {
            segDatasetSelect.addEventListener('change', updateSegmentOptions);
        }
    }
    
    async function loadDatasets() {
        try {
            // Fetch real datasets from the API
            const response = await fetch('/api/data/datasets');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.datasets) {
                // Transform datasets to include column names
                const datasetsWithColumns = await Promise.all(data.datasets.map(async (dataset) => {
                    try {
                        const colResponse = await fetch(`/api/data/columns/${dataset.id}`);
                        if (colResponse.ok) {
                            const colData = await colResponse.json();
                            if (colData.success && colData.columns) {
                                return {
                                    ...dataset,
                                    columns_list: colData.columns.map(col => col.name)
                                };
                            }
                        }
                        return {
                            ...dataset,
                            columns_list: dataset.column_names || []
                        };
                    } catch (err) {
                        console.warn(`Failed to load columns for dataset ${dataset.id}:`, err);
                        return {
                            ...dataset,
                            columns_list: dataset.column_names || []
                        };
                    }
                }));
                
                storeDatasets(datasetsWithColumns);
                populateDatasetSelectors(datasetsWithColumns);
            } else {
                console.log('No datasets available');
                storeDatasets([]);
                populateDatasetSelectors([]);
            }
            
        } catch (error) {
            console.error('Error loading datasets:', error);
            showError('Failed to load datasets: ' + error.message);
        }
    }
    
    function populateDatasetSelectors(datasets) {
        // Populate dataset selectors for comparison
        const selectors = [dataset1Select, dataset2Select, colDatasetSelect];
        
        selectors.forEach(selector => {
            if (selector) {
                selector.innerHTML = '<option value="">Choose dataset...</option>';
                datasets.forEach(dataset => {
                    const option = document.createElement('option');
                    option.value = dataset.id;
                    option.textContent = `${dataset.name} (${dataset.rows} rows, ${dataset.columns} cols)`;
                    selector.appendChild(option);
                });
            }
        });
        
        // Also populate segment dataset selector if it exists
        const segDatasetSelect = document.getElementById('seg-dataset-select');
        if (segDatasetSelect) {
            segDatasetSelect.innerHTML = '<option value="">Choose dataset...</option>';
            datasets.forEach(dataset => {
                const option = document.createElement('option');
                option.value = dataset.id;
                option.textContent = `${dataset.name} (${dataset.rows} rows, ${dataset.columns} cols)`;
                segDatasetSelect.appendChild(option);
            });
        }
    }
    

    
    function updateColumnOptions() {
        const selectedDatasetId = colDatasetSelect.value;
        const column1Select = document.getElementById('column1-select');
        const column2Select = document.getElementById('column2-select');
        
        if (column1Select) column1Select.innerHTML = '<option value="">Choose first column...</option>';
        if (column2Select) column2Select.innerHTML = '<option value="">Choose second column...</option>';
        
        if (selectedDatasetId) {
            // Fetch columns for the selected dataset
            fetch(`/api/data/columns/${selectedDatasetId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.columns) {
                        data.columns.forEach(column => {
                            if (column1Select) {
                                const option1 = document.createElement('option');
                                option1.value = column.name;
                                option1.textContent = column.name;
                                column1Select.appendChild(option1);
                            }
                            if (column2Select) {
                                const option2 = document.createElement('option');
                                option2.value = column.name;
                                option2.textContent = column.name;
                                column2Select.appendChild(option2);
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Error loading columns:', error);
                });
        }
    }
    
    function updateComparisonOptions() {
        // Enable/disable comparison button based on selection
        const compareBtn = document.getElementById('compare-datasets');
        if (compareBtn) {
            compareBtn.disabled = !dataset1Select.value || !dataset2Select.value;
        }
    }
    
    function switchComparisonType(type) {
        // Hide all panels
        const panels = document.querySelectorAll('.comparison-panel');
        panels.forEach(panel => panel.classList.remove('active'));
        
        // Show selected panel
        const selectedPanel = document.getElementById(`${type}-comparison-panel`);
        if (selectedPanel) {
            selectedPanel.classList.add('active');
        }
        
        // Update button states
        const buttons = document.querySelectorAll('.type-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        const activeButton = document.querySelector(`[data-type="${type}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    function getStoredDatasets() {
        // Simple function to store datasets temporarily
        if (!window.cachedDatasets) {
            window.cachedDatasets = [];
        }
        return window.cachedDatasets;
    }
    
    function storeDatasets(datasets) {
        window.cachedDatasets = datasets;
    }
    
    async function compareDatasets() {
        const dataset1Id = dataset1Select.value;
        const dataset2Id = dataset2Select.value;
        
        if (!dataset1Id || !dataset2Id) {
            showError('Please select both datasets to compare');
            return;
        }
        
        showLoading();
        
        try {
            const comparison = await performDatasetComparison([dataset1Id, dataset2Id]);
            displayDatasetComparison(comparison);
            
        } catch (error) {
            console.error('Error comparing datasets:', error);
            showError('Failed to compare datasets');
        } finally {
            hideLoading();
        }
    }
    
    async function performDatasetComparison(datasetIds) {
        try {
            const response = await fetch('/api/comparison/datasets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dataset_ids: datasetIds })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                return data.comparison;
            } else {
                throw new Error(data.error || 'Failed to compare datasets');
            }
        } catch (error) {
            console.error('Error comparing datasets:', error);
            // Fallback to basic comparison using stored data
            const datasets = getStoredDatasets();
            const selectedDatasets = datasets.filter(d => datasetIds.includes(d.id.toString()));
            
            return {
                overview: {
                    datasets: selectedDatasets.map(d => ({
                        name: d.name || d.filename,
                        rows: d.rows,
                        columns: d.columns,
                        memory_usage: d.file_size ? `${(d.file_size / (1024*1024)).toFixed(1)} MB` : 'Unknown',
                        missing_values: 'Unknown'
                    }))
                },
                schema_comparison: {
                    common_columns: [],
                    unique_columns: {},
                    data_type_differences: []
                },
                statistical_comparison: [],
                quality_comparison: [],
                error: 'Detailed comparison unavailable - API error'
            };
        }
    }
    
    function generateStatisticalComparison(datasets) {
        return datasets.map(dataset => ({
            dataset_name: dataset.name,
            statistics: {
                mean_age: (Math.random() * 20 + 30).toFixed(1),
                median_income: (Math.random() * 50000 + 50000).toFixed(0),
                std_score: (Math.random() * 2 + 1).toFixed(2),
                min_value: Math.floor(Math.random() * 100),
                max_value: Math.floor(Math.random() * 1000 + 500)
            }
        }));
    }
    
    function generateQualityComparison(datasets) {
        return datasets.map(dataset => ({
            dataset_name: dataset.name,
            quality_metrics: {
                completeness: (Math.random() * 20 + 80).toFixed(1),
                consistency: (Math.random() * 15 + 85).toFixed(1),
                validity: (Math.random() * 10 + 90).toFixed(1),
                uniqueness: (Math.random() * 25 + 75).toFixed(1)
            }
        }));
    }
    
    function displayDatasetComparison(comparison) {
        const container = document.getElementById('comparison-results');
        
        let html = `
            <div class="comparison-header">
                <h3>Dataset Comparison Results</h3>
                <p>Comparing ${comparison.overview.datasets.length} datasets</p>
            </div>
            
            <div class="comparison-tabs">
                <button class="comparison-tab active" data-tab="overview">Overview</button>
                <button class="comparison-tab" data-tab="schema">Schema</button>
                <button class="comparison-tab" data-tab="statistics">Statistics</button>
                <button class="comparison-tab" data-tab="quality">Quality</button>
            </div>
            
            <div class="tab-content">
                <div id="overview" class="tab-pane active">
                    ${generateOverviewHTML(comparison.overview)}
                </div>
                <div id="schema" class="tab-pane">
                    ${generateSchemaHTML(comparison.schema_comparison)}
                </div>
                <div id="statistics" class="tab-pane">
                    ${generateStatisticsHTML(comparison.statistical_comparison)}
                </div>
                <div id="quality" class="tab-pane">
                    ${generateQualityHTML(comparison.quality_comparison)}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        container.style.display = 'block';
        
        // Reattach tab event listeners
        const tabButtons = container.querySelectorAll('.comparison-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                switchTab(e.target.getAttribute('data-tab'));
            });
        });
    }
    
    function generateOverviewHTML(overview) {
        let html = '<div class="overview-grid">';
        
        overview.datasets.forEach(dataset => {
            html += `
                <div class="dataset-overview-card">
                    <h4>${dataset.name}</h4>
                    <div class="overview-stats">
                        <div class="stat">
                            <span class="label">Rows:</span>
                            <span class="value">${dataset.rows.toLocaleString()}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Columns:</span>
                            <span class="value">${dataset.columns}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Memory:</span>
                            <span class="value">${dataset.memory_usage}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Missing:</span>
                            <span class="value">${dataset.missing_values}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    function generateSchemaHTML(schema) {
        return `
            <div class="schema-comparison">
                <div class="schema-section">
                    <h4>Common Columns</h4>
                    <div class="column-list">
                        ${schema.common_columns.map(col => `<span class="column-tag common">${col}</span>`).join('')}
                    </div>
                </div>
                
                <div class="schema-section">
                    <h4>Unique Columns</h4>
                    ${Object.entries(schema.unique_columns).map(([dataset, columns]) => `
                        <div class="unique-columns">
                            <h5>${dataset}</h5>
                            <div class="column-list">
                                ${columns.map(col => `<span class="column-tag unique">${col}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="schema-section">
                    <h4>Data Type Differences</h4>
                    <table class="type-differences-table">
                        <thead>
                            <tr>
                                <th>Column</th>
                                <th>Dataset 1</th>
                                <th>Dataset 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${schema.data_type_differences.map(diff => `
                                <tr>
                                    <td>${diff.column}</td>
                                    <td><code>${diff.dataset1}</code></td>
                                    <td><code>${diff.dataset2}</code></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    function generateStatisticsHTML(statistics) {
        return `
            <div class="statistics-comparison">
                <table class="statistics-table">
                    <thead>
                        <tr>
                            <th>Dataset</th>
                            <th>Mean Age</th>
                            <th>Median Income</th>
                            <th>Std Score</th>
                            <th>Min Value</th>
                            <th>Max Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${statistics.map(stat => `
                            <tr>
                                <td><strong>${stat.dataset_name}</strong></td>
                                <td>${stat.statistics.mean_age}</td>
                                <td>$${Number(stat.statistics.median_income).toLocaleString()}</td>
                                <td>${stat.statistics.std_score}</td>
                                <td>${stat.statistics.min_value}</td>
                                <td>${stat.statistics.max_value}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    function generateQualityHTML(quality) {
        return `
            <div class="quality-comparison">
                ${quality.map(q => `
                    <div class="quality-card">
                        <h4>${q.dataset_name}</h4>
                        <div class="quality-metrics">
                            ${Object.entries(q.quality_metrics).map(([metric, value]) => `
                                <div class="quality-metric">
                                    <span class="metric-name">${metric.charAt(0).toUpperCase() + metric.slice(1)}</span>
                                    <div class="metric-bar">
                                        <div class="metric-fill" style="width: ${value}%"></div>
                                        <span class="metric-value">${value}%</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    async function compareColumns() {
        const datasetId = colDatasetSelect.value;
        const column1 = document.getElementById('column1-select').value;
        const column2 = document.getElementById('column2-select').value;
        
        if (!datasetId || !column1 || !column2) {
            showError('Please select dataset and both columns for comparison');
            return;
        }
        
        showLoading();
        
        try {
            const comparison = await performColumnComparison(datasetId, column1, datasetId, column2);
            displayColumnComparison(comparison);
            
        } catch (error) {
            console.error('Error comparing columns:', error);
            showError('Failed to compare columns');
        } finally {
            hideLoading();
        }
    }
    
    async function performColumnComparison(dataset1Id, column1, dataset2Id, column2) {
        try {
            const response = await fetch('/api/comparison/columns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset1_id: dataset1Id,
                    column1: column1,
                    dataset2_id: dataset2Id,
                    column2: column2
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                return data.comparison;
            } else {
                throw new Error(data.error || 'Failed to compare columns');
            }
        } catch (error) {
            console.error('Error comparing columns:', error);
            // Fallback to basic comparison using stored data
            const datasets = getStoredDatasets();
            const dataset1 = datasets.find(d => d.id == dataset1Id);
            const dataset2 = datasets.find(d => d.id == dataset2Id);
            
            return {
                column1: {
                    dataset: dataset1 ? (dataset1.name || dataset1.filename) : 'Unknown',
                    column: column1,
                    type: 'unknown',
                    stats: {
                        count: dataset1 ? dataset1.rows : 'Unknown',
                        mean: 'Unknown',
                        std: 'Unknown',
                        min: 'Unknown',
                        max: 'Unknown',
                        unique: 'Unknown'
                    }
                },
                column2: {
                    dataset: dataset2 ? (dataset2.name || dataset2.filename) : 'Unknown',
                    column: column2,
                    type: 'unknown',
                    stats: {
                        count: dataset2 ? dataset2.rows : 'Unknown',
                        mean: 'Unknown',
                        std: 'Unknown',
                        min: 'Unknown',
                        max: 'Unknown',
                        unique: 'Unknown'
                    }
                },
                tests: {
                    correlation: 'Unable to calculate',
                    t_test_p_value: 'Unable to calculate',
                    ks_test_p_value: 'Unable to calculate'
                },
                error: 'Column comparison unavailable - API error'
            };
        }
    }
    
    function displayColumnComparison(comparison) {
        const container = document.getElementById('comparison-results');
        
        // Safely handle undefined comparison data
        if (!comparison || !comparison.column1 || !comparison.column2) {
            container.innerHTML = `
                <div class="column-comparison-results error">
                    <h3>Column Comparison Error</h3>
                    <p>Unable to display comparison results. Please ensure both columns are properly selected and contain valid data.</p>
                </div>
            `;
            return;
        }
        
        const html = `
            <div class="column-comparison-results">
                <h3>Column Comparison Results</h3>
                <p>Comparing ${comparison.column1.column || 'Unknown'} vs ${comparison.column2.column || 'Unknown'}</p>
                
                <div class="column-stats-grid">
                    <div class="column-stats-card">
                        <h4>${comparison.column1.dataset || 'Unknown Dataset'} - ${comparison.column1.column || 'Unknown Column'}</h4>
                        <div class="stats-list">
                            ${comparison.column1.stats ? Object.entries(comparison.column1.stats).map(([stat, value]) => `
                                <div class="stat-row">
                                    <span class="stat-name">${stat.toUpperCase()}:</span>
                                    <span class="stat-value">${value !== null && value !== undefined ? value : 'N/A'}</span>
                                </div>
                            `).join('') : '<p>No statistics available</p>'}
                        </div>
                    </div>
                    
                    <div class="column-stats-card">
                        <h4>${comparison.column2.dataset || 'Unknown Dataset'} - ${comparison.column2.column || 'Unknown Column'}</h4>
                        <div class="stats-list">
                            ${comparison.column2.stats ? Object.entries(comparison.column2.stats).map(([stat, value]) => `
                                <div class="stat-row">
                                    <span class="stat-name">${stat.toUpperCase()}:</span>
                                    <span class="stat-value">${value !== null && value !== undefined ? value : 'N/A'}</span>
                                </div>
                            `).join('') : '<p>No statistics available</p>'}
                        </div>
                    </div>
                </div>
                
                <div class="statistical-tests">
                    <h4>Statistical Tests</h4>
                    <div class="test-results">
                        <div class="test-result">
                            <span class="test-name">Correlation:</span>
                            <span class="test-value">${comparison.tests && comparison.tests.correlation !== undefined ? comparison.tests.correlation : 'N/A'}</span>
                        </div>
                        <div class="test-result">
                            <span class="test-name">T-test p-value:</span>
                            <span class="test-value">${comparison.tests && comparison.tests.t_test_p_value !== undefined ? comparison.tests.t_test_p_value : 'N/A'}</span>
                        </div>
                        <div class="test-result">
                            <span class="test-name">Kolmogorov-Smirnov p-value:</span>
                            <span class="test-value">${comparison.tests && comparison.tests.ks_test_p_value !== undefined ? comparison.tests.ks_test_p_value : 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        container.style.display = 'block';
    }
    
    function switchTab(tabName) {
        // Remove active class from all tabs and panes
        document.querySelectorAll('.comparison-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        // Add active class to selected tab and pane
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activePane = document.getElementById(tabName);
        
        if (activeTab) activeTab.classList.add('active');
        if (activePane) activePane.classList.add('active');
    }
    
    function exportComparison() {
        const results = document.getElementById('comparison-results');
        if (!results || results.style.display === 'none') {
            showError('No comparison results to export');
            return;
        }
        
        // Create a simplified version for export
        const exportData = {
            timestamp: new Date().toISOString(),
            comparison_type: comparisonType.value,
            results: 'Comparison results would be exported here'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comparison_results_${Date.now()}.json`;
        a.click();
        
        showSuccess('Comparison results exported');
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
    
    function showSuccess(message) {
        alert(message); // In a real app, use a proper notification system
    }
    
    function updateSegmentOptions() {
        const selectedDatasetId = document.getElementById('seg-dataset-select').value;
        const segmentColumn = document.getElementById('segment-column');
        const targetColumn = document.getElementById('target-column');
        
        if (segmentColumn) segmentColumn.innerHTML = '<option value="">Choose segmentation column...</option>';
        if (targetColumn) targetColumn.innerHTML = '<option value="">Choose target column...</option>';
        
        if (selectedDatasetId) {
            // Fetch columns for the selected dataset
            fetch(`/api/data/columns/${selectedDatasetId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.columns) {
                        data.columns.forEach(column => {
                            if (segmentColumn) {
                                const option1 = document.createElement('option');
                                option1.value = column.name;
                                option1.textContent = column.name;
                                segmentColumn.appendChild(option1);
                            }
                            if (targetColumn) {
                                const option2 = document.createElement('option');
                                option2.value = column.name;
                                option2.textContent = column.name;
                                targetColumn.appendChild(option2);
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Error loading columns for segments:', error);
                });
        }
    }
    
    async function compareSegments() {
        const datasetId = document.getElementById('seg-dataset-select').value;
        const segmentColumn = document.getElementById('segment-column').value;
        const targetColumn = document.getElementById('target-column').value;
        
        if (!datasetId || !segmentColumn || !targetColumn) {
            showError('Please select dataset, segmentation column, and target column');
            return;
        }
        
        showLoading();
        
        try {
            const response = await fetch(`/api/comparison/segments/${datasetId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    target_column: targetColumn,
                    segment_column: segmentColumn
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                displaySegmentComparison(data.data || data, segmentColumn, targetColumn);
            } else {
                throw new Error(data.error || 'Failed to compare segments');
            }
            
        } catch (error) {
            console.error('Error comparing segments:', error);
            showError('Failed to compare segments: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function displaySegmentComparison(result, segmentColumn, targetColumn) {
        const container = document.getElementById('comparison-results');
        
        // Extract group statistics if available
        const groupStats = result.group_statistics || {};
        const anovaTest = result.anova_test || {};
        const effectSize = result.effect_size || {};
        
        const html = `
            <div class="segment-comparison-results">
                <h3>Segment Comparison Results</h3>
                <p>Comparing <strong>${targetColumn}</strong> across segments of <strong>${segmentColumn}</strong></p>
                
                <div class="comparison-summary">
                    <div class="summary-cards">
                        <div class="summary-card">
                            <h4>Groups Found</h4>
                            <span>${result.group_count || Object.keys(groupStats).length || 'Unknown'}</span>
                        </div>
                        <div class="summary-card">
                            <h4>ANOVA F-statistic</h4>
                            <span>${anovaTest.f_statistic ? anovaTest.f_statistic.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="summary-card">
                            <h4>P-value</h4>
                            <span>${anovaTest.p_value ? anovaTest.p_value.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="summary-card">
                            <h4>Effect Size (η²)</h4>
                            <span>${effectSize.eta_squared ? effectSize.eta_squared.toFixed(4) : 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="detailed-comparison">
                    <div class="comparison-tabs">
                        <button class="comp-tab-button active" data-tab="group-stats">Group Statistics</button>
                        <button class="comp-tab-button" data-tab="tests">Statistical Tests</button>
                        <button class="comp-tab-button" data-tab="interpretation">Interpretation</button>
                    </div>

                    <div id="group-stats" class="comp-tab-content active">
                        <h4>Group Statistics by ${segmentColumn}</h4>
                        ${generateGroupStatsHTML(groupStats)}
                    </div>

                    <div id="tests" class="comp-tab-content">
                        <h4>Statistical Test Results</h4>
                        ${generateTestResultsHTML(result)}
                    </div>

                    <div id="interpretation" class="comp-tab-content">
                        <h4>Interpretation & Recommendations</h4>
                        ${generateInterpretationHTML(result)}
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        container.style.display = 'block';
        
        // Reattach tab event listeners for segment comparison
        const tabButtons = container.querySelectorAll('.comp-tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                switchTab(e.target.getAttribute('data-tab'));
            });
        });
    }
    
    function generateGroupStatsHTML(groupStats) {
        if (!groupStats || Object.keys(groupStats).length === 0) {
            return '<p>No group statistics available.</p>';
        }
        
        let html = `
            <table class="group-stats-table">
                <thead>
                    <tr>
                        <th>Group</th>
                        <th>Count</th>
                        <th>Mean</th>
                        <th>Std Dev</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Median</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        Object.entries(groupStats).forEach(([group, stats]) => {
            html += `
                <tr>
                    <td><strong>${group}</strong></td>
                    <td>${stats.count || 'N/A'}</td>
                    <td>${typeof stats.mean === 'number' ? stats.mean.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.std === 'number' ? stats.std.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.min === 'number' ? stats.min.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.max === 'number' ? stats.max.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.median === 'number' ? stats.median.toFixed(3) : 'N/A'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    function generateTestResultsHTML(result) {
        const anovaTest = result.anova_test || {};
        const kwTest = result.kruskal_wallis_test || {};
        
        return `
            <div class="test-results">
                <div class="test-section">
                    <h5>ANOVA Test (Parametric)</h5>
                    <div class="test-stats">
                        <div class="stat-item">
                            <span class="stat-name">F-statistic:</span>
                            <span class="stat-value">${anovaTest.f_statistic ? anovaTest.f_statistic.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">P-value:</span>
                            <span class="stat-value">${anovaTest.p_value ? anovaTest.p_value.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">Interpretation:</span>
                            <span class="stat-value">${anovaTest.interpretation || 'No interpretation available'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="test-section">
                    <h5>Kruskal-Wallis Test (Non-parametric)</h5>
                    <div class="test-stats">
                        <div class="stat-item">
                            <span class="stat-name">H-statistic:</span>
                            <span class="stat-value">${kwTest.h_statistic ? kwTest.h_statistic.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">P-value:</span>
                            <span class="stat-value">${kwTest.p_value ? kwTest.p_value.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">Interpretation:</span>
                            <span class="stat-value">${kwTest.interpretation || 'No interpretation available'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function generateInterpretationHTML(result) {
        const recommendations = result.recommendations || [];
        const effectSize = result.effect_size || {};
        
        let html = '<div class="interpretation-section">';
        
        if (effectSize.interpretation) {
            html += `
                <div class="effect-size-interpretation">
                    <h5>Effect Size Interpretation</h5>
                    <p>${effectSize.interpretation}</p>
                </div>
            `;
        }
        
        if (recommendations.length > 0) {
            html += `
                <div class="recommendations">
                    <h5>Recommendations</h5>
                    <ul>
                        ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
});

// Add CSS for comparison functionality
const comparisonCSS = `
<style>
.dataset-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 10px 0;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    transition: background-color 0.2s;
}

.dataset-checkbox:hover {
    background: #f8fafc;
}

.dataset-checkbox input[type="checkbox"] {
    margin-top: 2px;
}

.dataset-checkbox label {
    flex: 1;
    cursor: pointer;
    margin: 0;
}

.dataset-checkbox label strong {
    display: block;
    color: #1e293b;
    margin-bottom: 4px;
}

.dataset-info {
    color: #64748b;
    font-size: 0.9em;
}

.overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.dataset-overview-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.dataset-overview-card h4 {
    margin: 0 0 15px 0;
    color: #1e293b;
}

.overview-stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.stat .label {
    color: #64748b;
    font-weight: 500;
}

.stat .value {
    color: #1e293b;
    font-weight: 600;
}

.comparison-tabs {
    display: flex;
    gap: 2px;
    margin: 20px 0 0 0;
    border-bottom: 1px solid #e2e8f0;
}

.comparison-tab {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-bottom: none;
    padding: 12px 24px;
    cursor: pointer;
    border-radius: 8px 8px 0 0;
    transition: all 0.2s;
}

.comparison-tab.active {
    background: white;
    font-weight: 600;
    border-color: #e2e8f0;
}

.tab-content {
    background: white;
    border: 1px solid #e2e8f0;
    border-top: none;
    border-radius: 0 0 8px 8px;
    padding: 20px;
}

.tab-pane {
    display: none;
}

.tab-pane.active {
    display: block;
}

.column-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0;
}

.column-tag {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 500;
}

.column-tag.common {
    background: #dcfce7;
    color: #166534;
}

.column-tag.unique {
    background: #fef3c7;
    color: #92400e;
}

.schema-section {
    margin: 20px 0;
}

.schema-section h4, .schema-section h5 {
    color: #1e293b;
    margin: 15px 0 10px 0;
}

.type-differences-table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
}

.type-differences-table th,
.type-differences-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
}

.type-differences-table th {
    background: #f8fafc;
    font-weight: 600;
    color: #374151;
}

.type-differences-table code {
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
}

.statistics-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
}

.statistics-table th,
.statistics-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
}

.statistics-table th {
    background: #f8fafc;
    font-weight: 600;
    color: #374151;
}

.quality-comparison {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.quality-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
}

.quality-card h4 {
    margin: 0 0 15px 0;
    color: #1e293b;
}

.quality-metrics {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.quality-metric {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.metric-name {
    font-weight: 500;
    color: #374151;
    font-size: 0.9em;
}

.metric-bar {
    position: relative;
    background: #f1f5f9;
    height: 20px;
    border-radius: 10px;
    overflow: hidden;
}

.metric-fill {
    height: 100%;
    background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e);
    transition: width 0.3s ease;
}

.metric-value {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.8em;
    font-weight: 600;
    color: #1e293b;
}

.column-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.column-stats-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
}

.column-stats-card h4 {
    margin: 0 0 15px 0;
    color: #1e293b;
    font-size: 1.1em;
}

.stats-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f1f5f9;
}

.stat-name {
    color: #64748b;
    font-weight: 500;
    font-size: 0.9em;
}

.stat-value {
    color: #1e293b;
    font-weight: 600;
}

.statistical-tests {
    margin: 30px 0;
    padding: 20px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.statistical-tests h4 {
    margin: 0 0 15px 0;
    color: #1e293b;
}

.test-results {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

.test-result {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.test-name {
    color: #64748b;
    font-weight: 500;
    font-size: 0.9em;
}

.test-value {
    color: #1e293b;
    font-weight: 600;
    font-size: 1.1em;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', comparisonCSS);