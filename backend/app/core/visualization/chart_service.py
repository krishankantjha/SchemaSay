import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field

class ChartConfig(BaseModel):
    """
    Pydantic schema representing the auto-visualization configuration metadata.
    """
    chart_type: str = Field(default="table", pattern="^(table|line|bar|scatter|pie|histogram)$")
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    color_axis: Optional[str] = None

def infer_column_types(df: pd.DataFrame) -> Tuple[List[str], List[str], List[str]]:
    """
    Robustly infers column categories (temporal, numeric, categorical) from a Pandas DataFrame,
    supporting ISO formats, DD-MM-YYYY, MM/DD/YYYY, Unix timestamps, and timezone-aware timestamps.
    """
    temporal_cols = []
    numeric_cols = []
    categorical_cols = []

    for col in df.columns:
        col_series = df[col]
        col_lower = str(col).lower()

        # Handle fully null columns as categorical fallback
        if col_series.isna().all():
            categorical_cols.append(col)
            continue

        # 1. Temporal column detection (Datetime/timezone-aware series)
        if pd.api.types.is_datetime64_any_dtype(col_series) or isinstance(col_series.dtype, pd.DatetimeTZDtype):
            temporal_cols.append(col)
            continue

        # Check for Unix timestamps (numeric but named date/timestamp/epoch)
        if pd.api.types.is_numeric_dtype(col_series) and any(k in col_lower for k in ["timestamp", "epoch", "sale_date"]):
            sample_vals = col_series.dropna().head(10)
            if not sample_vals.empty:
                # Seconds range: 1970 to 2050 -> 0 to 2.5 * 10^9
                # Milliseconds range: 1970 to 2050 -> 0 to 2.5 * 10^12
                all_in_epoch_seconds = sample_vals.between(0, 2524608000).all()
                all_in_epoch_millis = sample_vals.between(0, 2524608000000).all()
                if all_in_epoch_seconds or all_in_epoch_millis:
                    temporal_cols.append(col)
                    continue

        # Try to parse string dates supporting common formats (ISO, DD-MM-YYYY, MM/DD/YYYY)
        if pd.api.types.is_string_dtype(col_series) or pd.api.types.is_object_dtype(col_series):
            if any(k in col_lower for k in ["date", "time", "year", "month", "created_at", "updated_at", "timestamp"]):
                try:
                    # Verify conversion succeeded on non-null subset sample records
                    pd.to_datetime(col_series.dropna().head(10), errors="raise")
                    temporal_cols.append(col)
                    continue
                except Exception:
                    pass

        # 2. Numeric column detection (excluding ID keys)
        if pd.api.types.is_numeric_dtype(col_series):
            if not col_lower.endswith("id") and col_lower != "id":
                numeric_cols.append(col)
            else:
                categorical_cols.append(col)
        else:
            categorical_cols.append(col)

    return temporal_cols, numeric_cols, categorical_cols

def select_chart_type_from_df(df: pd.DataFrame, question: str) -> ChartConfig:
    """
    Directly evaluates a Pandas DataFrame to determine the ideal chart type,
    reducing double conversion steps when a DataFrame is already available.
    """
    if df.empty:
        return ChartConfig(chart_type="table")

    temporal_cols, numeric_cols, categorical_cols = infer_column_types(df)
    q_lower = question.lower()

    # Rule 1: Temporal + Numeric -> Line Chart
    if temporal_cols and numeric_cols:
        color_axis = categorical_cols[0] if categorical_cols else None
        return ChartConfig(
            chart_type="line",
            x_axis=temporal_cols[0],
            y_axis=numeric_cols[0],
            color_axis=color_axis
        )

    # Rule 2: Categorical + Numeric -> Bar or Pie Chart
    if categorical_cols and numeric_cols:
        cat_col = categorical_cols[0]
        num_col = numeric_cols[0]
        
        distinct_vals = df[cat_col].dropna().unique()
        cardinality = len(distinct_vals)

        # Match share/composition query intents under low cardinality -> Pie Chart
        if cardinality < 10 and any(k in q_lower for k in ["percent", "percentage", "share", "proportion", "breakdown", "ratio", "composition"]):
            # Validate Pie Chart numerical contents (reject negative values, NaNs, or Infinities)
            num_series = df[num_col].dropna()
            has_invalid_pie_vals = (num_series < 0).any() or np.isinf(num_series).any() or num_series.isna().any()
            
            if not has_invalid_pie_vals:
                return ChartConfig(
                    chart_type="pie",
                    x_axis=cat_col,
                    y_axis=num_col
                )

        # Comparative analytics -> Bar Chart
        if cardinality <= 30:
            return ChartConfig(
                chart_type="bar",
                x_axis=cat_col,
                y_axis=num_col
            )

    # Rule 3: Two Numeric columns -> Scatter Plot
    if len(numeric_cols) >= 2:
        color_axis = categorical_cols[0] if categorical_cols else None
        return ChartConfig(
            chart_type="scatter",
            x_axis=numeric_cols[0],
            y_axis=numeric_cols[1],
            color_axis=color_axis
        )

    # Rule 4: Single Numeric with distribution intent -> Histogram
    if len(numeric_cols) == 1 and len(df) > 5 and any(k in q_lower for k in ["distribution", "spread", "frequency", "range", "histogram"]):
        return ChartConfig(
            chart_type="histogram",
            x_axis=numeric_cols[0]
        )

    return ChartConfig(chart_type="table")

def select_chart_type(columns: List[str], rows: List[Dict[str, Any]], question: str) -> ChartConfig:
    """
    Analyzes list-of-dicts database rows to select the optimal chart configuration.
    """
    if not columns or not rows:
        return ChartConfig(chart_type="table")

    try:
        df = pd.DataFrame(rows, columns=columns)
        return select_chart_type_from_df(df, question)
    except Exception:
        return ChartConfig(chart_type="table")

