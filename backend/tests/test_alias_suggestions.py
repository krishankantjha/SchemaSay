from app.core.schema.alias_suggestions import suggest_aliases_from_metadata


def test_suggest_aliases_from_eval_schema():
    metadata = [
        {"table_name": "users", "column_name": "id", "data_type": "INTEGER"},
        {"table_name": "users", "column_name": "email", "data_type": "TEXT"},
        {"table_name": "orders", "column_name": "id", "data_type": "INTEGER"},
        {"table_name": "orders", "column_name": "price", "data_type": "REAL"},
    ]

    suggestions = suggest_aliases_from_metadata(metadata)
    tokens = {(s.alias_type, s.alias_token, s.target_table, s.target_column) for s in suggestions}

    assert ("table", "customer", "users", None) in tokens
    assert ("column", "revenue", "orders", "price") in tokens

    revenue = next(s for s in suggestions if s.alias_token == "revenue")
    assert revenue.reason == "Revenue is connected to your price field."

    customer = next(s for s in suggestions if s.alias_token == "customer")
    assert customer.reason == "Customer is connected to your users table."


def test_suggest_aliases_store_normalized_multi_word_tokens():
    metadata = [
        {"table_name": "orders_data", "column_name": "created_at", "data_type": "TEXT"},
    ]

    suggestions = suggest_aliases_from_metadata(metadata)
    created_date = next(s for s in suggestions if s.alias_token == "created_date")
    order_date = next(s for s in suggestions if s.alias_token == "order_date")

    assert created_date.reason == "Created date is connected to your created at field."
    assert order_date.reason == "Order date is connected to your created at field."


def test_suggest_aliases_skips_existing():
    metadata = [
        {"table_name": "orders", "column_name": "price", "data_type": "REAL"},
    ]
    existing = [{"alias_token": "revenue"}]

    suggestions = suggest_aliases_from_metadata(metadata, existing_aliases=existing)
    assert all(s.alias_token != "revenue" for s in suggestions)
