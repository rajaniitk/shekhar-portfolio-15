from flask import Blueprint, request, jsonify, render_template, current_app, session
from services.comparison import Comparison
from services.data_processor import DataProcessor
from database import db
from models import Dataset, Analysis
import logging
import pandas as pd

comparison_bp = Blueprint('comparison', __name__, url_prefix='/api/comparison')

@comparison_bp.route('/datasets', methods=['GET'])
def get_datasets():
    """Get all available datasets for comparison operations"""
    try:
        # Query all datasets from the database
        datasets = Dataset.query.all()
        dataset_list = []

        # Iterate through each dataset and format the data for JSON response
        for dataset in datasets:
            dataset_list.append({
                'id': dataset.id,
                'name': dataset.filename,
                'filename': dataset.filename,
                'rows': dataset.num_rows,
                'columns': dataset.num_columns,
                'file_size': dataset.file_size,
                'column_names': dataset.column_names,
                # Safely format the upload timestamp:
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

@comparison_bp.route('/datasets', methods=['POST'])
def compare_datasets():
    """Compare multiple datasets"""
    try:
        data = request.get_json()
        dataset_ids = data.get('dataset_ids', [])
        
        if len(dataset_ids) < 2:
            return jsonify({'success': False, 'error': 'At least 2 datasets are required for comparison'}), 400
        
        # Get datasets from database
        datasets = []
        for dataset_id in dataset_ids:
            dataset = Dataset.query.get(dataset_id)
            if dataset:
                datasets.append(dataset)
        
        if len(datasets) < 2:
            return jsonify({'success': False, 'error': 'Could not find all specified datasets'}), 400
        
        # Perform basic dataset comparison
        processor = DataProcessor()
        comparison_result = {
            'overview': {
                'datasets': []
            },
            'schema_comparison': {
                'common_columns': [],
                'unique_columns': {},
                'data_type_differences': []
            },
            'statistical_comparison': [],
            'quality_comparison': []
        }
        
        # Basic overview
        for dataset in datasets:
            comparison_result['overview']['datasets'].append({
                'name': dataset.filename,
                'rows': dataset.num_rows,
                'columns': dataset.num_columns,
                'memory_usage': f"{(dataset.file_size / (1024*1024)):.1f} MB" if dataset.file_size else "Unknown",
                'missing_values': "To be calculated"
            })
        
        # Schema comparison
        if len(datasets) == 2:
            try:
                df1 = processor.load_dataset(datasets[0])
                df2 = processor.load_dataset(datasets[1])
                
                cols1 = set(df1.columns)
                cols2 = set(df2.columns)
                
                common_columns = list(cols1.intersection(cols2))
                unique_to_1 = list(cols1 - cols2)
                unique_to_2 = list(cols2 - cols1)
                
                comparison_result['schema_comparison'] = {
                    'common_columns': common_columns,
                    'unique_columns': {
                        datasets[0].filename: unique_to_1,
                        datasets[1].filename: unique_to_2
                    },
                    'data_type_differences': []
                }
                
                # Check data type differences for common columns
                for col in common_columns:
                    type1 = str(df1[col].dtype)
                    type2 = str(df2[col].dtype)
                    if type1 != type2:
                        comparison_result['schema_comparison']['data_type_differences'].append({
                            'column': col,
                            'dataset1': type1,
                            'dataset2': type2
                        })
                        
            except Exception as e:
                logging.warning(f"Could not perform detailed schema comparison: {str(e)}")
        
        return jsonify({
            'success': True,
            'comparison': comparison_result
        })
        
    except Exception as e:
        current_app.logger.error(f"Dataset comparison error: {str(e)}")
        return jsonify({'success': False, 'error': f'Dataset comparison failed: {str(e)}'}), 500

@comparison_bp.route('/columns', methods=['POST'])
def compare_columns():
    """Compare columns between datasets"""
    try:
        data = request.get_json()
        dataset1_id = data.get('dataset1_id')
        column1 = data.get('column1')
        dataset2_id = data.get('dataset2_id')
        column2 = data.get('column2')
        
        if not all([dataset1_id, column1, dataset2_id, column2]):
            return jsonify({'success': False, 'error': 'Missing required parameters'}), 400
        
        comparer = Comparison()
        
        # If comparing columns within the same dataset
        if dataset1_id == dataset2_id:
            if pd.api.types.is_numeric_dtype:
                result = comparer.compare_numerical(dataset1_id, column1, column2)
            else:
                result = comparer.compare_categorical(dataset1_id, column1, column2)
        else:
            # For cross-dataset comparison, we need a different approach
            # For now, return basic comparison
            result = {
                'success': True,
                'data': {
                    'column1': {
                        'dataset': f'Dataset {dataset1_id}',
                        'column': column1,
                        'type': 'unknown',
                        'stats': {
                            'count': 'Unknown',
                            'mean': 'Unknown',
                            'std': 'Unknown',
                            'min': 'Unknown',
                            'max': 'Unknown',
                            'unique': 'Unknown'
                        }
                    },
                    'column2': {
                        'dataset': f'Dataset {dataset2_id}',
                        'column': column2,
                        'type': 'unknown',
                        'stats': {
                            'count': 'Unknown',
                            'mean': 'Unknown',
                            'std': 'Unknown',
                            'min': 'Unknown',
                            'max': 'Unknown',
                            'unique': 'Unknown'
                        }
                    },
                    'tests': {
                        'correlation': 'Cross-dataset comparison not implemented',
                        't_test_p_value': 'Cross-dataset comparison not implemented',
                        'ks_test_p_value': 'Cross-dataset comparison not implemented'
                    }
                }
            }
        
        return jsonify({
            'success': True,
            'comparison': result.get('data', result)
        })
        
    except Exception as e:
        current_app.logger.error(f"Column comparison error: {str(e)}")
        return jsonify({'success': False, 'error': f'Column comparison failed: {str(e)}'}), 500

@comparison_bp.route('/segments/<int:dataset_id>', methods=['POST'])
def compare_segments(dataset_id):
    """Compare segments within a dataset"""
    try:
        data = request.get_json()
        target_column = data.get('target_column')
        segment_column = data.get('segment_column')
        
        if not target_column or not segment_column:
            return jsonify({'success': False, 'error': 'Missing target_column or segment_column'}), 400
        
        comparer = Comparison()
        result = comparer.compare_groups(dataset_id, target_column, segment_column)
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"Segment comparison error: {str(e)}")
        return jsonify({'success': False, 'error': f'Segment comparison failed: {str(e)}'}), 500

@comparison_bp.route('/numerical/<int:dataset_id>')
def compare_numerical(dataset_id):
    try:
        column1 = request.args.get('column1')
        column2 = request.args.get('column2')
        
        if not column1 or not column2:
            return jsonify({'success': False, 'error': 'Missing column1 or column2 parameters'}), 400
            
        comparer = Comparison()
        result = comparer.compare_numerical(dataset_id, column1, column2)
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"Numerical comparison error: {str(e)}")
        return jsonify({'success': False, 'error': f'Numerical comparison failed: {str(e)}'}), 500

