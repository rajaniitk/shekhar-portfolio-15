from flask import Blueprint, request, jsonify, session
from services.statistical_tests import StatisticalTests
from database import db
from models import Dataset, Analysis
import logging

statistical_tests_bp = Blueprint('statistical_tests', __name__, url_prefix='/api/statistical')

@statistical_tests_bp.route('/datasets', methods=['GET'])
def get_datasets():
    """Get all available datasets for analysis operations"""
    try:
        # Query all datasets from the database
        datasets = Dataset.query.all()
        dataset_list = []

        # Iterate through each dataset and format the data for JSON response
        for dataset in datasets:
            dataset_list.append({
                'id': dataset.id,
                'filename': dataset.filename,
                'rows': dataset.num_rows,
                'columns': dataset.num_columns,
                'file_size': dataset.file_size,
                # Safely format the upload timestamp:
                # If dataset.created_at is None, assign None. Otherwise, call isoformat().
                'created_at': dataset.upload_timestamp.isoformat() if dataset.upload_timestamp else None
            })

        # Return a successful JSON response with the list of datasets
        return jsonify({
            'success': True,
            'datasets': dataset_list
        })

    except Exception as e:
        # Log the error on the server side for debugging
        logging.error(f"Error fetching datasets: {str(e)}")
        # Return a JSON response indicating failure and the error message, with a 500 status code
        return jsonify({'success': False, 'error': f"An internal server error occurred while retrieving datasets: {str(e)}"}), 500

