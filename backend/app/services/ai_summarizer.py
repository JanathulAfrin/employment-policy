import os
import json
import urllib.request
import urllib.error
import logging
import re

logger = logging.getLogger("ai_summarizer")

SYSTEM_PROMPT = """You are a precise and trustworthy Employment Policy Summarization Assistant.

Your task is to interpret formal employment policy documents accurately and explain them in simple, employee-friendly language.

Summarize only information explicitly contained in the provided policy. Do not add external knowledge, assumptions, interpretations, or invented rules.

Identify:
- Policy overview
- Who the policy applies to
- Key rules and requirements
- Eligibility and conditions
- Employee responsibilities
- Exceptions
- Important dates, deadlines, and limits
- Required actions
- Important prohibitions or restrictions

Preserve the original meaning and scope of the policy. Preserve modal terms such as must, may, normally, should, will, and subject to approval.

If information is ambiguous, incomplete, contradictory, or outdated, clearly flag it.

Do not provide legal advice or make HR/management decisions.

When information is missing, do not guess.

You MUST respond strictly with a valid JSON object following this exact schema:
{
  "policy_overview": "A brief, clear overview of the policy purpose and scope.",
  "applies_to": "Clear explanation of which employees, roles, or departments this policy applies to.",
  "key_rules": [
    {"text": "Key rule statement", "page": 1, "section": "Section Heading"}
  ],
  "eligibility_conditions": [
    {"text": "Eligibility requirement or condition", "page": 1, "section": "Section Heading"}
  ],
  "employee_responsibilities": [
    {"text": "Employee responsibility or obligation", "page": 1, "section": "Section Heading"}
  ],
  "exceptions": [
    {"text": "Explicit exception or clause", "page": 1, "section": "Section Heading"}
  ],
  "important_dates_limits": [
    {"text": "Specific deadline, timeline, or quantitative limit", "page": 1, "section": "Section Heading"}
  ],
  "required_actions": [
    {"text": "Required step or procedure to follow", "page": 1, "section": "Section Heading"}
  ],
  "restrictions": [
    {"text": "Prohibition or restriction", "page": 1, "section": "Section Heading"}
  ],
  "warnings": [
    {"text": "Flagged ambiguity, missing information, or contradiction", "page": null, "section": null}
  ]
}
"""

def generate_llm_summary_api(prompt_text: str, api_key: str, model_name: str, api_url: str):
    """
    Calls configured LLM API (OpenAI / Gemini / OpenRouter format) via HTTP.
    """
    # Standard OpenAI / OpenRouter chat completions endpoint fallback if default
    endpoint = api_url or "https://api.openai.com/v1/chat/completions"
    model = model_name or "gpt-3.5-turbo"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Please summarize the following employment policy document text:\n\n{prompt_text}"}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")

    with urllib.request.urlopen(req, timeout=30) as response:
        res_body = response.read().decode("utf-8")
        res_json = json.loads(res_body)
        content = res_json["choices"][0]["message"]["content"]
        return json.loads(content)


