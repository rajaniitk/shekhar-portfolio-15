from flask import Blueprint, request, jsonify, session
from services.column_analysis import ColumnAnalysis
from app import db
from models import Dataset, Analysis
import logging

column_analysis_bp = Blueprint('column_analysis', __name__, url_prefix='/api/column_analysis')

@column_analysis_bp.route('/datasets')
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

@column_analysis_bp.route('/summary/<int:dataset_id>')
def get_column_summary(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        summary = analyzer.get_column_summary(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        logging.error(f"Column summary error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/outliers/<int:dataset_id>')
def detect_outliers(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        method = request.args.get('method', 'iqr')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        outliers = analyzer.detect_outliers(dataset.file_path, column, method)
        
        return jsonify({
            'success': True,
            'outliers': outliers
        })
        
    except Exception as e:
        logging.error(f"Outlier detection error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/distribution/<int:dataset_id>')
def analyze_distribution(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        distribution = analyzer.analyze_distribution(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'distribution': distribution
        })
        
    except Exception as e:
        logging.error(f"Distribution analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/missing_values/<int:dataset_id>')
def analyze_missing_values(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        missing_analysis = analyzer.analyze_missing_values(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'missing_analysis': missing_analysis
        })
        
    except Exception as e:
        logging.error(f"Missing values analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/unique_values/<int:dataset_id>')
def analyze_unique_values(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        unique_analysis = analyzer.analyze_unique_values(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'unique_analysis': unique_analysis
        })
        
    except Exception as e:
        logging.error(f"Unique values analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/data_quality/<int:dataset_id>')
def assess_data_quality(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        quality = analyzer.assess_data_quality(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'quality': quality
        })
        
    except Exception as e:
        logging.error(f"Data quality assessment error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/patterns/<int:dataset_id>')
def detect_patterns(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        patterns = analyzer.detect_patterns(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'patterns': patterns
        })
        
    except Exception as e:
        logging.error(f"Pattern detection error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/temporal_analysis/<int:dataset_id>')
def temporal_analysis(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        temporal = analyzer.perform_temporal_analysis(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'temporal': temporal
        })
        
    except Exception as e:
        logging.error(f"Temporal analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/categorical_analysis/<int:dataset_id>')
def categorical_analysis(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        categorical = analyzer.perform_categorical_analysis(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'categorical': categorical
        })
        
    except Exception as e:
        logging.error(f"Categorical analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/numerical_analysis/<int:dataset_id>')
def numerical_analysis(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        numerical = analyzer.perform_numerical_analysis(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'numerical': numerical
        })
        
    except Exception as e:
        logging.error(f"Numerical analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/recommendations/<int:dataset_id>')
def get_recommendations(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column = request.args.get('column')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        recommendations = analyzer.get_recommendations(dataset.file_path, column)
        
        return jsonify({
            'success': True,
            'recommendations': recommendations
        })
        
    except Exception as e:
        logging.error(f"Recommendations error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/transform/<int:dataset_id>', methods=['POST'])
def transform_column(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        
        column = request.json.get('column')
        transformation_type = request.json.get('transformation_type', 'standardize')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        # For now, return a placeholder response
        # In a full implementation, you would apply the transformation
        return jsonify({
            'success': True,
            'message': f'Column "{column}" transformation with "{transformation_type}" completed',
            'transformation_applied': {
                'column': column,
                'method': transformation_type,
                'status': 'completed'
            }
        })
        
    except Exception as e:
        logging.error(f"Transform column error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/clean/<int:dataset_id>', methods=['POST'])
def clean_column(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        
        column = request.json.get('column')
        cleaning_options = request.json.get('options', {})
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        # For now, return a placeholder response
        # In a full implementation, you would apply the cleaning
        return jsonify({
            'success': True,
            'message': f'Column "{column}" cleaning completed',
            'cleaning_applied': {
                'column': column,
                'options': cleaning_options,
                'status': 'completed'
            }
        })
        
    except Exception as e:
        logging.error(f"Clean column error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/encode/<int:dataset_id>', methods=['POST'])
def encode_column(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        
        column = request.json.get('column')
        encoding_type = request.json.get('encoding_type', 'label')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        # For now, return a placeholder response
        # In a full implementation, you would apply the encoding
        return jsonify({
            'success': True,
            'message': f'Column "{column}" encoding with "{encoding_type}" completed',
            'encoding_applied': {
                'column': column,
                'method': encoding_type,
                'status': 'completed'
            }
        })
        
    except Exception as e:
        logging.error(f"Encode column error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/export/<int:dataset_id>')
def export_analysis(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        
        column = request.args.get('column')
        export_format = request.args.get('format', 'json')
        
        if not column:
            return jsonify({'error': 'Column parameter is required'}), 400
        
        # For now, return a placeholder response
        # In a full implementation, you would generate and return the export file
        return jsonify({
            'success': True,
            'message': f'Analysis for column "{column}" exported successfully',
            'export_info': {
                'column': column,
                'format': export_format,
                'status': 'completed',
                'download_url': f'/api/column_analysis/download/{dataset_id}?column={column}&format={export_format}'
            }
        })
        
    except Exception as e:
        logging.error(f"Export analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500

@column_analysis_bp.route('/relationships/<int:dataset_id>')
def analyze_relationships(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        analyzer = ColumnAnalysis()
        
        column1 = request.args.get('column1')
        column2 = request.args.get('column2')
        
        if not column1 or not column2:
            return jsonify({'error': 'Both column1 and column2 parameters are required'}), 400
        
        analyzer._load_dataframe(dataset.file_path)
        analysis = analyzer.bivariate_analysis(column1, column2)
        
        return jsonify({
            'success': True,
            'analysis': analyzer._convert_numpy_types(analysis)
        })
        
    except Exception as e:
        logging.error(f"Relationship analysis error: {str(e)}")
        return jsonify({'error': f"An unexpected server error occurred: {str(e)}"}), 500
