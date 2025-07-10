import pandas as pd
import numpy as np
from scipy import stats
from sklearn.feature_selection import mutual_info_classif, mutual_info_regression
from sklearn.preprocessing import LabelEncoder
from models import Dataset, ComparisonResult, db
from services.data_processor import DataProcessor
from utils import safe_json_response, get_safe_stats, create_response
import logging
from datetime import datetime
 
class Comparison:
     def __init__(self):
         self.data_processor = DataProcessor()
         self.logger = logging.getLogger(__name__)
     
     def compare_columns(self, dataset_id, columns, comparison_type='statistical'):
         """Compare multiple columns using specified comparison type"""
         try:
             dataset = Dataset.query.get_or_404(dataset_id)
             df = self.data_processor.load_dataset(dataset)
             
             if len(columns) < 2:
                 return create_response(False, error="At least 2 columns are required for comparison")
             
             # Validate columns exist
             missing_cols = [col for col in columns if col not in df.columns]
             if missing_cols:
                 return create_response(False, error=f"Columns not found: {missing_cols}")
             
             results = {}
             
             if comparison_type == 'statistical':
                 results = self._statistical_comparison(df, columns)
             elif comparison_type == 'correlation':
                 results = self._correlation_comparison(df, columns)
             elif comparison_type == 'distribution':
                 results = self._distribution_comparison(df, columns)
             else:
                 return create_response(False, error=f"Unknown comparison type: {comparison_type}")
             
             # Save comparison result
             comparison_result = ComparisonResult(
                 dataset_id=dataset_id,
                 column1=columns[0],
                 column2=columns[1] if len(columns) > 1 else '',
                 comparison_type=comparison_type,
                 test_statistic=results.get('test_statistic'),
                 p_value=results.get('p_value'),
                 effect_size=results.get('effect_size'),
                 interpretation=results.get('interpretation', ''),
                 recommendations=results.get('recommendations', {})
             )
             db.session.add(comparison_result)
             db.session.commit()
             
             return create_response(True, "Comparison completed successfully", results)
             
         except Exception as e:
             self.logger.error(f"Column comparison error: {str(e)}")
             return create_response(False, error=str(e))
     
     def compare_numerical(self, dataset_id, column1, column2):
         """Compare two numerical columns"""
         try:
             dataset = Dataset.query.get_or_404(dataset_id)
             df = self.data_processor.load_dataset(dataset)
             
             # Validate columns
             if column1 not in df.columns or column2 not in df.columns:
                 return create_response(False, error="One or more columns not found")
             
             # Check if columns are numerical
             if not pd.api.types.is_numeric_dtype(df[column1]) or not pd.api.types.is_numeric_dtype(df[column2]):
                 return create_response(False, error="Both columns must be numerical")
             
             # Remove missing values
             clean_data = df[[column1, column2]].dropna()
             
             if len(clean_data) < 3:
                 return create_response(False, error="Insufficient data for comparison")
             
             # Perform statistical tests
             correlation, p_value_corr = stats.pearsonr(clean_data[column1], clean_data[column2])
             spearman_corr, p_value_spearman = stats.spearmanr(clean_data[column1], clean_data[column2])
             
             # T-test for difference in means
             t_stat, p_value_ttest = stats.ttest_ind(clean_data[column1], clean_data[column2])
             
             # Kolmogorov-Smirnov test for distribution difference
             ks_stat, p_value_ks = stats.ks_2samp(clean_data[column1], clean_data[column2])
             
             # Effect size (Cohen's d)
             cohens_d = self._calculate_cohens_d(clean_data[column1], clean_data[column2])
             
             # Basic statistics
             stats1 = get_safe_stats(clean_data, [column1])[column1]
             stats2 = get_safe_stats(clean_data, [column2])[column2]
             
             results = {
                 'comparison_type': 'numerical',
                 'columns': [column1, column2],
                 'sample_size': len(clean_data),
                 'pearson_correlation': {
                     'coefficient': correlation,
                     'p_value': p_value_corr,
                     'interpretation': self._interpret_correlation(correlation)
                 },
                 'spearman_correlation': {
                     'coefficient': spearman_corr,
                     'p_value': p_value_spearman,
                     'interpretation': self._interpret_correlation(spearman_corr)
                 },
                 'difference_test': {
                     't_statistic': t_stat,
                     'p_value': p_value_ttest,
                     'interpretation': self._interpret_p_value(p_value_ttest, "means")
                 },
                 'distribution_test': {
                     'ks_statistic': ks_stat,
                     'p_value': p_value_ks,
                     'interpretation': self._interpret_p_value(p_value_ks, "distributions")
                 },
                 'effect_size': {
                     'cohens_d': cohens_d,
                     'interpretation': self._interpret_cohens_d(cohens_d)
                 },
                 'descriptive_stats': {
                     column1: stats1,
                     column2: stats2
                 },
                 'recommendations': self._get_numerical_recommendations(correlation, p_value_corr, cohens_d)
             }
             
             return create_response(True, "Numerical comparison completed", results)
             
         except Exception as e:
             self.logger.error(f"Numerical comparison error: {str(e)}")
             return create_response(False, error=str(e))
     
     def compare_categorical(self, dataset_id, column1, column2):
         """Compare two categorical columns"""
         try:
             dataset = Dataset.query.get_or_404(dataset_id)
             df = self.data_processor.load_dataset(dataset)
             
             # Validate columns
             if column1 not in df.columns or column2 not in df.columns:
                 return create_response(False, error="One or more columns not found")
             
             # Remove missing values
             clean_data = df[[column1, column2]].dropna()
             
             if len(clean_data) < 5:
                 return create_response(False, error="Insufficient data for comparison")
             
             # Create contingency table
             contingency_table = pd.crosstab(clean_data[column1], clean_data[column2])
             
             # Chi-square test
             chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)
             
             # Cramér's V (effect size)
             cramers_v = self._calculate_cramers_v(chi2, contingency_table)
             
             # Mutual information
             le1 = LabelEncoder()
             le2 = LabelEncoder()
             encoded1 = le1.fit_transform(clean_data[column1].astype(str))
             encoded2 = le2.fit_transform(clean_data[column2].astype(str))
             mutual_info = mutual_info_classif(encoded1.reshape(-1, 1), encoded2)[0]
             
             results = {
                 'comparison_type': 'categorical',
                 'columns': [column1, column2],
                 'sample_size': len(clean_data),
                 'contingency_table': contingency_table.to_dict(),
                 'chi_square_test': {
                     'chi2_statistic': chi2,
                     'p_value': p_value,
                     'degrees_of_freedom': dof,
                     'interpretation': self._interpret_p_value(p_value, "independence")
                 },
                 'effect_size': {
                     'cramers_v': cramers_v,
                     'interpretation': self._interpret_cramers_v(cramers_v)
                 },
                 'mutual_information': {
                     'score': mutual_info,
                     'interpretation': self._interpret_mutual_info(mutual_info)
                 },
                 'unique_values': {
                     column1: int(clean_data[column1].nunique()),
                     column2: int(clean_data[column2].nunique())
                 },
                 'recommendations': self._get_categorical_recommendations(p_value, cramers_v)
             }
             
             return create_response(True, "Categorical comparison completed", results)
             
         except Exception as e:
             self.logger.error(f"Categorical comparison error: {str(e)}")
             return create_response(False, error=str(e))
     
     def compare_mixed(self, dataset_id, numerical_column, categorical_column):
         """Compare numerical column across categorical groups"""
         try:
             dataset = Dataset.query.get_or_404(dataset_id)
             df = self.data_processor.load_dataset(dataset)
             
             # Validate columns
             if numerical_column not in df.columns or categorical_column not in df.columns:
                 return create_response(False, error="One or more columns not found")
             
             # Check data types
             if not pd.api.types.is_numeric_dtype(df[numerical_column]):
                 return create_response(False, error=f"{numerical_column} must be numerical")
             
             # Remove missing values
             clean_data = df[[numerical_column, categorical_column]].dropna()
             
             if len(clean_data) < 5:
                 return create_response(False, error="Insufficient data for comparison")
             
             # Group statistics
             group_stats = clean_data.groupby(categorical_column)[numerical_column].agg([
                 'count', 'mean', 'std', 'min', 'max', 'median'
             ]).round(4)
             
             # ANOVA test
             groups = [group[numerical_column].values for name, group in clean_data.groupby(categorical_column)]
             f_stat, p_value_anova = stats.f_oneway(*groups)
             
             # Effect size (eta squared)
             eta_squared = self._calculate_eta_squared(clean_data, numerical_column, categorical_column)
             
             # Kruskal-Wallis test (non-parametric alternative)
             h_stat, p_value_kw = stats.kruskal(*groups)
             
             results = {
                 'comparison_type': 'mixed',
                 'numerical_column': numerical_column,
                 'categorical_column': categorical_column,
                 'sample_size': len(clean_data),
                 'group_statistics': group_stats.to_dict(),
                 'anova_test': {
                     'f_statistic': f_stat,
                     'p_value': p_value_anova,
                     'interpretation': self._interpret_p_value(p_value_anova, "group differences")
                 },
                 'kruskal_wallis_test': {
                     'h_statistic': h_stat,
                     'p_value': p_value_kw,
                     'interpretation': self._interpret_p_value(p_value_kw, "group differences (non-parametric)")
                 },
                 'effect_size': {
                     'eta_squared': eta_squared,
                     'interpretation': self._interpret_eta_squared(eta_squared)
                 },
                 'group_count': len(groups),
                 'recommendations': self._get_mixed_recommendations(p_value_anova, eta_squared)
             }
             
             return create_response(True, "Mixed comparison completed", results)
             
         except Exception as e:
             self.logger.error(f"Mixed comparison error: {str(e)}")
             return create_response(False, error=str(e))
     
     def compare_groups(self, dataset_id, target_column, group_column):
         """Compare target variable across different groups"""
         try:
             dataset = Dataset.query.get_or_404(dataset_id)
             df = self.data_processor.load_dataset(dataset)
             
             # Validate columns
             if target_column not in df.columns or group_column not in df.columns:
                 return create_response(False, error="One or more columns not found")
             
             clean_data = df[[target_column, group_column]].dropna()
             
             if len(clean_data) < 5:
                 return create_response(False, error="Insufficient data for comparison")
             
             # Determine comparison type based on target column type
             if pd.api.types.is_numeric_dtype(clean_data[target_column]):
                 return self.compare_mixed(dataset_id, target_column, group_column)
             else:
                 return self.compare_categorical(dataset_id, target_column, group_column)
                 
         except Exception as e:
             self.logger.error(f"Group comparison error: {str(e)}")
             return create_response(False, error=str(e))
     
     def compare_distributions(self, dataset_id, columns):
         """Compare distributions of multiple columns"""
         try:
             dataset = Dataset.query.get_or_404(dataset_id)
             df = self.data_processor.load_dataset(dataset)
             
             if len(columns) < 2:
                 return create_response(False, error="At least 2 columns are required")
             
             # Validate columns
             missing_cols = [col for col in columns if col not in df.columns]
             if missing_cols:
                 return create_response(False, error=f"Columns not found: {missing_cols}")
             
             # Filter to numeric columns only
             numeric_columns = [col for col in columns if pd.api.types.is_numeric_dtype(df[col])]
             
             if len(numeric_columns) < 2:
                 return create_response(False, error="At least 2 numeric columns required for distribution comparison")
             
             clean_data = df[numeric_columns].dropna()
             
             if len(clean_data) < 5:
                 return create_response(False, error="Insufficient data for comparison")
             
             # Pairwise distribution comparisons
             comparisons = {}
             for i, col1 in enumerate(numeric_columns):
                 for col2 in numeric_columns[i+1:]:
                     # Kolmogorov-Smirnov test
                     ks_stat, p_value = stats.ks_2samp(clean_data[col1], clean_data[col2])
                     
                     comparisons[f"{col1}_vs_{col2}"] = {
                         'ks_statistic': ks_stat,
                         'p_value': p_value,
                         'interpretation': self._interpret_p_value(p_value, "distributions")
                     }
             
             # Overall statistics for each column
             distribution_stats = {}
             for col in numeric_columns:
                 stats_dict = get_safe_stats(clean_data, [col])[col]
                 
                 # Add distribution properties
                 skewness = stats.skew(clean_data[col].dropna())
                 kurtosis = stats.kurtosis(clean_data[col].dropna())
                 
                 stats_dict.update({
                     'skewness': skewness,
                     'kurtosis': kurtosis,
                     'distribution_shape': self._interpret_skewness(skewness)
                 })
                 
                 distribution_stats[col] = stats_dict
             
             results = {
                 'comparison_type': 'distributions',
                 'columns': numeric_columns,
                 'sample_size': len(clean_data),
                 'pairwise_comparisons': comparisons,
                 'distribution_statistics': distribution_stats,
                 'recommendations': self._get_distribution_recommendations(comparisons)
             }
             
             return create_response(True, "Distribution comparison completed", results)
             
         except Exception as e:
             self.logger.error(f"Distribution comparison error: {str(e)}")
             return create_response(False, error=str(e))
     
     # Helper methods for statistical calculations and interpretations
     def _calculate_cohens_d(self, group1, group2):
         """Calculate Cohen's d effect size"""
         try:
             n1, n2 = len(group1), len(group2)
             var1, var2 = group1.var(ddof=1), group2.var(ddof=1)
             pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
             return (group1.mean() - group2.mean()) / pooled_std
         except:
             return 0.0
     
     def _calculate_cramers_v(self, chi2, contingency_table):
         """Calculate Cramér's V effect size"""
         try:
             n = contingency_table.sum().sum()
             min_dim = min(contingency_table.shape) - 1
             return np.sqrt(chi2 / (n * min_dim))
         except:
             return 0.0
     
     def _calculate_eta_squared(self, data, numerical_col, categorical_col):
         """Calculate eta squared effect size for ANOVA"""
         try:
             groups = [group[numerical_col].values for name, group in data.groupby(categorical_col)]
             overall_mean = data[numerical_col].mean()
             
             ss_between = sum(len(group) * (np.mean(group) - overall_mean)**2 for group in groups)
             ss_total = sum((data[numerical_col] - overall_mean)**2)
             
             return ss_between / ss_total if ss_total > 0 else 0.0
         except:
             return 0.0
     
     def _interpret_correlation(self, correlation):
         """Interpret correlation strength"""
         abs_corr = abs(correlation)
         if abs_corr < 0.1:
             return "Negligible correlation"
         elif abs_corr < 0.3:
             return "Weak correlation"
         elif abs_corr < 0.5:
             return "Moderate correlation"
         elif abs_corr < 0.7:
             return "Strong correlation"
         else:
             return "Very strong correlation"
     
     def _interpret_p_value(self, p_value, context):
         """Interpret p-value significance"""
         if p_value < 0.001:
             return f"Highly significant {context} (p < 0.001)"
         elif p_value < 0.01:
             return f"Very significant {context} (p < 0.01)"
         elif p_value < 0.05:
             return f"Significant {context} (p < 0.05)"
         else:
             return f"No significant {context} (p ≥ 0.05)"
     
     def _interpret_cohens_d(self, d):
         """Interpret Cohen's d effect size"""
         abs_d = abs(d)
         if abs_d < 0.2:
             return "Negligible effect"
         elif abs_d < 0.5:
             return "Small effect"
         elif abs_d < 0.8:
             return "Medium effect"
         else:
             return "Large effect"
     
     def _interpret_cramers_v(self, v):
         """Interpret Cramér's V effect size"""
         if v < 0.1:
             return "Negligible association"
         elif v < 0.3:
             return "Weak association"
         elif v < 0.5:
             return "Moderate association"
         else:
             return "Strong association"
     
     def _interpret_eta_squared(self, eta_sq):
         """Interpret eta squared effect size"""
         if eta_sq < 0.01:
             return "Negligible effect"
         elif eta_sq < 0.06:
             return "Small effect"
         elif eta_sq < 0.14:
             return "Medium effect"
         else:
             return "Large effect"
     
     def _interpret_mutual_info(self, mi):
         """Interpret mutual information score"""
         if mi < 0.1:
             return "Low mutual information"
         elif mi < 0.3:
             return "Moderate mutual information"
         else:
             return "High mutual information"
     
     def _interpret_skewness(self, skewness):
         """Interpret distribution skewness"""
         if abs(skewness) < 0.5:
             return "Approximately symmetric"
         elif skewness > 0.5:
             return "Right-skewed (positive skew)"
         else:
             return "Left-skewed (negative skew)"
     
     def _get_numerical_recommendations(self, correlation, p_value, effect_size):
         """Generate recommendations for numerical comparisons"""
         recommendations = []
         
         if abs(correlation) > 0.5 and p_value < 0.05:
             recommendations.append("Strong correlation detected - consider for feature selection")
         
         if abs(effect_size) > 0.8:
             recommendations.append("Large effect size - practical significance confirmed")
         
         if p_value >= 0.05:
             recommendations.append("No significant relationship - may not be useful for prediction")
         
         return recommendations
     
     def _get_categorical_recommendations(self, p_value, cramers_v):
         """Generate recommendations for categorical comparisons"""
         recommendations = []
         
         if p_value < 0.05 and cramers_v > 0.3:
             recommendations.append("Strong association detected - variables are related")
         
         if cramers_v < 0.1:
             recommendations.append("Weak association - variables may be independent")
         
         return recommendations
     
     def _get_mixed_recommendations(self, p_value, eta_squared):
         """Generate recommendations for mixed comparisons"""
         recommendations = []
         
         if p_value < 0.05:
             recommendations.append("Significant group differences detected")
         
         if eta_squared > 0.14:
             recommendations.append("Large effect size - groups are substantially different")
         
         return recommendations
     
     def _get_distribution_recommendations(self, comparisons):
         """Generate recommendations for distribution comparisons"""
         recommendations = []
         
         significant_diffs = sum(1 for comp in comparisons.values() if comp['p_value'] < 0.05)
         total_comps = len(comparisons)
         
         if significant_diffs > total_comps * 0.5:
             recommendations.append("Many significant distribution differences detected")
         
         return recommendations