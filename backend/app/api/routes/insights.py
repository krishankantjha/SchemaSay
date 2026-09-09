import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.api.routes.auth import get_current_user
from app.models.user import User
from app.utils.rate_limiter import query_limiter
from app.schemas.insights import InsightRequest, InsightResponse, LLMUsageStats
from app.core.ai.insight_summarizer import summarize_query_dataset
from app.core.ai.insight_generator import generate_insight_with_metadata
from app.core.ai.simple_insight import try_simple_insight

logger = logging.getLogger("schemasay.insights")

router = APIRouter(prefix="/insights", tags=["AI Insight Engine"])

@router.post("/generate", response_model=InsightResponse, status_code=status.HTTP_200_OK)
def generate_business_insight(
    payload: InsightRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
) -> InsightResponse:
    """
    Translates a query's tabular result set into a plain language business analyst summary.
    Enforces payload constraints, request rate limits, and tracks usage telemetry (correlation IDs, token/cost stats).
    """
    # Enforce request-scoped rate limiting to protect LLM completions budget
    client_ip = request.client.host if request.client else "unknown"
    if query_limiter.check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many request attempts. Please wait before trying again."
        )

    # Generate a unique request correlation ID for request tracing
    correlation_id = str(uuid.uuid4())

    try:
        simple = try_simple_insight(payload.question, payload.columns, payload.rows)
        if simple is not None:
            stats = LLMUsageStats(
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                estimated_cost_usd=0.0,
                execution_time_ms=0.0,
                provider=None,
                model=None,
            )
            return InsightResponse(
                insight=simple,
                success=True,
                error=None,
                correlation_id=correlation_id,
                usage_stats=stats,
            )

        summary = summarize_query_dataset(payload.columns, payload.rows)
        insight_text, p_tok, c_tok, cost, duration, provider, model = generate_insight_with_metadata(
            payload.question,
            summary
        )

        stats = LLMUsageStats(
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=p_tok + c_tok,
            estimated_cost_usd=cost,
            execution_time_ms=duration,
            provider=provider,
            model=model,
        )

        return InsightResponse(
            insight=insight_text,
            success=True,
            error=None,
            correlation_id=correlation_id,
            usage_stats=stats
        )
    except HTTPException as he:
        raise he
    except RuntimeError as re:
        logger.error(f"[{correlation_id}] Insight Generation runtime failure: {str(re)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI insight service is currently unavailable. Please try again later."
        )
    except Exception as e:
        logger.error(f"[{correlation_id}] Unhandled exception during AI insight generation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI business insight generation encountered a server error."
        )
