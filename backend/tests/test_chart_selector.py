from app.core.visualization.chart_service import select_chart_type

def test_chart_selector_line():
    """
    Verifies that date/time column + numeric column selects a Line Chart.
    """
    columns = ["sale_date", "revenue"]
    rows = [
        {"sale_date": "2026-07-01", "revenue": 120.5},
        {"sale_date": "2026-07-02", "revenue": 140.0},
        {"sale_date": "2026-07-03", "revenue": 110.0}
    ]
    config = select_chart_type(columns, rows, "show revenue trend")
    assert config.chart_type == "line"
    assert config.x_axis == "sale_date"
    assert config.y_axis == "revenue"

def test_chart_selector_pie():
    """
    Verifies that low cardinality category + numeric + share keywords selects a Pie Chart.
    """
    columns = ["category", "sales"]
    rows = [
        {"category": "Electronics", "sales": 500},
        {"category": "Apparel", "sales": 300},
        {"category": "Home", "sales": 200}
    ]
    config = select_chart_type(columns, rows, "get category sales percentage breakdown")
    assert config.chart_type == "pie"
    assert config.x_axis == "category"
    assert config.y_axis == "sales"

def test_chart_selector_bar():
    """
    Verifies that category + numeric comparison selects a Bar Chart.
    """
    columns = ["product", "stock"]
    rows = [
        {"product": "Laptop", "stock": 15},
        {"product": "Phone", "stock": 42},
        {"product": "Tablet", "stock": 8}
    ]
    config = select_chart_type(columns, rows, "list stock counts by product")
    assert config.chart_type == "bar"
    assert config.x_axis == "product"
    assert config.y_axis == "stock"

def test_chart_selector_scatter():
    """
    Verifies that multiple numeric columns selects a Scatter Plot.
    """
    columns = ["age", "salary"]
    rows = [
        {"age": 25, "salary": 50000},
        {"age": 35, "salary": 85000},
        {"age": 45, "salary": 120000}
    ]
    config = select_chart_type(columns, rows, "correlate salary with employee age")
    assert config.chart_type == "scatter"
    assert config.x_axis == "age"
    assert config.y_axis == "salary"

def test_chart_selector_histogram():
    """
    Verifies that single numeric column + frequency keywords selects a Histogram.
    """
    columns = ["order_amount"]
    rows = [
        {"order_amount": 10.0},
        {"order_amount": 15.5},
        {"order_amount": 22.0},
        {"order_amount": 8.0},
        {"order_amount": 14.0},
        {"order_amount": 19.5}
    ]
    config = select_chart_type(columns, rows, "show distribution of order amount")
    assert config.chart_type == "histogram"
    assert config.x_axis == "order_amount"

def test_chart_selector_table_fallback():
    """
    Verifies that unclassified formats default to a Table representation.
    """
    columns = ["first_name", "last_name", "email"]
    rows = [
        {"first_name": "Divya", "last_name": "Patel", "email": "divya@example.com"},
        {"first_name": "Krishna", "last_name": "Kumar", "email": "krish@example.com"}
    ]
    config = select_chart_type(columns, rows, "get active members roster list")
    assert config.chart_type == "table"

def test_chart_selector_null_handling():
    """
    Verifies that column classification handles null values gracefully.
    If the first row is NULL but subsequent values are numeric, the column is classified as numeric.
    """
    columns = ["product", "revenue"]
    rows = [
        {"product": "Laptop", "revenue": None},
        {"product": "Phone", "revenue": 140.0},
        {"product": "Tablet", "revenue": 110.0}
    ]
    config = select_chart_type(columns, rows, "list revenue counts by product")
    assert config.chart_type == "bar"
    assert config.x_axis == "product"
    assert config.y_axis == "revenue"

def test_chart_selector_empty_fallback():
    """
    Verifies that empty result sets fallback to table configurations.
    """
    assert select_chart_type([], [], "list orders").chart_type == "table"

def test_chart_selector_pie_invalid_values():
    """
    Verifies that if a dataset contains negative numbers, NaNs, or Infinities,
    it rejects selecting a Pie chart and falls back to a Bar chart.
    """
    columns = ["category", "sales"]
    rows = [
        {"category": "Electronics", "sales": 500},
        {"category": "Apparel", "sales": -300},  # Negative value
        {"category": "Home", "sales": 200}
    ]
    config = select_chart_type(columns, rows, "get category sales percentage breakdown")
    assert config.chart_type == "bar"  # Falls back to bar

def test_chart_selector_epoch_dates():
    """
    Verifies that columns named epoch or timestamp with numeric values are classified as temporal.
    """
    columns = ["epoch", "sales"]
    rows = [
        {"epoch": 1719878400, "sales": 100},
        {"epoch": 1719964800, "sales": 120},
        {"epoch": 1720051200, "sales": 110}
    ]
    config = select_chart_type(columns, rows, "show sales trend")
    assert config.chart_type == "line"
    assert config.x_axis == "epoch"

def test_chart_selector_non_iso_dates():
    """
    Verifies that non-ISO date string formats (DD-MM-YYYY) are recognized as temporal.
    """
    columns = ["sale_date", "sales"]
    rows = [
        {"sale_date": "01-07-2026", "sales": 100},
        {"sale_date": "02-07-2026", "sales": 120},
        {"sale_date": "03-07-2026", "sales": 110}
    ]
    config = select_chart_type(columns, rows, "show sales trend")
    assert config.chart_type == "line"
    assert config.x_axis == "sale_date"

def test_chart_selector_timezone_aware():
    """
    Verifies that timezone-aware timestamps are recognized as temporal.
    """
    columns = ["timestamp", "sales"]
    rows = [
        {"timestamp": "2026-07-01T12:00:00+02:00", "sales": 100},
        {"timestamp": "2026-07-02T12:00:00+02:00", "sales": 120}
    ]
    config = select_chart_type(columns, rows, "show sales trend")
    assert config.chart_type == "line"
    assert config.x_axis == "timestamp"

def test_chart_selector_unicode_columns():
    """
    Verifies that Unicode characters in column headers and values are processed without errors.
    """
    columns = ["categorie_département", "ventes"]
    rows = [
        {"categorie_département": "Électronique", "ventes": 150},
        {"categorie_département": "Vêtements", "ventes": 250}
    ]
    config = select_chart_type(columns, rows, "ventes par categorie_département")
    assert config.chart_type == "bar"
    assert config.x_axis == "categorie_département"
    assert config.y_axis == "ventes"

def test_chart_selector_mixed_datatypes():
    """
    Verifies that columns containing mixed numeric and string values fall back safely to categorical.
    """
    columns = ["item", "mixed_val"]
    rows = [
        {"item": "Laptop", "mixed_val": 100},
        {"item": "Phone", "mixed_val": "unobtainable"},
        {"item": "Tablet", "mixed_val": 150}
    ]
    config = select_chart_type(columns, rows, "show mixed_val")
    # mixed_val will be classified as categorical because of the string value,
    # so we have item (categorical) and mixed_val (categorical). Default is table fallback.
    assert config.chart_type == "table"



