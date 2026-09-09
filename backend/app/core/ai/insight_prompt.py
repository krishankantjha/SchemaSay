from typing import Tuple
from app.core.ai.query_generator import sanitize_prompt_input

def build_insight_prompts(question: str, data_summary: str) -> Tuple[str, str]:
    """
    Constructs a structured prompt configuration separating instructions from content.
    Removes unnecessary SQL statements from prompt contexts to optimize token cost.
    """
    # Sanitize user inputs to mitigate injection overrides
    sanitized_question = sanitize_prompt_input(question)
    sanitized_summary = sanitize_prompt_input(data_summary)

    system_prompt = (
        "You explain data query results in very simple, everyday English — like talking to a "
        "non-technical colleague.\n"
        "Write 1 or 2 short sentences. Lead with the direct answer to the question. "
        "Use only numbers from the summary. No jargon, SQL, model names, or bullet lists."
    )

    user_prompt = (
        "Question:\n"
        f"{sanitized_question}\n\n"
        "Results summary:\n"
        f"{sanitized_summary}\n\n"
        "Plain answer:"
    )

    return system_prompt, user_prompt
