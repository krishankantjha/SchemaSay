from fastapi import HTTPException, status


def raise_query_error(error_message: str, *, include_safety_errors: bool = False) -> None:
    """Translate bounded query failures into the public API's HTTP semantics."""
    message = error_message or "The query could not be completed."
    lowered = message.lower()

    if include_safety_errors and ("access denied" in lowered or "sql syntax error" in lowered):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    if "timeout" in lowered or "cancelled" in lowered:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail=message)
    if lowered.startswith("database error:") or "syntax error" in lowered:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=message)
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)
