import re
import math
import logging
from typing import List, Dict, Any, Optional, Tuple

from app.core.ai.llm_client import complete_chat_with_fallback, get_llm_client, list_llm_clients
from app.core.ai.insight_summarizer import summarize_query_dataset
from app.core.ai.insight_prompt import build_insight_prompts

logger = logging.getLogger("schemasay.insights")

def validate_llm_insight(insight: str, data_summary: str) -> Tuple[bool, str]:
    """
    Validates LLM-generated insight. Checks for:
    - Maximum 2-3 sentences.
    - Model refusal keywords.
    - Leaked raw SQL syntax blocks.
    - Factual grounding (ensuring all numbers exist in the data summary).
    """
    cleaned_insight = insight.strip().lower()

    # 1. Refusal pattern check
    refusal_keywords = {
        "as an ai assistant", "i cannot assist", "i am unable to", 
        "system prompt", "ignore previous", "sorry, but", "unsupported query",
        "internal instructions", "i do not have access"
    }
    if any(keyword in cleaned_insight for keyword in refusal_keywords):
        return False, "AI analysis request returned a model refusal block."

    # 2. SQL keyword leakage check
    sql_keywords = {"select ", "insert ", "update ", "delete ", "from ", "where ", "join "}
    if any(kw in cleaned_insight for kw in sql_keywords) and ("sql" in cleaned_insight or ";" in cleaned_insight):
        return False, "AI analysis output contained raw SQL code blocks."

    # 3. Sentence count validation (keep answers short)
    sentences = [s for s in re.split(r'[.!?]+', insight.strip()) if s.strip()]
    if not (1 <= len(sentences) <= 2):
        return False, f"AI analysis output structure invalid: expected 1-2 sentences, got {len(sentences)}."

    # 4. Factual grounding / Hallucination check
    # Find all numerical representations in the insight (e.g. integers and decimals)
    numbers = re.findall(r'\b\d+(?:,\d+)*(?:\.\d+)?\b', insight)
    clean_summary = data_summary.replace(',', '')
    for num in numbers:
        clean_num = num.replace(',', '')
        # Allow single digits like 1, 2, 3 (often sentence enumerations) but check larger numbers
        if len(clean_num) > 1 and clean_num not in clean_summary:
            return False, f"AI analysis hallucination check failed: number {num} is not present in data summary."

    return True, ""


def _normalize_insight_text(insight: str) -> str:
    """Drop preamble/checklist lines and keep at most 3 sentences."""
    lines = []
    for line in insight.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        lowered = stripped.lower()
        if lowered.startswith("check rules") or lowered.startswith("system rules"):
            continue
        if lowered.startswith(("concise?", "business language?", "sql", "heading")):
            continue
        lines.append(stripped)
    cleaned = " ".join(lines).strip()
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", cleaned) if part.strip()]
    if len(sentences) > 2:
        cleaned = " ".join(sentences[:2])
        if not cleaned.endswith((".", "!", "?")):
            cleaned += "."
    return cleaned


def generate_insight_with_metadata(
    question: str, data_summary: str
) -> Tuple[str, int, int, float, float, Optional[str], Optional[str]]:
    """
    Generates business insights, validates outputs, and returns metadata stats.
    Returns: (insight_text, prompt_tokens, completion_tokens, cost_usd, duration_ms, provider, model)
    """
    if not list_llm_clients():
        return (
            "AI analysis is offline. Raw and visual representations of the query result are loaded.",
            0, 0, 0.0, 0.0, None, None
        )

    # Construct clean prompts separating instructions from sanitized inputs
    system_prompt, user_prompt = build_insight_prompts(question, data_summary)

    try:
        completion = complete_chat_with_fallback(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            timeout=15.0,
            max_tokens=300,
        )

        is_valid, validation_err = validate_llm_insight(completion.content, data_summary)
        content = completion.content
        if not is_valid:
            normalized = _normalize_insight_text(completion.content)
            is_valid, validation_err = validate_llm_insight(normalized, data_summary)
            if is_valid:
                content = normalized

        if not is_valid:
            logger.warning(
                f"AI output validation rejected model response: {validation_err}. Content: {completion.content}"
            )
            fallback_message = (
                "Data results are loaded successfully. Review the visual charts and summary metrics above."
            )
            return (
                fallback_message,
                completion.prompt_tokens,
                completion.completion_tokens,
                completion.cost_usd,
                completion.duration_ms,
                completion.provider,
                completion.model,
            )

        return (
            content,
            completion.prompt_tokens,
            completion.completion_tokens,
            completion.cost_usd,
            completion.duration_ms,
            completion.provider,
            completion.model,
        )
    except Exception as e:
        logger.error(f"Failed to generate AI insight narrative: {str(e)}", exc_info=True)
        raise RuntimeError("AI analysis compilation encountered a service error.")

def generate_insight(question: str, sql_query: str, data_summary: str) -> str:
    """
    Public convenience wrapper that returns only the insight text.
    Delegates to generate_insight_with_metadata() and discards token usage stats.
    """
    insight, *_ = generate_insight_with_metadata(question, data_summary)
    return insight

def summarize_data(columns: List[str], rows: List[Dict[str, Any]]) -> str:
    """
    Public convenience wrapper for generating a statistical summary of query results.
    Delegates to summarize_query_dataset().
    """
    return summarize_query_dataset(columns, rows)