def generate_structured_fallback_summary(doc: dict):
    """
    Fallback structured summarization engine when LLM_API_KEY is unconfigured or unavailable.
    Parses document chunks and metadata to extract grounded sections with exact page and section citations.
    """
    chunks = doc.get("chunks", [])
    extracted = doc.get("extracted_data", [])
    file_type = doc.get("file_type", "pdf")
    filename = doc.get("filename", "Policy Document")

    # Group text snippets by section/page
    overview_text = ""
    applies_to_text = ""
    key_rules = []
    eligibility_conditions = []
    employee_responsibilities = []
    exceptions = []
    important_dates_limits = []
    required_actions = []
    restrictions = []
    warnings = []

    if chunks:
        overview_text = f"This document represents the formal '{filename}' employment policy containing {len(chunks)} structural sections/chunks."
        
        for idx, c in enumerate(chunks):
            txt = c.get("text", "").strip()
            page = c.get("page_number")
            sec = c.get("section_heading", "General")

            if not txt:
                continue

            txt_lower = txt.lower()

            # Categorize snippets based on grounded keywords while preserving page/section citations
            citation_item = {"text": txt[:250] + ("..." if len(txt) > 250 else ""), "page": page, "section": sec}

            if any(k in txt_lower for k in ["applies", "eligible", "employee", "staff", "scope", "all personnel"]):
                if not applies_to_text:
                    applies_to_text = f"Applies to personnel covered under {sec}."
                if "must" in txt_lower or "shall" in txt_lower:
                    key_rules.append(citation_item)
                elif "eligible" in txt_lower or "qualification" in txt_lower:
                    eligibility_conditions.append(citation_item)
                else:
                    employee_responsibilities.append(citation_item)

            elif any(k in txt_lower for k in ["must", "shall", "required", "mandatory", "policy"]):
                key_rules.append(citation_item)

            elif any(k in txt_lower for k in ["except", "unless", "exemption", "subject to approval", "discretion"]):
                exceptions.append(citation_item)

            elif any(k in txt_lower for k in ["day", "days", "month", "year", "annual", "limit", "hours", "deadline", "notice"]):
                important_dates_limits.append(citation_item)

            elif any(k in txt_lower for k in ["submit", "request", "notify", "form", "approval", "procedure"]):
                required_actions.append(citation_item)

            elif any(k in txt_lower for k in ["prohibit", "not allowed", "forbidden", "ban", "penalty", "violation"]):
                restrictions.append(citation_item)

            else:
                if len(key_rules) < 3:
                    key_rules.append(citation_item)
                else:
                    employee_responsibilities.append(citation_item)

    if not applies_to_text:
        applies_to_text = f"Applies to all employees covered by the '{filename}' workplace policy guidelines."

    if not key_rules and chunks:
        first_chunk = chunks[0]
        key_rules.append({
            "text": first_chunk.get("text", "")[:200],
            "page": first_chunk.get("page_number"),
            "section": first_chunk.get("section_heading", "General")
        })

    return {
        "policy_overview": overview_text or f"Formal employment policy document: {filename}.",
        "applies_to": applies_to_text,
        "key_rules": key_rules[:6],
        "eligibility_conditions": eligibility_conditions[:5],
        "employee_responsibilities": employee_responsibilities[:5],
        "exceptions": exceptions[:4],
        "important_dates_limits": important_dates_limits[:5],
        "required_actions": required_actions[:5],
        "restrictions": restrictions[:5],
        "warnings": warnings if warnings else [{
            "text": "Note: LLM_API_KEY environment variable is not configured. Displaying grounded document extraction summary.",
            "page": None,
            "section": None
        }]
    }


def summarize_policy_document(doc: dict):
    """
    Main entry point for generating structured policy summary.
    Attempts LLM API call if LLM_API_KEY is configured; otherwise uses grounded structured fallback engine.
    """
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model_name = os.getenv("LLM_MODEL_NAME", "gpt-3.5-turbo").strip()
    api_url = os.getenv("LLM_API_URL", "").strip()

    # Compile document text with page/section markers for context
    chunks = doc.get("chunks", [])
    prompt_snippets = []
    
    for c in chunks:
        loc = []
        if c.get("page_number"):
            loc.append(f"Page {c['page_number']}")
        if c.get("section_heading"):
            loc.append(f"Section: {c['section_heading']}")
        loc_str = f" [{', '.join(loc)}]" if loc else ""
        prompt_snippets.append(f"{c.get('text', '')}{loc_str}")

    combined_text = "\n\n".join(prompt_snippets)

    if api_key and api_key != "your_llm_api_key_here":
        try:
            return generate_llm_summary_api(combined_text, api_key, model_name, api_url)
        except Exception as err:
            logger.warning(f"LLM API call failed: {str(err)}. Falling back to grounded structured extraction.")
            return generate_structured_fallback_summary(doc)
    else:
        logger.info("LLM_API_KEY not set. Using grounded structured fallback summarization engine.")
        return generate_structured_fallback_summary(doc)
