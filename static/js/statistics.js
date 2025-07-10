document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentDatasetId = null;
    let currentColumns = [];
    
    // DOM Elements
    const datasetSelect = document.getElementById('stats-dataset-select');
    const refreshButton = document.getElementById('refresh-stats-datasets');
    const statsSections = document.getElementById('stats-sections');
    const loadingModal = document.getElementById('stats-loading-modal');
    
    // Initialize
    loadDatasets();
    setupEventListeners();
    
    // Utility function to safely format numbers
    function safeFormat(value, decimals = 4) {
        if (value === null || value === undefined || isNaN(value)) {
            return 'N/A';
        }
        return typeof value === 'number' ? value.toFixed(decimals) : value;
    }
    
    // Event listeners
    function setupEventListeners() {
        refreshButton.addEventListener('click', loadDatasets);
        datasetSelect.addEventListener('change', handleDatasetSelection);
        
        // Descriptive statistics
        document.getElementById('generate-descriptive').addEventListener('click', generateDescriptiveStats);
        
        // Normality tests
        document.getElementById('run-normality').addEventListener('click', runNormalityTest);
        
        // Correlation tests
        document.getElementById('run-correlation').addEventListener('click', runCorrelationTest);
        
        // T-tests
        document.getElementById('ttest-type').addEventListener('change', handleTTestTypeChange);
        document.getElementById('run-ttest').addEventListener('click', runTTest);
        
        // ANOVA
        document.getElementById('run-anova').addEventListener('click', runANOVA);
        
        // Chi-square tests
        document.getElementById('chi-test-type').addEventListener('change', handleChiTestTypeChange);
        document.getElementById('run-chi-square').addEventListener('click', runChiSquareTest);
        
        // Non-parametric tests
        document.getElementById('nonparam-test-type').addEventListener('change', handleNonParametricTypeChange);
        document.getElementById('run-nonparametric').addEventListener('click', runNonParametricTest);
        
        // Variance tests
        document.getElementById('run-variance-test').addEventListener('click', runVarianceTest);
        
        // McNemar test
        document.getElementById('run-mcnemar').addEventListener('click', runMcNemarTest);
        
        // Multiple comparisons
        document.getElementById('run-multiple-comparison').addEventListener('click', runMultipleComparison);
    }
    
    // Functions
    async function loadDatasets() {
        try {
            showLoading('Loading datasets...');
            
            // Fetch real datasets from the API
            const response = await fetch('/api/data/datasets');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            datasetSelect.innerHTML = '<option value="">Choose a dataset...</option>';
            
            if (data.success && data.datasets) {
                data.datasets.forEach(dataset => {
                    const option = document.createElement('option');
                    option.value = dataset.id;
                    option.textContent = `${dataset.filename} (${dataset.rows} rows, ${dataset.columns} cols)`;
                    datasetSelect.appendChild(option);
                });
            } else {
                showError('No datasets found. Please upload a dataset first.');
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
            statsSections.style.display = 'none';
            return;
        }
        
        currentDatasetId = selectedId;
        await loadDatasetColumns(selectedId);
        statsSections.style.display = 'block';
    }
    
    async function loadDatasetColumns(datasetId) {
        showLoading('Loading dataset columns...');
        
        try {
            // Fetch real columns from the API
            const response = await fetch(`/api/data/columns/${datasetId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.columns) {
                currentColumns = data.columns;
                populateColumnSelects(data.columns);
            } else {
                throw new Error(data.error || 'Failed to load columns');
            }
            
        } catch (error) {
            console.error('Error loading columns:', error);
            showError('Failed to load dataset columns: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function populateColumnSelects(columns) {
        // Get all select elements that need column population
        const selects = [
            'desc-columns', 'normality-column', 'corr-column1', 'corr-column2',
            'ttest-column', 'ttest-data-column', 'ttest-group-column', 'ttest-before', 'ttest-after',
            'anova-dependent', 'anova-independent', 'chi-var1', 'chi-var2', 'chi-observed',
            'mw-data-column', 'mw-group-column', 'wilcoxon-col1', 'wilcoxon-col2',
            'kw-dependent', 'kw-independent', 'friedman-columns', 'variance-columns',
            'mcnemar-col1', 'mcnemar-col2', 'mc-dependent', 'mc-independent'
        ];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const isMultiple = select.hasAttribute('multiple');
                const placeholder = selectId.includes('desc') ? 'Select columns...' : 'Choose column...';
                
                if (!isMultiple) {
                    select.innerHTML = `<option value="">${placeholder}</option>`;
                } else {
                    select.innerHTML = '';
                }
                
                columns.forEach(column => {
                    // Filter columns based on select type
                    let shouldInclude = true;
                    
                    if (selectId.includes('normality') || selectId.includes('corr') || 
                        selectId.includes('ttest') || selectId.includes('anova-dependent') ||
                        selectId.includes('mw-data') || selectId.includes('wilcoxon') ||
                        selectId.includes('kw-dependent') || selectId.includes('friedman') ||
                        selectId.includes('variance') || selectId.includes('mc-dependent')) {
                        shouldInclude = column.is_numeric;
                    }
                    
                    if (selectId.includes('group') || selectId.includes('anova-independent') ||
                        selectId.includes('kw-independent') || selectId.includes('mc-independent') ||
                        selectId.includes('chi') || selectId.includes('mcnemar')) {
                        shouldInclude = !column.is_numeric; // Categorical columns
                    }
                    
                    if (shouldInclude) {
                        const option = document.createElement('option');
                        option.value = column.name;
                        option.textContent = `${column.name} (${column.dtype})`;
                        select.appendChild(option);
                    }
                });
            }
        });
    }
    
    async function generateDescriptiveStats() {
        const selectedColumns = Array.from(document.getElementById('desc-columns').selectedOptions)
            .map(option => option.value);
        
        if (selectedColumns.length === 0) {
            showError('Please select at least one column');
            return;
        }
        
        showLoading('Generating descriptive statistics...');
        
        try {
            // Fetch real descriptive statistics from API
            const response = await fetch('/api/statistical/descriptive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    columns: selectedColumns
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.statistics) {
                displayDescriptiveStats(data.statistics);
            } else {
                throw new Error(data.error || 'Failed to generate descriptive statistics');
            }
            
        } catch (error) {
            console.error('Error generating descriptive statistics:', error);
            showError('Failed to generate descriptive statistics: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function displayDescriptiveStats(stats) {
        const container = document.getElementById('descriptive-results');
        
        let html = '<div class="stats-table-container">';
        
        // Handle both numeric and categorical statistics
        if (stats.numeric) {
            html += '<h4>Numeric Variables</h4>';
            html += '<table class="stats-table">';
            html += '<thead><tr><th>Statistic</th>';
            
            Object.keys(stats.numeric).forEach(column => {
                html += `<th>${column}</th>`;
            });
            
            html += '</tr></thead><tbody>';
            
            const statNames = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'];
            
            statNames.forEach(stat => {
                html += `<tr><td><strong>${stat}</strong></td>`;
                Object.values(stats.numeric).forEach(columnStats => {
                    const value = columnStats[stat];
                    if (value !== undefined && value !== null && !isNaN(value)) {
                        const displayValue = stat === 'count' ? value : parseFloat(value).toFixed(3);
                        html += `<td>${displayValue}</td>`;
                    } else {
                        html += `<td>N/A</td>`;
                    }
                });
                html += '</tr>';
            });
            
            html += '</tbody></table>';
        }
        
        if (stats.categorical) {
            html += '<h4>Categorical Variables</h4>';
            html += '<table class="stats-table">';
            html += '<thead><tr><th>Statistic</th>';
            
            Object.keys(stats.categorical).forEach(column => {
                html += `<th>${column}</th>`;
            });
            
            html += '</tr></thead><tbody>';
            
            const catStatNames = ['count', 'unique', 'top', 'freq'];
            
            catStatNames.forEach(stat => {
                html += `<tr><td><strong>${stat}</strong></td>`;
                Object.values(stats.categorical).forEach(columnStats => {
                    const value = columnStats[stat];
                    if (value !== undefined && value !== null) {
                        html += `<td>${value}</td>`;
                    } else {
                        html += `<td>N/A</td>`;
                    }
                });
                html += '</tr>';
            });
            
            html += '</tbody></table>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    async function runNormalityTest() {
        const column = document.getElementById('normality-column').value;
        const testType = document.getElementById('normality-test').value;
        
        if (!column) {
            showError('Please select a column');
            return;
        }
        
        showLoading('Running normality test...');
        
        try {
            // Run real normality test via API
            const response = await fetch('/api/statistical/normality', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    column: column,
                    test_type: testType
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.result) {
                displayNormalityResult(data.result, column, testType);
            } else {
                throw new Error(data.error || 'Failed to run normality test');
            }
            
        } catch (error) {
            console.error('Error running normality test:', error);
            showError('Failed to run normality test: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function displayNormalityResult(result, column, testType) {
        const container = document.getElementById('normality-results');
        
        // Safely handle undefined/null values
        if (!result || typeof result.p_value === 'undefined' || result.p_value === null) {
            container.innerHTML = `
                <div class="test-result error">
                    <h4>Normality Test Error</h4>
                    <p>Unable to perform normality test on "${column}". This may be due to:</p>
                    <ul>
                        <li>Non-numeric data in selected column</li>
                        <li>Insufficient data points</li>
                        <li>Missing or invalid values</li>
                    </ul>
                </div>
            `;
            return;
        }
        
        const isNormal = result.p_value >= 0.05;
        const conclusion = isNormal ? 
            'The data appears to be normally distributed' : 
            'The data does not appear to be normally distributed';
        
        const html = `
            <div class="test-result ${isNormal ? 'normal' : 'not-normal'}">
                <h4>${testType.replace('_', ' ').toUpperCase()} Test Results for "${column}"</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>Test Statistic:</strong> ${result.test_statistic && typeof result.test_statistic === 'number' ? result.test_statistic.toFixed(4) : 'N/A'}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${result.p_value && typeof result.p_value === 'number' ? result.p_value.toFixed(4) : 'N/A'}
                    </div>
                    <div class="stat-item">
                        <strong>Sample Size:</strong> ${result.sample_size || 'N/A'}
                    </div>
                    <div class="stat-item">
                        <strong>Significance Level:</strong> 0.05
                    </div>
                </div>
                <div class="conclusion">
                    <strong>Conclusion:</strong> ${conclusion}
                    ${result.p_value < 0.05 ? 
                        ' (p < α, reject null hypothesis)' : 
                        ' (p ≥ α, fail to reject null hypothesis)'}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    async function runCorrelationTest() {
        const column1 = document.getElementById('corr-column1').value;
        const column2 = document.getElementById('corr-column2').value;
        const method = document.getElementById('correlation-method').value;
        
        if (!column1 || !column2) {
            showError('Please select both columns');
            return;
        }
        
        if (column1 === column2) {
            showError('Please select different columns');
            return;
        }
        
        showLoading('Running correlation test...');
        
        try {
            // Run real correlation test via API
            const response = await fetch('/api/statistical/correlation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    column1: column1,
                    column2: column2,
                    method: method
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.result) {
                displayCorrelationResult(data.result, column1, column2, method);
            } else {
                throw new Error(data.error || 'Failed to run correlation test');
            }
            
        } catch (error) {
            console.error('Error running correlation test:', error);
            showError('Failed to run correlation test: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function displayCorrelationResult(result, column1, column2, method) {
        const container = document.getElementById('correlation-results');
        
        // Safely handle undefined or null result
        if (!result || typeof result.correlation === 'undefined' || result.correlation === null) {
            container.innerHTML = `
                <div class="test-result error">
                    <h4>Correlation Test Error</h4>
                    <p>Unable to calculate correlation between "${column1}" and "${column2}". This may be due to:</p>
                    <ul>
                        <li>Non-numeric data in selected columns</li>
                        <li>Insufficient data points</li>
                        <li>Missing or invalid values</li>
                    </ul>
                </div>
            `;
            return;
        }
        
        const strength = Math.abs(result.correlation);
        let strengthText = 'weak';
        if (strength > 0.7) strengthText = 'strong';
        else if (strength > 0.3) strengthText = 'moderate';
        
        const direction = result.correlation > 0 ? 'positive' : 'negative';
        
        const html = `
            <div class="test-result correlation">
                <h4>${method.toUpperCase()} Correlation: "${column1}" vs "${column2}"</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>Correlation Coefficient:</strong> ${result.correlation.toFixed(4)}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${result.p_value && typeof result.p_value === 'number' ? result.p_value.toFixed(4) : 'N/A'}
                    </div>
                    <div class="stat-item">
                        <strong>Sample Size:</strong> ${result.sample_size || 'N/A'}
                    </div>
                </div>
                <div class="conclusion">
                    <strong>Interpretation:</strong> There is a ${strengthText} ${direction} correlation between ${column1} and ${column2}.
                    ${result.p_value && result.p_value < 0.05 ? 
                        ' The correlation is statistically significant.' : 
                        ' The correlation is not statistically significant.'}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    function handleTTestTypeChange() {
        const testType = document.getElementById('ttest-type').value;
        
        // Hide all config sections
        document.querySelectorAll('.ttest-config').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show relevant section
        const sectionMap = {
            'one_sample': 'ttest-one-sample',
            'two_sample': 'ttest-two-sample', 
            'paired': 'ttest-paired'
        };
        
        const sectionId = sectionMap[testType];
        if (sectionId) {
            document.getElementById(sectionId).style.display = 'block';
        }
    }
    
    async function runTTest() {
        const testType = document.getElementById('ttest-type').value;
        const alpha = parseFloat(document.getElementById('alpha-level').value);
        
        // Get test-specific parameters
        let requestData = {
            dataset_id: currentDatasetId,
            test_type: testType,
            alpha: alpha
        };
        
        if (testType === 'one_sample') {
            requestData.column = document.getElementById('ttest-column').value;
            requestData.mu = parseFloat(document.getElementById('test-value').value);
        } else if (testType === 'two_sample') {
            requestData.column = document.getElementById('ttest-data-column').value;
            requestData.group_column = document.getElementById('ttest-group-column').value;
        } else if (testType === 'paired') {
            requestData.column1 = document.getElementById('ttest-before').value;
            requestData.column2 = document.getElementById('ttest-after').value;
        }
        
        showLoading('Running T-test...');
        
        try {
            // Run real T-test via API
            const response = await fetch('/api/statistical/ttest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.result) {
                displayTTestResult(data.result, testType, alpha);
            } else {
                throw new Error(data.error || 'Failed to run T-test');
            }
            
        } catch (error) {
            console.error('Error running t-test:', error);
            showError('Failed to run t-test: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function displayTTestResult(result, testType, alpha) {
        const container = document.getElementById('ttest-results');
        
        // Safely handle undefined or null result
        if (!result || typeof result.statistic === 'undefined' || typeof result.p_value === 'undefined') {
            container.innerHTML = `
                <div class="test-result error">
                    <h4>T-Test Error</h4>
                    <p>Unable to perform T-test. Please check that the selected columns contain valid numeric data.</p>
                </div>
            `;
            return;
        }
        
        const isSignificant = result.p_value < alpha;
        const testName = testType.replace('_', ' ').toUpperCase() + ' T-Test';
        
        const html = `
            <div class="test-result ${isSignificant ? 'significant' : 'not-significant'}">
                <h4>${testName} Results</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>T-statistic:</strong> ${safeFormat(result.test_statistic || result.statistic)}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${safeFormat(result.p_value)}
                    </div>
                    <div class="stat-item">
                        <strong>Degrees of Freedom:</strong> ${result.degrees_of_freedom || 'N/A'}
                    </div>
                    ${result.effect_size && typeof result.effect_size === 'number' ? `
                    <div class="stat-item">
                        <strong>Effect Size:</strong> ${safeFormat(result.effect_size)}
                    </div>
                    ` : ''}
                </div>
                <div class="conclusion">
                    <strong>Conclusion:</strong> 
                    ${isSignificant ? 
                        'The test is statistically significant. We reject the null hypothesis.' : 
                        'The test is not statistically significant. We fail to reject the null hypothesis.'}
                    (α = ${alpha})
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    function handleChiTestTypeChange() {
        const testType = document.getElementById('chi-test-type').value;
        
        document.getElementById('chi-independence').style.display = 
            testType === 'independence' ? 'block' : 'none';
        document.getElementById('chi-goodness').style.display = 
            testType === 'goodness_of_fit' ? 'block' : 'none';
    }
    
    async function runANOVA() {
        const dependent = document.getElementById('anova-dependent').value;
        const independent = Array.from(document.getElementById('anova-independent').selectedOptions)
            .map(option => option.value);
        const anovaType = document.getElementById('anova-type').value;
        
        if (!dependent || independent.length === 0) {
            showError('Please select dependent and independent variables');
            return;
        }
        
        showLoading('Running ANOVA...');
        
        try {
            // Run real ANOVA via API
            const response = await fetch('/api/statistical/anova', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    dependent: dependent,
                    independent: independent,
                    anova_type: anovaType
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.result) {
                displayANOVAResult(data.result, dependent, independent, anovaType);
            } else {
                throw new Error(data.error || 'Failed to run ANOVA');
            }
            
        } catch (error) {
            console.error('Error running ANOVA:', error);
            showError('Failed to run ANOVA: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function displayANOVAResult(result, dependent, independent, anovaType) {
        const container = document.getElementById('anova-results');
        
        // Safely handle undefined or null result
        if (!result || typeof result.f_statistic === 'undefined' || typeof result.p_value === 'undefined') {
            container.innerHTML = `
                <div class="test-result error">
                    <h4>ANOVA Error</h4>
                    <p>Unable to perform ANOVA test. Please check that the selected variables contain valid data.</p>
                </div>
            `;
            return;
        }
        
        const isSignificant = result.p_value < 0.05;
        
        const html = `
            <div class="test-result ${isSignificant ? 'significant' : 'not-significant'}">
                <h4>${anovaType.replace('_', '-').toUpperCase()} ANOVA Results</h4>
                <p><strong>Dependent Variable:</strong> ${dependent}</p>
                <p><strong>Independent Variables:</strong> ${independent.join(', ')}</p>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>F-statistic:</strong> ${safeFormat(result.f_statistic)}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${safeFormat(result.p_value)}
                    </div>
                    <div class="stat-item">
                        <strong>Degrees of Freedom:</strong> ${result.degrees_of_freedom ? (Array.isArray(result.degrees_of_freedom) ? result.degrees_of_freedom.join(', ') : result.degrees_of_freedom) : 'N/A'}
                    </div>
                </div>
                <div class="conclusion">
                    <strong>Conclusion:</strong> 
                    ${isSignificant ? 
                        'There is a statistically significant difference between groups.' : 
                        'There is no statistically significant difference between groups.'}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    async function runChiSquareTest() {
        const testType = document.getElementById('chi-test-type').value;
        
        showLoading('Running chi-square test...');
        
        try {
            // Run real chi-square test via API
            const response = await fetch('/api/statistical/chi_square', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    test_type: testType,
                    var1: document.getElementById('chi-var1').value,
                    var2: document.getElementById('chi-var2').value,
                    observed: document.getElementById('chi-observed').value
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.result) {
                displayChiSquareResult(data.result, testType);
            } else {
                throw new Error(data.error || 'Failed to run chi-square test');
            }
            
        } catch (error) {
            console.error('Error running chi-square test:', error);
            showError('Failed to run chi-square test: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function displayChiSquareResult(result, testType) {
        const container = document.getElementById('chi-square-results');
        
        // Safely handle undefined or null result
        if (!result || typeof result.chi2_statistic === 'undefined' || typeof result.p_value === 'undefined') {
            container.innerHTML = `
                <div class="test-result error">
                    <h4>Chi-Square Test Error</h4>
                    <p>Unable to perform Chi-square test. Please check that the selected variables contain valid categorical data.</p>
                </div>
            `;
            return;
        }
        
        const isSignificant = result.p_value < 0.05;
        const testName = testType.replace('_', ' ').toUpperCase();
        
        const html = `
            <div class="test-result ${isSignificant ? 'significant' : 'not-significant'}">
                <h4>Chi-Square ${testName} Test Results</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>Chi-square statistic:</strong> ${safeFormat(result.chi2_statistic)}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${safeFormat(result.p_value)}
                    </div>
                    <div class="stat-item">
                        <strong>Degrees of Freedom:</strong> ${result.degrees_of_freedom || 'N/A'}
                    </div>
                    <div class="stat-item">
                        <strong>Cramér's V:</strong> ${safeFormat(result.cramers_v)}
                    </div>
                </div>
                <div class="conclusion">
                    <strong>Conclusion:</strong> 
                    ${isSignificant ? 
                        'There is a statistically significant association between the variables.' : 
                        'There is no statistically significant association between the variables.'}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    // Non-parametric test handlers
    function handleNonParametricTypeChange() {
        const testType = document.getElementById('nonparam-test-type').value;
        
        // Hide all config sections
        document.querySelectorAll('.nonparam-config').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show relevant section
        const sectionMap = {
            'mann_whitney': 'mann-whitney-config',
            'wilcoxon': 'wilcoxon-config',
            'kruskal_wallis': 'kruskal-config',
            'friedman': 'friedman-config'
        };
        
        const sectionId = sectionMap[testType];
        if (sectionId) {
            document.getElementById(sectionId).style.display = 'block';
        }
    }

    async function runNonParametricTest() {
        const testType = document.getElementById('nonparam-test-type').value;
        
        let endpoint = '/api/statistical/';
        let requestData = { dataset_id: currentDatasetId };
        
        // Get test-specific parameters and set endpoint
        if (testType === 'mann_whitney') {
            endpoint += 'mann_whitney';
            requestData.column = document.getElementById('mw-data-column').value;
            requestData.group_column = document.getElementById('mw-group-column').value;
        } else if (testType === 'wilcoxon') {
            endpoint += 'wilcoxon';
            requestData.column1 = document.getElementById('wilcoxon-col1').value;
            requestData.column2 = document.getElementById('wilcoxon-col2').value;
        } else if (testType === 'kruskal_wallis') {
            endpoint += 'kruskal_wallis';
            requestData.dependent_var = document.getElementById('kw-dependent').value;
            requestData.independent_var = document.getElementById('kw-independent').value;
        } else if (testType === 'friedman') {
            endpoint += 'friedman';
            const selectedColumns = Array.from(document.getElementById('friedman-columns').selectedOptions)
                .map(option => option.value);
            requestData.columns = selectedColumns;
        }
        
        showLoading('Running non-parametric test...');
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.results) {
                displayNonParametricResult(data.results, testType);
            } else {
                throw new Error(data.error || 'Failed to run non-parametric test');
            }
            
        } catch (error) {
            console.error('Error running non-parametric test:', error);
            showError('Failed to run non-parametric test: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    function displayNonParametricResult(result, testType) {
        const container = document.getElementById('nonparametric-results');
        
        const isSignificant = result.p_value < 0.05;
        const testName = testType.replace('_', ' ').toUpperCase() + ' Test';
        
        let html = `
            <div class="test-result ${isSignificant ? 'significant' : 'not-significant'}">
                <h4>${testName} Results</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>Test Statistic:</strong> ${safeFormat(result.test_statistic || result.statistic || result.h_statistic || result.u_statistic || result.chi2_statistic)}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${safeFormat(result.p_value)}
                    </div>
                    <div class="stat-item">
                        <strong>Sample Size:</strong> ${result.sample_size || (result.group1_size && result.group2_size ? result.group1_size + result.group2_size : 'N/A')}
                    </div>
                    ${result.effect_size ? `
                    <div class="stat-item">
                        <strong>Effect Size:</strong> ${safeFormat(result.effect_size)}
                    </div>
                    ` : ''}
                </div>
                <div class="conclusion">
                    <strong>Conclusion:</strong> ${result.interpretation || 
                        (isSignificant ? 
                            'Result is statistically significant (p < 0.05)' : 
                            'Result is not statistically significant (p ≥ 0.05)')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    async function runVarianceTest() {
        const testType = document.getElementById('variance-test-type').value;
        const selectedColumns = Array.from(document.getElementById('variance-columns').selectedOptions)
            .map(option => option.value);
        
        if (selectedColumns.length < 2) {
            showError('Please select at least 2 columns');
            return;
        }
        
        showLoading('Running variance test...');
        
        try {
            const response = await fetch('/api/statistical/variance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    columns: selectedColumns,
                    test_type: testType
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.results) {
                displayVarianceResult(data.results, testType);
            } else {
                throw new Error(data.error || 'Failed to run variance test');
            }
            
        } catch (error) {
            console.error('Error running variance test:', error);
            showError('Failed to run variance test: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    function displayVarianceResult(result, testType) {
        const container = document.getElementById('variance-results');
        
        const isSignificant = result.p_value < 0.05;
        const testName = testType.toUpperCase() + ' Test';
        
        const html = `
            <div class="test-result ${isSignificant ? 'significant' : 'not-significant'}">
                <h4>${testName} Results</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>Test Statistic:</strong> ${safeFormat(result.test_statistic)}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${safeFormat(result.p_value)}
                    </div>
                    <div class="stat-item">
                        <strong>Degrees of Freedom:</strong> ${result.degrees_of_freedom || 'N/A'}
                    </div>
                </div>
                <div class="conclusion">
                    <strong>Conclusion:</strong> ${result.interpretation || 
                        (isSignificant ? 
                            'Variances are significantly different' : 
                            'Variances are not significantly different')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    async function runMcNemarTest() {
        const column1 = document.getElementById('mcnemar-col1').value;
        const column2 = document.getElementById('mcnemar-col2').value;
        
        if (!column1 || !column2) {
            showError('Please select both columns');
            return;
        }
        
        showLoading('Running McNemar test...');
        
        try {
            const response = await fetch('/api/statistical/mcnemar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    column1: column1,
                    column2: column2
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.results) {
                displayMcNemarResult(data.results, column1, column2);
            } else {
                throw new Error(data.error || 'Failed to run McNemar test');
            }
            
        } catch (error) {
            console.error('Error running McNemar test:', error);
            showError('Failed to run McNemar test: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    function displayMcNemarResult(result, column1, column2) {
        const container = document.getElementById('mcnemar-results');
        
        const isSignificant = result.p_value < 0.05;
        
        const html = `
            <div class="test-result ${isSignificant ? 'significant' : 'not-significant'}">
                <h4>McNemar Test Results: "${column1}" vs "${column2}"</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <strong>Test Statistic:</strong> ${safeFormat(result.test_statistic)}
                    </div>
                    <div class="stat-item">
                        <strong>P-value:</strong> ${safeFormat(result.p_value)}
                    </div>
                    <div class="stat-item">
                        <strong>Test Type:</strong> ${result.test_type}
                    </div>
                </div>
                <div class="conclusion">
                    <strong>Conclusion:</strong> ${result.interpretation || 
                        (isSignificant ? 
                            'Marginal probabilities are significantly different' : 
                            'Marginal probabilities are not significantly different')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    async function runMultipleComparison() {
        const dependent = document.getElementById('mc-dependent').value;
        const independent = document.getElementById('mc-independent').value;
        const method = document.getElementById('mc-method').value;
        
        if (!dependent || !independent) {
            showError('Please select both dependent and independent variables');
            return;
        }
        
        showLoading('Running multiple comparison...');
        
        try {
            const response = await fetch('/api/statistical/multiple_comparison', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    dependent: dependent,
                    independent: independent,
                    method: method
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.results) {
                displayMultipleComparisonResult(data.results, dependent, independent, method);
            } else {
                throw new Error(data.error || 'Failed to run multiple comparison');
            }
            
        } catch (error) {
            console.error('Error running multiple comparison:', error);
            showError('Failed to run multiple comparison: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    function displayMultipleComparisonResult(result, dependent, independent, method) {
        const container = document.getElementById('multiple-comparison-results');
        
        const testName = method.toUpperCase() + ' Multiple Comparisons';
        
        let html = `
            <div class="test-result">
                <h4>${testName}: "${dependent}" by "${independent}"</h4>
        `;
        
        if (result.group_comparisons) {
            html += `
                <div class="comparisons-table">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Group 1</th>
                                <th>Group 2</th>
                                <th>Mean Diff</th>
                                <th>P-value</th>
                                <th>Significant</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.group_comparisons.forEach(comp => {
                html += `
                    <tr>
                        <td>${comp.group1}</td>
                        <td>${comp.group2}</td>
                        <td>${safeFormat(comp.mean_diff)}</td>
                        <td>${safeFormat(comp.p_value)}</td>
                        <td>${comp.reject ? 'Yes' : 'No'}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        html += `</div>`;
        container.innerHTML = html;
    }

    function showLoading(message = 'Loading...') {
        loadingModal.querySelector('.modal-content').textContent = message;
        loadingModal.style.display = 'flex';
    }
    
    function hideLoading() {
        loadingModal.style.display = 'none';
    }
    
    function showError(message) {
        alert(message); // In a real app, use a proper notification system
    }
    
    // Initialize t-test and chi-square sections
    handleTTestTypeChange();
    handleChiTestTypeChange();
    handleNonParametricTypeChange();
});