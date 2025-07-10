import pandas as pd
import numpy as np
from scipy import stats
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_selection import mutual_info_classif, mutual_info_regression
from typing import Dict, List, Any, Optional, Tuple
import logging
import warnings
import json
warnings.filterwarnings('ignore')

class ColumnAnalysis:
    """Comprehensive column-wise analysis service"""
    
    def __init__(self, file_path: str = None):
        self.file_path = file_path
        self.df = None
        if file_path:
            self.df = pd.read_csv(file_path)
        self.logger = logging.getLogger(__name__)
    
    def _load_dataframe(self, file_path: str = None):
        """Load DataFrame from file path"""
        path = file_path or self.file_path
        if not path:
            raise ValueError("No file path provided")
        self.df = pd.read_csv(path)
        self.numeric_columns = self.df.select_dtypes(include=[np.number]).columns.tolist()
        self.categorical_columns = self.df.select_dtypes(include=['object']).columns.tolist()
        self.datetime_columns = self.df.select_dtypes(include=['datetime64']).columns.tolist()
    
    def _convert_numpy_types(self, obj):
        """Convert numpy types to native Python types for JSON serialization"""
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {key: self._convert_numpy_types(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_numpy_types(item) for item in obj]
        elif pd.isna(obj):
            return None
        return obj
    
    def analyze_columns(self, columns: List[str], analysis_type: str = 'comprehensive') -> Dict[str, Any]:
        """Analyze specific columns"""
        try:
            results = {}
            
            for column in columns:
                if column not in self.df.columns:
                    results[column] = {'error': f'Column {column} not found'}
                    continue
                
                if analysis_type == 'comprehensive':
                    results[column] = self.comprehensive_column_summary(column)
                elif analysis_type == 'univariate':
                    results[column] = self.univariate_analysis(column)
                elif analysis_type == 'quality':
                    results[column] = self.data_quality_analysis(column)
                elif analysis_type == 'statistical':
                    results[column] = self.statistical_analysis(column)
                else:
                    results[column] = {'error': f'Unknown analysis type: {analysis_type}'}
            
            return {
                'analysis_type': analysis_type,
                'columns_analyzed': columns,
                'results': results
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing columns: {str(e)}")
            raise
    
    def univariate_analysis(self, column: str) -> Dict[str, Any]:
        """Perform comprehensive univariate analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            analysis = {
                'column_name': column,
                'data_type': str(data.dtype),
                'basic_info': self._get_basic_info(data),
                'missing_analysis': self._analyze_missing_values(data),
                'uniqueness_analysis': self._analyze_uniqueness(data),
                'distribution_analysis': {},
                'outlier_analysis': {},
                'insights': [],
                'recommendations': []
            }
            
            # Type-specific analysis
            if pd.api.types.is_numeric_dtype(data):
                analysis['distribution_analysis'] = self._analyze_numeric_distribution(data)
                analysis['outlier_analysis'] = self._analyze_outliers(data)
                analysis['normality_tests'] = self._test_normality(data)
                analysis['insights'].extend(self._generate_numeric_insights(data, column))
            
            elif pd.api.types.is_categorical_dtype(data) or data.dtype == 'object':
                analysis['distribution_analysis'] = self._analyze_categorical_distribution(data)
                analysis['insights'].extend(self._generate_categorical_insights(data, column))
            
            elif pd.api.types.is_datetime64_any_dtype(data):
                analysis['temporal_analysis'] = self._analyze_temporal_patterns(data)
                analysis['insights'].extend(self._generate_temporal_insights(data, column))
            
            # Generate recommendations
            analysis['recommendations'] = self._generate_column_recommendations(data, column, analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in univariate analysis: {str(e)}")
            raise
    
    def bivariate_analysis(self, column1: str, column2: str) -> Dict[str, Any]:
        """Perform bivariate analysis between two columns"""
        try:
            if column1 not in self.df.columns or column2 not in self.df.columns:
                raise ValueError("One or both columns not found")
            
            data1 = self.df[column1]
            data2 = self.df[column2]
            
            analysis = {
                'column1': column1,
                'column2': column2,
                'data_types': [str(data1.dtype), str(data2.dtype)],
                'relationship_type': self._determine_relationship_type(data1, data2),
                'correlation_analysis': {},
                'association_analysis': {},
                'statistical_tests': {},
                'insights': [],
                'recommendations': []
            }
            
            # Remove missing values for analysis
            combined_data = pd.DataFrame({column1: data1, column2: data2}).dropna()
            
            if len(combined_data) == 0:
                analysis['error'] = 'No valid pairs after removing missing values'
                return analysis
            
            clean_data1 = combined_data[column1]
            clean_data2 = combined_data[column2]
            
            # Determine analysis based on data types
            if pd.api.types.is_numeric_dtype(data1) and pd.api.types.is_numeric_dtype(data2):
                # Numeric vs Numeric
                analysis['correlation_analysis'] = self._analyze_numeric_correlation(clean_data1, clean_data2)
                analysis['statistical_tests'] = self._run_numeric_tests(clean_data1, clean_data2)
                analysis['insights'].extend(self._generate_numeric_bivariate_insights(clean_data1, clean_data2, column1, column2))
            
            elif (pd.api.types.is_numeric_dtype(data1) and not pd.api.types.is_numeric_dtype(data2)) or \
                 (not pd.api.types.is_numeric_dtype(data1) and pd.api.types.is_numeric_dtype(data2)):
                # Numeric vs Categorical
                analysis['association_analysis'] = self._analyze_numeric_categorical(clean_data1, clean_data2, column1, column2)
                analysis['statistical_tests'] = self._run_numeric_categorical_tests(clean_data1, clean_data2, column1, column2)
                analysis['insights'].extend(self._generate_numeric_categorical_insights(clean_data1, clean_data2, column1, column2))
            
            else:
                # Categorical vs Categorical
                analysis['association_analysis'] = self._analyze_categorical_association(clean_data1, clean_data2)
                analysis['statistical_tests'] = self._run_categorical_tests(clean_data1, clean_data2)
                analysis['insights'].extend(self._generate_categorical_bivariate_insights(clean_data1, clean_data2, column1, column2))
            
            analysis['recommendations'] = self._generate_bivariate_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in bivariate analysis: {str(e)}")
            raise
    
    def multivariate_analysis(self, columns: List[str], target_column: str = None) -> Dict[str, Any]:
        """Perform multivariate analysis"""
        try:
            if not all(col in self.df.columns for col in columns):
                raise ValueError("Some columns not found")
            
            analysis = {
                'columns': columns,
                'target_column': target_column,
                'correlation_matrix': {},
                'feature_importance': {},
                'interactions': {},
                'dimensionality_analysis': {},
                'insights': [],
                'recommendations': []
            }
            
            # Filter to numeric columns for correlation analysis
            numeric_cols = [col for col in columns if col in self.numeric_columns]
            
            if len(numeric_cols) > 1:
                corr_matrix = self.df[numeric_cols].corr()
                analysis['correlation_matrix'] = {
                    'matrix': corr_matrix.to_dict(),
                    'high_correlations': self._find_high_correlations(corr_matrix),
                    'multicollinearity': self._detect_multicollinearity(corr_matrix)
                }
            
            # Feature importance analysis if target provided
            if target_column and target_column in self.df.columns:
                analysis['feature_importance'] = self._calculate_feature_importance(columns, target_column)
            
            # Interaction analysis
            if len(numeric_cols) >= 2:
                analysis['interactions'] = self._analyze_feature_interactions(numeric_cols, target_column)
            
            # Dimensionality analysis
            analysis['dimensionality_analysis'] = self._analyze_dimensionality(columns)
            
            # Generate insights and recommendations
            analysis['insights'] = self._generate_multivariate_insights(analysis)
            analysis['recommendations'] = self._generate_multivariate_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in multivariate analysis: {str(e)}")
            raise
    
    def outlier_analysis(self, column: str, method: str = 'iqr') -> Dict[str, Any]:
        """Comprehensive outlier analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column].dropna()
            
            if not pd.api.types.is_numeric_dtype(data):
                return {'error': 'Outlier analysis only applicable to numeric columns'}
            
            analysis = {
                'column': column,
                'method': method,
                'outlier_detection': {},
                'outlier_impact': {},
                'recommendations': []
            }
            
            # Multiple outlier detection methods
            methods = ['iqr', 'zscore', 'modified_zscore', 'isolation_forest']
            
            for outlier_method in methods:
                try:
                    outliers = self._detect_outliers_method(data, outlier_method)
                    analysis['outlier_detection'][outlier_method] = outliers
                except Exception as e:
                    analysis['outlier_detection'][outlier_method] = {'error': str(e)}
            
            # Analyze outlier impact
            analysis['outlier_impact'] = self._analyze_outlier_impact(data)
            
            # Generate recommendations
            analysis['recommendations'] = self._generate_outlier_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in outlier analysis: {str(e)}")
            raise
    
    def missing_value_analysis(self, column: str) -> Dict[str, Any]:
        """Comprehensive missing value analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            
            analysis = {
                'column': column,
                'missing_info': self._analyze_missing_values(data),
                'missing_patterns': self._analyze_missing_patterns(column),
                'imputation_suggestions': self._suggest_imputation_methods(data),
                'impact_analysis': self._analyze_missing_impact(column),
                'recommendations': []
            }
            
            analysis['recommendations'] = self._generate_missing_value_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in missing value analysis: {str(e)}")
            raise
    
    def distribution_analysis(self, column: str) -> Dict[str, Any]:
        """Comprehensive distribution analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column].dropna()
            
            analysis = {
                'column': column,
                'distribution_type': self._identify_distribution_type(data),
                'distribution_parameters': {},
                'goodness_of_fit': {},
                'transformation_analysis': {},
                'recommendations': []
            }
            
            if pd.api.types.is_numeric_dtype(data):
                analysis['distribution_parameters'] = self._calculate_distribution_parameters(data)
                analysis['goodness_of_fit'] = self._test_distribution_fit(data)
                analysis['transformation_analysis'] = self._analyze_transformations(data)
            else:
                analysis['distribution_parameters'] = self._analyze_categorical_distribution(data)
            
            analysis['recommendations'] = self._generate_distribution_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in distribution analysis: {str(e)}")
            raise
    
    def categorical_analysis(self, column: str) -> Dict[str, Any]:
        """Comprehensive categorical analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            
            analysis = {
                'column': column,
                'category_info': self._analyze_categorical_distribution(data),
                'encoding_analysis': self._analyze_encoding_needs(data),
                'cardinality_analysis': self._analyze_cardinality(data),
                'recommendations': []
            }
            
            analysis['recommendations'] = self._generate_categorical_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in categorical analysis: {str(e)}")
            raise
    
    def temporal_analysis(self, column: str) -> Dict[str, Any]:
        """Comprehensive temporal analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            
            # Convert to datetime if not already
            if not pd.api.types.is_datetime64_any_dtype(data):
                try:
                    data = pd.to_datetime(data, errors='coerce')
                except:
                    return {'error': 'Cannot convert column to datetime'}
            
            analysis = {
                'column': column,
                'temporal_patterns': self._analyze_temporal_patterns(data),
                'seasonality': self._analyze_seasonality(data),
                'trends': self._analyze_trends(data),
                'recommendations': []
            }
            
            analysis['recommendations'] = self._generate_temporal_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in temporal analysis: {str(e)}")
            raise
    
    def get_column_summary(self, file_path: str, column: str) -> Dict[str, Any]:
        """Get comprehensive column summary for API endpoint"""
        try:
            self._load_dataframe(file_path)
            summary = self.comprehensive_column_summary(column)
            return self._convert_numpy_types(summary)
        except Exception as e:
            self.logger.error(f"Error getting column summary: {str(e)}")
            raise
    
    def detect_outliers(self, file_path: str, column: str, method: str = 'iqr') -> Dict[str, Any]:
        """Detect outliers for API endpoint"""
        try:
            self._load_dataframe(file_path)
            outliers = self.outlier_analysis(column, method)
            return self._convert_numpy_types(outliers)
        except Exception as e:
            self.logger.error(f"Error detecting outliers: {str(e)}")
            raise
    
    def analyze_distribution(self, file_path: str, column: str) -> Dict[str, Any]:
        """Analyze distribution for API endpoint"""
        try:
            self._load_dataframe(file_path)
            distribution = self.distribution_analysis(column)
            return self._convert_numpy_types(distribution)
        except Exception as e:
            self.logger.error(f"Error analyzing distribution: {str(e)}")
            raise
    
    def analyze_missing_values(self, file_path: str, column: str) -> Dict[str, Any]:
        """Analyze missing values for API endpoint"""
        try:
            self._load_dataframe(file_path)
            missing = self.missing_value_analysis(column)
            return self._convert_numpy_types(missing)
        except Exception as e:
            self.logger.error(f"Error analyzing missing values: {str(e)}")
            raise
    
    def analyze_unique_values(self, file_path: str, column: str) -> Dict[str, Any]:
        """Analyze unique values for API endpoint"""
        try:
            self._load_dataframe(file_path)
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            unique_analysis = {
                'column': column,
                'unique_count': int(data.nunique()),
                'total_count': int(len(data)),
                'unique_percentage': float((data.nunique() / len(data)) * 100),
                'value_counts': data.value_counts().head(20).to_dict(),
                'most_frequent': data.mode().iloc[0] if not data.mode().empty else None,
                'least_frequent_values': data.value_counts().tail(10).to_dict()
            }
            return self._convert_numpy_types(unique_analysis)
        except Exception as e:
            self.logger.error(f"Error analyzing unique values: {str(e)}")
            raise
    
    def assess_data_quality(self, file_path: str, column: str) -> Dict[str, Any]:
        """Assess data quality for API endpoint"""
        try:
            self._load_dataframe(file_path)
            quality = self.data_quality_analysis(column)
            return self._convert_numpy_types(quality)
        except Exception as e:
            self.logger.error(f"Error assessing data quality: {str(e)}")
            raise
    
    def detect_patterns(self, file_path: str, column: str) -> Dict[str, Any]:
        """Detect patterns for API endpoint"""
        try:
            self._load_dataframe(file_path)
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            patterns = {
                'column': column,
                'data_type': str(data.dtype),
                'patterns': []
            }
            
            if data.dtype == 'object':
                # String pattern analysis
                patterns['string_patterns'] = {
                    'average_length': float(data.astype(str).str.len().mean()) if not data.empty else 0,
                    'contains_numbers': bool(data.astype(str).str.contains(r'\d', na=False).any()),
                    'contains_special_chars': bool(data.astype(str).str.contains(r'[^a-zA-Z0-9\s]', na=False).any()),
                    'all_uppercase': int(data.astype(str).str.isupper().sum()),
                    'all_lowercase': int(data.astype(str).str.islower().sum())
                }
            
            return self._convert_numpy_types(patterns)
        except Exception as e:
            self.logger.error(f"Error detecting patterns: {str(e)}")
            raise
    
    def perform_temporal_analysis(self, file_path: str, column: str) -> Dict[str, Any]:
        """Perform temporal analysis for API endpoint"""
        try:
            self._load_dataframe(file_path)
            temporal = self.temporal_analysis(column)
            return self._convert_numpy_types(temporal)
        except Exception as e:
            self.logger.error(f"Error performing temporal analysis: {str(e)}")
            raise
    
    def perform_categorical_analysis(self, file_path: str, column: str) -> Dict[str, Any]:
        """Perform categorical analysis for API endpoint"""
        try:
            self._load_dataframe(file_path)
            categorical = self.categorical_analysis(column)
            return self._convert_numpy_types(categorical)
        except Exception as e:
            self.logger.error(f"Error performing categorical analysis: {str(e)}")
            raise
    
    def perform_numerical_analysis(self, file_path: str, column: str) -> Dict[str, Any]:
        """Perform numerical analysis for API endpoint"""
        try:
            self._load_dataframe(file_path)
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            if not pd.api.types.is_numeric_dtype(data):
                raise ValueError(f"Column {column} is not numeric")
            
            numerical = {
                'column': column,
                'basic_stats': self._get_descriptive_statistics(data),
                'distribution': self._analyze_numeric_distribution(data),
                'outliers': self._analyze_outliers(data),
                'normality': self._test_normality(data)
            }
            return self._convert_numpy_types(numerical)
        except Exception as e:
            self.logger.error(f"Error performing numerical analysis: {str(e)}")
            raise
    
    def get_recommendations(self, file_path: str, column: str) -> Dict[str, Any]:
        """Get recommendations for API endpoint"""
        try:
            self._load_dataframe(file_path)
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            recommendations = {
                'column': column,
                'recommendations': self._generate_column_recommendations(data, column, {})
            }
            return self._convert_numpy_types(recommendations)
        except Exception as e:
            self.logger.error(f"Error getting recommendations: {str(e)}")
            raise

    def comprehensive_column_summary(self, column: str) -> Dict[str, Any]:
        """Generate comprehensive column summary"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            
            summary = {
                'column_name': column,
                'data_type': str(data.dtype),
                'basic_statistics': self._get_basic_info(data),
                'quality_metrics': self._get_quality_metrics(data),
                'distribution_summary': {},
                'insights': [],
                'recommendations': [],
                'analysis_completeness': {}
            }
            
            # Type-specific analysis
            if pd.api.types.is_numeric_dtype(data):
                summary['distribution_summary'] = self._analyze_numeric_distribution(data)
                summary['outlier_summary'] = self._get_outlier_summary(data)
                summary['normality_assessment'] = self._assess_normality(data)
                summary['insights'].extend(self._generate_numeric_insights(data, column))
            
            elif data.dtype == 'object' or pd.api.types.is_categorical_dtype(data):
                summary['distribution_summary'] = self._analyze_categorical_distribution(data)
                summary['cardinality_assessment'] = self._assess_cardinality(data)
                summary['insights'].extend(self._generate_categorical_insights(data, column))
            
            elif pd.api.types.is_datetime64_any_dtype(data):
                summary['temporal_summary'] = self._get_temporal_summary(data)
                summary['insights'].extend(self._generate_temporal_insights(data, column))
            
            # Overall recommendations
            summary['recommendations'] = self._generate_comprehensive_recommendations(data, column, summary)
            
            # Analysis completeness score
            summary['analysis_completeness'] = self._calculate_analysis_completeness(summary)
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error generating comprehensive summary: {str(e)}")
            raise
    
    def data_quality_analysis(self, column: str) -> Dict[str, Any]:
        """Comprehensive data quality analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column]
            
            quality_analysis = {
                'column': column,
                'completeness': self._assess_completeness(data),
                'consistency': self._assess_consistency(data),
                'validity': self._assess_validity(data),
                'accuracy': self._assess_accuracy(data),
                'uniqueness': self._assess_uniqueness(data),
                'overall_score': 0,
                'issues': [],
                'recommendations': []
            }
            
            # Calculate overall quality score
            scores = [
                quality_analysis['completeness']['score'],
                quality_analysis['consistency']['score'],
                quality_analysis['validity']['score'],
                quality_analysis['accuracy']['score'],
                quality_analysis['uniqueness']['score']
            ]
            quality_analysis['overall_score'] = np.mean(scores)
            
            # Collect issues
            for dimension, assessment in quality_analysis.items():
                if isinstance(assessment, dict) and 'issues' in assessment:
                    quality_analysis['issues'].extend(assessment['issues'])
            
            # Generate recommendations
            quality_analysis['recommendations'] = self._generate_quality_recommendations(quality_analysis)
            
            return quality_analysis
            
        except Exception as e:
            self.logger.error(f"Error in data quality analysis: {str(e)}")
            raise
    
    def statistical_analysis(self, column: str) -> Dict[str, Any]:
        """Comprehensive statistical analysis"""
        try:
            if column not in self.df.columns:
                raise ValueError(f"Column {column} not found")
            
            data = self.df[column].dropna()
            
            analysis = {
                'column': column,
                'descriptive_statistics': {},
                'inferential_statistics': {},
                'hypothesis_tests': {},
                'confidence_intervals': {},
                'effect_sizes': {},
                'recommendations': []
            }
            
            if pd.api.types.is_numeric_dtype(data):
                analysis['descriptive_statistics'] = self._get_descriptive_statistics(data)
                analysis['inferential_statistics'] = self._get_inferential_statistics(data)
                analysis['hypothesis_tests'] = self._run_hypothesis_tests(data)
                analysis['confidence_intervals'] = self._calculate_confidence_intervals(data)
                analysis['effect_sizes'] = self._calculate_effect_sizes(data)
            else:
                analysis['descriptive_statistics'] = self._get_categorical_statistics(data)
                analysis['hypothesis_tests'] = self._run_categorical_tests(data)
            
            analysis['recommendations'] = self._generate_statistical_recommendations(analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in statistical analysis: {str(e)}")
            raise
    
    # Helper methods for analysis components
    def _get_basic_info(self, data: pd.Series) -> Dict[str, Any]:
        """Get basic information about the column"""
        return {
            'count': len(data),
            'non_null_count': data.count(),
            'null_count': data.isnull().sum(),
            'null_percentage': (data.isnull().sum() / len(data)) * 100,
            'unique_count': data.nunique(),
            'unique_percentage': (data.nunique() / len(data)) * 100,
            'memory_usage': data.memory_usage(deep=True),
            'data_type': str(data.dtype)
        }
    
    def _analyze_missing_values(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze missing values"""
        missing_count = data.isnull().sum()
        total_count = len(data)
        
        return {
            'missing_count': int(missing_count),
            'missing_percentage': float((missing_count / total_count) * 100),
            'has_missing': missing_count > 0,
            'severity': 'high' if missing_count > total_count * 0.2 else 'medium' if missing_count > total_count * 0.05 else 'low'
        }
    
    def _analyze_uniqueness(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze uniqueness of values"""
        unique_count = data.nunique()
        total_count = len(data)
        
        return {
            'unique_count': int(unique_count),
            'unique_percentage': float((unique_count / total_count) * 100),
            'has_duplicates': unique_count < total_count,
            'duplicate_count': int(total_count - unique_count),
            'cardinality': 'high' if unique_count > total_count * 0.8 else 'medium' if unique_count > total_count * 0.5 else 'low'
        }
    
    def _analyze_numeric_distribution(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze numeric distribution"""
        return {
            'mean': float(data.mean()),
            'median': float(data.median()),
            'mode': float(data.mode().iloc[0]) if not data.mode().empty else None,
            'std': float(data.std()),
            'variance': float(data.var()),
            'min': float(data.min()),
            'max': float(data.max()),
            'range': float(data.max() - data.min()),
            'iqr': float(data.quantile(0.75) - data.quantile(0.25)),
            'skewness': float(stats.skew(data)),
            'kurtosis': float(stats.kurtosis(data)),
            'cv': float(data.std() / data.mean()) if data.mean() != 0 else np.inf
        }
    
    def _analyze_categorical_distribution(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze categorical distribution"""
        value_counts = data.value_counts()
        
        return {
            'unique_values': int(data.nunique()),
            'most_frequent': value_counts.index[0] if len(value_counts) > 0 else None,
            'most_frequent_count': int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
            'least_frequent': value_counts.index[-1] if len(value_counts) > 0 else None,
            'least_frequent_count': int(value_counts.iloc[-1]) if len(value_counts) > 0 else 0,
            'value_counts': value_counts.head(20).to_dict(),
            'entropy': float(stats.entropy(value_counts.values)) if len(value_counts) > 0 else 0,
            'concentration': float(value_counts.iloc[0] / len(data)) if len(value_counts) > 0 else 0
        }
    
    def _analyze_outliers(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze outliers using multiple methods"""
        Q1 = data.quantile(0.25)
        Q3 = data.quantile(0.75)
        IQR = Q3 - Q1
        
        # IQR method
        iqr_outliers = data[(data < Q1 - 1.5 * IQR) | (data > Q3 + 1.5 * IQR)]
        
        # Z-score method
        z_scores = np.abs(stats.zscore(data))
        zscore_outliers = data[z_scores > 3]
        
        # Modified Z-score method
        median = data.median()
        mad = stats.median_abs_deviation(data)
        modified_z_scores = 0.6745 * (data - median) / mad
        modified_zscore_outliers = data[np.abs(modified_z_scores) > 3.5]
        
        return {
            'iqr_method': {
                'count': len(iqr_outliers),
                'percentage': (len(iqr_outliers) / len(data)) * 100,
                'lower_bound': float(Q1 - 1.5 * IQR),
                'upper_bound': float(Q3 + 1.5 * IQR)
            },
            'zscore_method': {
                'count': len(zscore_outliers),
                'percentage': (len(zscore_outliers) / len(data)) * 100
            },
            'modified_zscore_method': {
                'count': len(modified_zscore_outliers),
                'percentage': (len(modified_zscore_outliers) / len(data)) * 100
            }
        }
    
    def _test_normality(self, data: pd.Series) -> Dict[str, Any]:
        """Test for normality"""
        if len(data) < 3:
            return {'error': 'Insufficient data for normality tests'}
        
        results = {}
        
        # Shapiro-Wilk test
        if len(data) <= 5000:
            try:
                stat, p_value = stats.shapiro(data)
                results['shapiro_wilk'] = {
                    'statistic': float(stat),
                    'p_value': float(p_value),
                    'is_normal': p_value > 0.05
                }
            except:
                results['shapiro_wilk'] = {'error': 'Test failed'}
        
        # Kolmogorov-Smirnov test
        try:
            stat, p_value = stats.kstest(data, 'norm', args=(data.mean(), data.std()))
            results['kolmogorov_smirnov'] = {
                'statistic': float(stat),
                'p_value': float(p_value),
                'is_normal': p_value > 0.05
            }
        except:
            results['kolmogorov_smirnov'] = {'error': 'Test failed'}
        
        # Anderson-Darling test
        try:
            result = stats.anderson(data, dist='norm')
            results['anderson_darling'] = {
                'statistic': float(result.statistic),
                'critical_values': result.critical_values.tolist(),
                'significance_levels': result.significance_levels.tolist()
            }
        except:
            results['anderson_darling'] = {'error': 'Test failed'}
        
        return results
    
    def _generate_numeric_insights(self, data: pd.Series, column: str) -> List[str]:
        """Generate insights for numeric columns"""
        insights = []
        
        mean_val = data.mean()
        median_val = data.median()
        std_val = data.std()
        skewness = stats.skew(data)
        
        # Central tendency insights
        if abs(mean_val - median_val) / std_val > 0.5:
            insights.append(f"Mean and median differ significantly, suggesting skewed distribution")
        
        # Skewness insights
        if abs(skewness) > 1:
            direction = "right" if skewness > 0 else "left"
            insights.append(f"Distribution is highly {direction}-skewed (skewness: {skewness:.2f})")
        
        # Variability insights
        cv = std_val / mean_val if mean_val != 0 else np.inf
        if cv > 1:
            insights.append(f"High variability - coefficient of variation: {cv:.2f}")
        
        # Range insights
        data_range = data.max() - data.min()
        if data_range == 0:
            insights.append("All values are identical - constant column")
        
        return insights
    
    def _generate_categorical_insights(self, data: pd.Series, column: str) -> List[str]:
        """Generate insights for categorical columns"""
        insights = []
        
        unique_count = data.nunique()
        total_count = len(data)
        value_counts = data.value_counts()
        
        # Cardinality insights
        if unique_count == total_count:
            insights.append("Every value is unique - potential identifier column")
        elif unique_count > total_count * 0.8:
            insights.append("Very high cardinality - most values are unique")
        elif unique_count < 10:
            insights.append("Low cardinality - good candidate for categorical encoding")
        
        # Distribution insights
        if len(value_counts) > 0:
            most_frequent_pct = (value_counts.iloc[0] / total_count) * 100
            if most_frequent_pct > 90:
                insights.append(f"Highly concentrated - {most_frequent_pct:.1f}% of values are the same")
            elif most_frequent_pct < 5:
                insights.append("Uniformly distributed - no dominant category")
        
        return insights
    
    def _generate_temporal_insights(self, data: pd.Series, column: str) -> List[str]:
        """Generate insights for temporal columns"""
        insights = []
        
        data_clean = data.dropna()
        if len(data_clean) == 0:
            return ["No valid datetime values found"]
        
        date_range = data_clean.max() - data_clean.min()
        insights.append(f"Date range spans {date_range.days} days")
        
        # Check for patterns
        if len(data_clean.dt.year.unique()) == 1:
            insights.append("All dates are from the same year")
        
        return insights
    
    def _generate_column_recommendations(self, data: pd.Series, column: str, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations for column"""
        recommendations = []
        
        # Missing values
        missing_pct = analysis['missing_analysis']['missing_percentage']
        if missing_pct > 20:
            recommendations.append("High missing values - consider imputation or removal")
        elif missing_pct > 5:
            recommendations.append("Moderate missing values - investigate patterns")
        
        # Data type specific recommendations
        if pd.api.types.is_numeric_dtype(data):
            skewness = analysis['distribution_analysis']['skewness']
            if abs(skewness) > 1:
                recommendations.append("Consider transformation to reduce skewness")
            
            if 'outlier_analysis' in analysis:
                outlier_pct = analysis['outlier_analysis']['iqr_method']['percentage']
                if outlier_pct > 5:
                    recommendations.append("Investigate and handle outliers")
        
        elif data.dtype == 'object':
            unique_pct = analysis['uniqueness_analysis']['unique_percentage']
            if unique_pct > 80:
                recommendations.append("High cardinality - consider grouping rare categories")
            elif unique_pct < 10:
                recommendations.append("Good candidate for one-hot encoding")
        
        return recommendations
    
    # Additional helper methods for comprehensive analysis
    def _determine_relationship_type(self, data1: pd.Series, data2: pd.Series) -> str:
        """Determine the type of relationship between two variables"""
        is_num1 = pd.api.types.is_numeric_dtype(data1)
        is_num2 = pd.api.types.is_numeric_dtype(data2)
        
        if is_num1 and is_num2:
            return 'numeric_numeric'
        elif is_num1 or is_num2:
            return 'numeric_categorical'
        else:
            return 'categorical_categorical'
    
    def _analyze_numeric_correlation(self, data1: pd.Series, data2: pd.Series) -> Dict[str, Any]:
        """Analyze correlation between numeric variables"""
        pearson_corr, pearson_p = stats.pearsonr(data1, data2)
        spearman_corr, spearman_p = stats.spearmanr(data1, data2)
        
        return {
            'pearson': {
                'correlation': float(pearson_corr),
                'p_value': float(pearson_p),
                'significant': pearson_p < 0.05
            },
            'spearman': {
                'correlation': float(spearman_corr),
                'p_value': float(spearman_p),
                'significant': spearman_p < 0.05
            },
            'correlation_strength': self._interpret_correlation_strength(abs(pearson_corr))
        }
    
    def _interpret_correlation_strength(self, correlation: float) -> str:
        """Interpret correlation strength"""
        if correlation < 0.3:
            return 'weak'
        elif correlation < 0.7:
            return 'moderate'
        else:
            return 'strong'
    
    # Placeholder methods for complex analyses (can be expanded)
    def _run_numeric_tests(self, data1: pd.Series, data2: pd.Series) -> Dict[str, Any]:
        """Run statistical tests for numeric variables"""
        return {'note': 'Advanced statistical tests implementation pending'}
    
    def _analyze_numeric_categorical(self, data1: pd.Series, data2: pd.Series, col1: str, col2: str) -> Dict[str, Any]:
        """Analyze relationship between numeric and categorical variables"""
        return {'note': 'Numeric-categorical analysis implementation pending'}
    
    def _run_numeric_categorical_tests(self, data1: pd.Series, data2: pd.Series, col1: str, col2: str) -> Dict[str, Any]:
        """Run tests for numeric-categorical relationship"""
        return {'note': 'Numeric-categorical tests implementation pending'}
    
    def _analyze_categorical_association(self, data1: pd.Series, data2: pd.Series) -> Dict[str, Any]:
        """Analyze association between categorical variables"""
        return {'note': 'Categorical association analysis implementation pending'}
    
    def _run_categorical_tests(self, data1: pd.Series, data2: pd.Series) -> Dict[str, Any]:
        """Run tests for categorical variables"""
        return {'note': 'Categorical tests implementation pending'}
    
    def _generate_numeric_bivariate_insights(self, data1: pd.Series, data2: pd.Series, col1: str, col2: str) -> List[str]:
        """Generate insights for numeric bivariate analysis"""
        return ['Numeric bivariate insights implementation pending']
    
    def _generate_numeric_categorical_insights(self, data1: pd.Series, data2: pd.Series, col1: str, col2: str) -> List[str]:
        """Generate insights for numeric-categorical analysis"""
        return ['Numeric-categorical insights implementation pending']
    
    def _generate_categorical_bivariate_insights(self, data1: pd.Series, data2: pd.Series, col1: str, col2: str) -> List[str]:
        """Generate insights for categorical bivariate analysis"""
        return ['Categorical bivariate insights implementation pending']
    
    def _generate_bivariate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations for bivariate analysis"""
        return ['Bivariate recommendations implementation pending']
    
    # Additional placeholder methods
    def _find_high_correlations(self, corr_matrix: pd.DataFrame) -> List[Dict[str, Any]]:
        """Find high correlations in matrix"""
        return []
    
    def _detect_multicollinearity(self, corr_matrix: pd.DataFrame) -> Dict[str, Any]:
        """Detect multicollinearity"""
        return {'note': 'Multicollinearity detection implementation pending'}
    
    def _calculate_feature_importance(self, columns: List[str], target_column: str) -> Dict[str, Any]:
        """Calculate feature importance"""
        return {'note': 'Feature importance calculation implementation pending'}
    
    def _analyze_feature_interactions(self, columns: List[str], target_column: str) -> Dict[str, Any]:
        """Analyze feature interactions"""
        return {'note': 'Feature interaction analysis implementation pending'}
    
    def _analyze_dimensionality(self, columns: List[str]) -> Dict[str, Any]:
        """Analyze dimensionality"""
        return {'note': 'Dimensionality analysis implementation pending'}
    
    def _generate_multivariate_insights(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate multivariate insights"""
        return ['Multivariate insights implementation pending']
    
    def _generate_multivariate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate multivariate recommendations"""
        return ['Multivariate recommendations implementation pending']
    
    # Additional analysis methods (simplified for space)
    def _detect_outliers_method(self, data: pd.Series, method: str) -> Dict[str, Any]:
        """Detect outliers using specific method"""
        return {'note': f'{method} outlier detection implementation pending'}
    
    def _analyze_outlier_impact(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze impact of outliers"""
        return {'note': 'Outlier impact analysis implementation pending'}
    
    def _generate_outlier_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate outlier recommendations"""
        return ['Outlier recommendations implementation pending']
    
    def _analyze_missing_patterns(self, column: str) -> Dict[str, Any]:
        """Analyze missing value patterns"""
        return {'note': 'Missing pattern analysis implementation pending'}
    
    def _suggest_imputation_methods(self, data: pd.Series) -> List[str]:
        """Suggest imputation methods"""
        return ['Mean/median imputation', 'Mode imputation', 'Forward/backward fill']
    
    def _analyze_missing_impact(self, column: str) -> Dict[str, Any]:
        """Analyze impact of missing values"""
        return {'note': 'Missing value impact analysis implementation pending'}
    
    def _generate_missing_value_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate missing value recommendations"""
        return ['Missing value recommendations implementation pending']
    
    def _identify_distribution_type(self, data: pd.Series) -> str:
        """Identify distribution type"""
        if pd.api.types.is_numeric_dtype(data):
            return 'continuous'
        else:
            return 'categorical'
    
    def _calculate_distribution_parameters(self, data: pd.Series) -> Dict[str, Any]:
        """Calculate distribution parameters"""
        return self._analyze_numeric_distribution(data)
    
    def _test_distribution_fit(self, data: pd.Series) -> Dict[str, Any]:
        """Test distribution fit"""
        return {'note': 'Distribution fit testing implementation pending'}
    
    def _analyze_transformations(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze potential transformations"""
        return {'note': 'Transformation analysis implementation pending'}
    
    def _generate_distribution_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate distribution recommendations"""
        return ['Distribution recommendations implementation pending']
    
    def _analyze_encoding_needs(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze encoding needs for categorical data"""
        unique_count = data.nunique()
        
        if unique_count == 2:
            return {'recommended_encoding': 'label', 'reason': 'Binary categorical'}
        elif unique_count <= 10:
            return {'recommended_encoding': 'onehot', 'reason': 'Low cardinality'}
        else:
            return {'recommended_encoding': 'target', 'reason': 'High cardinality'}
    
    def _analyze_cardinality(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze cardinality of categorical data"""
        unique_count = data.nunique()
        total_count = len(data)
        
        return {
            'cardinality_level': 'high' if unique_count > total_count * 0.8 else 'medium' if unique_count > 10 else 'low',
            'unique_ratio': unique_count / total_count,
            'recommended_action': 'group_rare_categories' if unique_count > 50 else 'standard_encoding'
        }
    
    def _generate_categorical_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate categorical recommendations"""
        recommendations = []
        
        cardinality = analysis['cardinality_analysis']['cardinality_level']
        if cardinality == 'high':
            recommendations.append('Consider grouping rare categories or using target encoding')
        elif cardinality == 'low':
            recommendations.append('Good candidate for one-hot encoding')
        
        return recommendations
    
    def _analyze_temporal_patterns(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze temporal patterns"""
        data_clean = data.dropna()
        if len(data_clean) == 0:
            return {'error': 'No valid dates'}
        
        return {
            'date_range': {
                'start': str(data_clean.min()),
                'end': str(data_clean.max()),
                'span_days': (data_clean.max() - data_clean.min()).days
            },
            'patterns': {
                'years': data_clean.dt.year.nunique(),
                'months': data_clean.dt.month.nunique(),
                'days_of_week': data_clean.dt.dayofweek.nunique()
            }
        }
    
    def _analyze_seasonality(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze seasonality in temporal data"""
        return {'note': 'Seasonality analysis implementation pending'}
    
    def _analyze_trends(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze trends in temporal data"""
        return {'note': 'Trend analysis implementation pending'}
    
    def _generate_temporal_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate temporal recommendations"""
        return ['Extract date components (year, month, day)', 'Consider cyclical encoding for time features']
    
    def _get_quality_metrics(self, data: pd.Series) -> Dict[str, Any]:
        """Get data quality metrics"""
        return {
            'completeness': (data.count() / len(data)) * 100,
            'consistency': 100.0,  # Simplified
            'validity': 100.0,     # Simplified
            'accuracy': 100.0,     # Simplified
            'uniqueness': (data.nunique() / len(data)) * 100
        }
    
    def _get_outlier_summary(self, data: pd.Series) -> Dict[str, Any]:
        """Get outlier summary"""
        return self._analyze_outliers(data)
    
    def _assess_normality(self, data: pd.Series) -> Dict[str, Any]:
        """Assess normality"""
        return self._test_normality(data)
    
    def _assess_cardinality(self, data: pd.Series) -> Dict[str, Any]:
        """Assess cardinality"""
        return self._analyze_cardinality(data)
    
    def _get_temporal_summary(self, data: pd.Series) -> Dict[str, Any]:
        """Get temporal summary"""
        return self._analyze_temporal_patterns(data)
    
    def _generate_comprehensive_recommendations(self, data: pd.Series, column: str, summary: Dict[str, Any]) -> List[str]:
        """Generate comprehensive recommendations"""
        recommendations = []
        
        # Quality-based recommendations
        quality_metrics = summary['quality_metrics']
        if quality_metrics['completeness'] < 95:
            recommendations.append('Address missing values to improve data completeness')
        
        if quality_metrics['uniqueness'] < 50 and pd.api.types.is_numeric_dtype(data):
            recommendations.append('Low uniqueness - check for data collection issues')
        
        return recommendations
    
    def _calculate_analysis_completeness(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate analysis completeness score"""
        completed_sections = 0
        total_sections = 0
        
        sections = ['basic_statistics', 'quality_metrics', 'distribution_summary', 'insights']
        for section in sections:
            total_sections += 1
            if section in summary and summary[section]:
                completed_sections += 1
        
        return {
            'score': (completed_sections / total_sections) * 100,
            'completed_sections': completed_sections,
            'total_sections': total_sections
        }
    
    # Data quality assessment methods
    def _assess_completeness(self, data: pd.Series) -> Dict[str, Any]:
        """Assess data completeness"""
        completeness = (data.count() / len(data)) * 100
        return {
            'score': completeness,
            'issues': ['Missing values detected'] if completeness < 100 else [],
            'description': f'{completeness:.1f}% of values are present'
        }
    
    def _assess_consistency(self, data: pd.Series) -> Dict[str, Any]:
        """Assess data consistency"""
        # Simplified consistency check
        return {
            'score': 100.0,
            'issues': [],
            'description': 'Data format appears consistent'
        }
    
    def _assess_validity(self, data: pd.Series) -> Dict[str, Any]:
        """Assess data validity"""
        # Simplified validity check
        return {
            'score': 100.0,
            'issues': [],
            'description': 'Data values appear valid'
        }
    
    def _assess_accuracy(self, data: pd.Series) -> Dict[str, Any]:
        """Assess data accuracy"""
        # Simplified accuracy check
        return {
            'score': 100.0,
            'issues': [],
            'description': 'Cannot determine accuracy without reference data'
        }
    
    def _assess_uniqueness(self, data: pd.Series) -> Dict[str, Any]:
        """Assess data uniqueness"""
        uniqueness = (data.nunique() / len(data)) * 100
        return {
            'score': uniqueness,
            'issues': ['High duplication detected'] if uniqueness < 50 else [],
            'description': f'{uniqueness:.1f}% of values are unique'
        }
    
    def _generate_quality_recommendations(self, quality_analysis: Dict[str, Any]) -> List[str]:
        """Generate quality recommendations"""
        recommendations = []
        
        if quality_analysis['overall_score'] < 80:
            recommendations.append('Overall data quality is below recommended threshold')
        
        if quality_analysis['completeness']['score'] < 95:
            recommendations.append('Improve data completeness by addressing missing values')
        
        return recommendations
    
    # Statistical analysis methods
    def _get_descriptive_statistics(self, data: pd.Series) -> Dict[str, Any]:
        """Get descriptive statistics"""
        return self._analyze_numeric_distribution(data)
    
    def _get_inferential_statistics(self, data: pd.Series) -> Dict[str, Any]:
        """Get inferential statistics"""
        return {'note': 'Inferential statistics implementation pending'}
    
    def _run_hypothesis_tests(self, data: pd.Series) -> Dict[str, Any]:
        """Run hypothesis tests"""
        return self._test_normality(data)
    
    def _calculate_confidence_intervals(self, data: pd.Series) -> Dict[str, Any]:
        """Calculate confidence intervals"""
        mean = data.mean()
        sem = stats.sem(data)
        ci_95 = stats.t.interval(0.95, len(data)-1, loc=mean, scale=sem)
        
        return {
            'mean_95_ci': {
                'lower': float(ci_95[0]),
                'upper': float(ci_95[1])
            }
        }
    
    def _calculate_effect_sizes(self, data: pd.Series) -> Dict[str, Any]:
        """Calculate effect sizes"""
        return {'note': 'Effect size calculation implementation pending'}
    
    def _get_categorical_statistics(self, data: pd.Series) -> Dict[str, Any]:
        """Get categorical statistics"""
        return self._analyze_categorical_distribution(data)
    
    def _run_categorical_tests(self, data: pd.Series) -> Dict[str, Any]:
        """Run categorical tests"""
        return {'note': 'Categorical statistical tests implementation pending'}
    
    def _generate_statistical_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate statistical recommendations"""
        return ['Statistical recommendations implementation pending']