@statistical_tests_bp.route('/descriptive', methods=['POST'])
def descriptive_statistics():
    """Generate descriptive statistics for selected columns"""
    try:
        dataset_id = request.json.get('dataset_id')
        columns = request.json.get('columns', [])
        
        if not dataset_id or not columns:
            return jsonify({'success': False, 'error': 'Dataset ID and columns are required'}), 400
        
        service = StatisticalTests()
        result = service.get_descriptive_statistics_by_id(dataset_id, columns)
        
        if result['success']:
            return jsonify({
                'success': True,
                'statistics': result['statistics']
            })
        else:
            return jsonify({'success': False, 'error': result['error']}), 400
        
    except Exception as e:
        logging.error(f"Descriptive statistics error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/normality', methods=['POST'])
def normality_test():
    """Perform normality test on a column"""
    try:
        dataset_id = request.json.get('dataset_id')
        column = request.json.get('column')
        test_type = request.json.get('test_type', 'shapiro')
        
        if not dataset_id or not column:
            return jsonify({'success': False, 'error': 'Dataset ID and column are required'}), 400
        
        service = StatisticalTests()
        result = service.normality_test(dataset_id, column, test_type)
        
        if result['success']:
            return jsonify({
                'success': True,
                'result': result['results']
            })
        else:
            return jsonify({'success': False, 'error': result['error']}), 400
        
    except Exception as e:
        logging.error(f"Normality test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/correlation', methods=['POST'])
def correlation_test():
    """Perform correlation test between two columns"""
    try:
        dataset_id = request.json.get('dataset_id')
        column1 = request.json.get('column1')
        column2 = request.json.get('column2')
        method = request.json.get('method', 'pearson')
        
        if not dataset_id or not column1 or not column2:
            return jsonify({'success': False, 'error': 'Dataset ID and both columns are required'}), 400
        
        service = StatisticalTests()
        result = service.correlation_test(dataset_id, column1, column2, method)
        
        if result['success']:
            return jsonify({
                'success': True,
                'result': result['results']
            })
        else:
            return jsonify({'success': False, 'error': result['error']}), 400
        
    except Exception as e:
        logging.error(f"Correlation test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/ttest', methods=['POST'])
def t_test():
    """Perform t-test"""
    try:
        dataset_id = request.json.get('dataset_id')
        test_type = request.json.get('test_type')
        alpha = request.json.get('alpha', 0.05)
        
        if not dataset_id or not test_type:
            return jsonify({'success': False, 'error': 'Dataset ID and test type are required'}), 400
        
        dataset = Dataset.query.get_or_404(dataset_id)
        service = StatisticalTests()
        
        if test_type == 'one_sample':
            column = request.json.get('column')
            mu = request.json.get('mu', 0)
            result = service.ttest(dataset_id, column, 'one_sample', mu)
        elif test_type == 'two_sample':
            column = request.json.get('column')
            group_column = request.json.get('group_column')
            result = service.ttest(dataset_id, column, 'two_sample', group_column=group_column)
        elif test_type == 'paired':
            column1 = request.json.get('column1')
            column2 = request.json.get('column2')
            result = service.wilcoxon(dataset_id, column1, column2)  # Use wilcoxon for paired data
        else:
            return jsonify({'success': False, 'error': 'Invalid test type'}), 400
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        logging.error(f"T-test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/anova', methods=['POST'])
def anova_test():
    """Perform ANOVA test"""
    try:
        dataset_id = request.json.get('dataset_id')
        dependent = request.json.get('dependent')
        independent = request.json.get('independent', [])
        anova_type = request.json.get('anova_type', 'one_way')
        
        if not dataset_id or not dependent or not independent:
            return jsonify({'success': False, 'error': 'Dataset ID, dependent and independent variables are required'}), 400
        
        dataset = Dataset.query.get_or_404(dataset_id)
        service = StatisticalTests()
        
        if anova_type == 'one_way':
            result = service.anova(dataset_id, dependent, independent[0] if independent else None, 'one_way')
        else:
            return jsonify({'success': False, 'error': f'ANOVA type {anova_type} not implemented'}), 400
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        logging.error(f"ANOVA test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/chi_square', methods=['POST'])
def chi_square_test():
    """Perform chi-square test"""
    try:
        dataset_id = request.json.get('dataset_id')
        test_type = request.json.get('test_type')
        var1 = request.json.get('var1')
        var2 = request.json.get('var2')
        
        if not dataset_id or not test_type:
            return jsonify({'success': False, 'error': 'Dataset ID and test type are required'}), 400
        
        dataset = Dataset.query.get_or_404(dataset_id)
        service = StatisticalTests()
        
        result = service.chi_square(dataset_id, var1, var2, test_type)
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        logging.error(f"Chi-square test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/variance', methods=['POST'])
def test_equal_variance():
    try:
        dataset_id = request.json.get('dataset_id')
        columns = request.json.get('columns', [])
        test_type = request.json.get('test_type', 'levene')
        
        if not dataset_id or not columns:
            return jsonify({'success': False, 'error': 'Dataset ID and columns are required'}), 400
        
        dataset = Dataset.query.get_or_404(dataset_id)
        stats = StatisticalTests()
        
        results = stats.variance_test(dataset_id, columns, test_type)
        
        return jsonify({
            'success': True,
            'results': results['results'] if results['success'] else None,
            'error': results.get('error')
        })
        
    except Exception as e:
        logging.error(f"Variance test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/nonparametric/<int:dataset_id>', methods=['POST'])
def perform_nonparametric(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        stats = StatisticalTests()
        
        columns = request.json.get('columns', [])
        test_type = request.json.get('test_type', 'mann_whitney')
        
        if not columns:
            return jsonify({'error': 'Columns parameter is required'}), 400
        
        results = stats.perform_nonparametric_test(dataset.file_path, columns, test_type)
        
        # Save analysis to database
        analysis = Analysis(
            dataset_id=dataset_id,
            analysis_type='statistical_test',
            analysis_name=f'Non-parametric Test ({test_type})',
            parameters={'columns': columns, 'test_type': test_type},
            results=results
        )
        db.session.add(analysis)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'results': results,
            'analysis_id': analysis.id
        })
        
    except Exception as e:
        logging.error(f"Non-parametric test error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@statistical_tests_bp.route('/goodness_of_fit/<int:dataset_id>', methods=['POST'])
def test_goodness_of_fit(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        stats = StatisticalTests()
        
        column = request.json.get('column')
        distribution = request.json.get('distribution', 'normal')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        results = stats.test_goodness_of_fit(dataset.file_path, column, distribution)
        
        # Save analysis to database
        analysis = Analysis(
            dataset_id=dataset_id,
            analysis_type='statistical_test',
            analysis_name=f'Goodness of Fit Test ({distribution})',
            parameters={'column': column, 'distribution': distribution},
            results=results
        )
        db.session.add(analysis)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'results': results,
            'analysis_id': analysis.id
        })
        
    except Exception as e:
        logging.error(f"Goodness of fit test error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@statistical_tests_bp.route('/multiple_comparisons/<int:dataset_id>', methods=['POST'])
def perform_multiple_comparisons(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        stats = StatisticalTests()
        
        columns = request.json.get('columns', [])
        method = request.json.get('method', 'tukey')
        
        if not columns:
            return jsonify({'error': 'Columns parameter is required'}), 400
        
        results = stats.perform_multiple_comparisons(dataset.file_path, columns, method)
        
        # Save analysis to database
        analysis = Analysis(
            dataset_id=dataset_id,
            analysis_type='statistical_test',
            analysis_name=f'Multiple Comparisons ({method})',
            parameters={'columns': columns, 'method': method},
            results=results
        )
        db.session.add(analysis)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'results': results,
            'analysis_id': analysis.id
        })
        
    except Exception as e:
        logging.error(f"Multiple comparisons error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@statistical_tests_bp.route('/available_tests')
def get_available_tests():
    try:
        stats = StatisticalTests()
        tests = stats.get_available_tests()
        
        return jsonify({
            'success': True,
            'tests': tests
        })
        
    except Exception as e:
        logging.error(f"Get available tests error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@statistical_tests_bp.route('/list/<int:dataset_id>')
def list_statistical_tests(dataset_id):
    try:
        analyses = Analysis.query.filter_by(dataset_id=dataset_id, analysis_type='statistical_test').all()
        
        test_list = []
        for analysis in analyses:
            test_list.append({
                'id': analysis.id,
                'name': analysis.analysis_name,
                'parameters': analysis.parameters,
                'results': analysis.results,
                'created_at': analysis.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'tests': test_list
        })
        
    except Exception as e:
        logging.error(f"List statistical tests error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Individual statistical test routes
@statistical_tests_bp.route('/mann_whitney', methods=['POST'])
def mann_whitney_test():
    try:
        dataset_id = request.json.get('dataset_id')
        column = request.json.get('column')
        group_column = request.json.get('group_column')
        
        if not dataset_id or not column or not group_column:
            return jsonify({'success': False, 'error': 'Dataset ID, column, and group column are required'}), 400
        
        service = StatisticalTests()
        result = service.mann_whitney(dataset_id, column, group_column)
        
        return jsonify({
            'success': True,
            'results': result['results'] if result['success'] else None,
            'error': result.get('error')
        })
        
    except Exception as e:
        logging.error(f"Mann-Whitney test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/wilcoxon', methods=['POST'])
def wilcoxon_test():
    try:
        dataset_id = request.json.get('dataset_id')
        column1 = request.json.get('column1')
        column2 = request.json.get('column2')
        
        if not dataset_id or not column1 or not column2:
            return jsonify({'success': False, 'error': 'Dataset ID and both columns are required'}), 400
        
        service = StatisticalTests()
        result = service.wilcoxon(dataset_id, column1, column2)
        
        return jsonify({
            'success': True,
            'results': result['results'] if result['success'] else None,
            'error': result.get('error')
        })
        
    except Exception as e:
        logging.error(f"Wilcoxon test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/kruskal_wallis', methods=['POST'])
def kruskal_wallis_test():
    try:
        dataset_id = request.json.get('dataset_id')
        dependent_var = request.json.get('dependent_var')
        independent_var = request.json.get('independent_var')
        
        if not dataset_id or not dependent_var or not independent_var:
            return jsonify({'success': False, 'error': 'Dataset ID, dependent and independent variables are required'}), 400
        
        service = StatisticalTests()
        result = service.kruskal_wallis(dataset_id, dependent_var, independent_var)
        
        return jsonify({
            'success': True,
            'results': result['results'] if result['success'] else None,
            'error': result.get('error')
        })
        
    except Exception as e:
        logging.error(f"Kruskal-Wallis test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/friedman', methods=['POST'])
def friedman_test():
    try:
        dataset_id = request.json.get('dataset_id')
        columns = request.json.get('columns', [])
        
        if not dataset_id or not columns or len(columns) < 3:
            return jsonify({'success': False, 'error': 'Dataset ID and at least 3 columns are required'}), 400
        
        service = StatisticalTests()
        result = service.friedman(dataset_id, columns)
        
        return jsonify({
            'success': True,
            'results': result['results'] if result['success'] else None,
            'error': result.get('error')
        })
        
    except Exception as e:
        logging.error(f"Friedman test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/mcnemar', methods=['POST'])
def mcnemar_test():
    try:
        dataset_id = request.json.get('dataset_id')
        column1 = request.json.get('column1')
        column2 = request.json.get('column2')
        
        if not dataset_id or not column1 or not column2:
            return jsonify({'success': False, 'error': 'Dataset ID and both columns are required'}), 400
        
        service = StatisticalTests()
        result = service.mcnemar(dataset_id, column1, column2)
        
        return jsonify({
            'success': True,
            'results': result['results'] if result['success'] else None,
            'error': result.get('error')
        })
        
    except Exception as e:
        logging.error(f"McNemar test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@statistical_tests_bp.route('/multiple_comparisons', methods=['POST'])
def multiple_comparisons_test():
    try:
        dataset_id = request.json.get('dataset_id')
        dependent_var = request.json.get('dependent_var')
        independent_var = request.json.get('independent_var')
        method = request.json.get('method', 'tukey')
        
        if not dataset_id or not dependent_var or not independent_var:
            return jsonify({'success': False, 'error': 'Dataset ID, dependent and independent variables are required'}), 400
        
        service = StatisticalTests()
        result = service.multiple_comparison(dataset_id, dependent_var, independent_var, method)
        
        return jsonify({
            'success': True,
            'results': result['results'] if result['success'] else None,
            'error': result.get('error')
        })
        
    except Exception as e:
        logging.error(f"Multiple comparisons test error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
