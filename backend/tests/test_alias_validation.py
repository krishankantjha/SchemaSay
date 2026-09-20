from app.core.schema.alias_validation import normalize_alias_token, validate_alias_token


def test_normalize_alias_token_converts_spaces_and_hyphens():
    assert normalize_alias_token("Created Date") == "created_date"
    assert normalize_alias_token("  order-date  ") == "order_date"
    assert normalize_alias_token("email address") == "email_address"


def test_validate_alias_token_accepts_spaced_input():
    assert validate_alias_token("created date") is None
    assert validate_alias_token("buyer") is None


def test_validate_alias_token_rejects_invalid_characters():
    assert validate_alias_token("rev$enue") is not None