@comparison_bp.route('/categorical/<int:dataset_id>')
def compare_categorical(dataset_id):
    try:
        column1 = request.args.get('column1')
        column2 = request.args.get('column2')
        
        if not column1 or not column2:
            return jsonify({'success': False, 'error': 'Missing column1 or column2 parameters'}), 400
            
        comparer = Comparison()
        result = comparer.compare_categorical(dataset_id, column1, column2)
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"Categorical comparison error: {str(e)}")
        return jsonify({'success': False, 'error': f'Categorical comparison failed: {str(e)}'}), 500

@comparison_bp.route('/mixed/<int:dataset_id>')
def compare_mixed(dataset_id):
    try:
        numerical_column = request.args.get('numerical_column')
        categorical_column = request.args.get('categorical_column')
        
        if not numerical_column or not categorical_column:
            return jsonify({'success': False, 'error': 'Missing numerical_column or categorical_column parameters'}), 400
            
        comparer = Comparison()
        result = comparer.compare_mixed(dataset_id, numerical_column, categorical_column)
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"Mixed comparison error: {str(e)}")
        return jsonify({'success': False, 'error': f'Mixed comparison failed: {str(e)}'}), 500

@comparison_bp.route('/distributions/<int:dataset_id>')
def compare_distributions(dataset_id):
    try:
        columns = request.args.getlist('columns')
        
        if len(columns) < 2:
            return jsonify({'success': False, 'error': 'At least 2 columns required for distribution comparison'}), 400
            
        comparer = Comparison()
        result = comparer.compare_distributions(dataset_id, columns)
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"Distribution comparison error: {str(e)}")
        return jsonify({'success': False, 'error': f'Distribution comparison failed: {str(e)}'}), 500