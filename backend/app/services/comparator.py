import os
import json
import urllib.request
import logging
import re
from typing import Dict, List

logger = logging.getLogger("comparator_service")

COMPARISON_SYSTEM_PROMPT = """You are a precise Employment Policy Version Comparison Assistant.

Compare ONLY the two provided employment policy documents.

Do not use external knowledge.
Do not invent changes.
Do not assume that a difference in wording represents a difference in policy unless the meaning actually changes.

Identify:
1. Added provisions
2. Removed provisions
3. Modified provisions
4. Conflicting provisions
5. Important changes affecting employees

Preserve the exact meaning and scope of each policy.

Pay special attention to:
- must
- may
- should
- normally
- will
- subject to approval
- eligibility
- deadlines
- limits
- conditions
- exceptions

For every meaningful change, provide the relevant old and new text and source page/section when available.

If there is not enough information to establish a change, do not guess.

Do not provide legal advice.
Do not make HR or management decisions.

You MUST respond strictly with a valid JSON object matching this exact schema:
{
  "summary": "High level overview summarizing what changed between old and new policies.",
  "added": [
    {
      "description": "Clear explanation of added rule",
      "old_text": null,
      "new_text": "Exact text from new policy",
      "old_page": null,
      "new_page": 2,
      "old_section": null,
      "new_section": "Section Name"
    }
  ],
  "removed": [
    {
      "description": "Clear explanation of removed rule",
      "old_text": "Exact text from old policy",
      "new_text": null,
      "old_page": 3,
      "new_page": null,
      "old_section": "Section Name",
      "new_section": null
    }
  ],
  "modified": [
    {
      "description": "Clear explanation of how the rule changed",
      "old_text": "Text from old policy",
      "new_text": "Text from new policy",
      "old_page": 4,
      "new_page": 5,
      "old_section": "Old Section",
      "new_section": "New Section"
    }
  ],
  "conflicts": [
    {
      "description": "Description of contradictory provisions",
      "old_text": "Conflicting text A",
      "new_text": "Conflicting text B",
      "old_page": 1,
      "new_page": 2,
      "old_section": "Section A",
      "new_section": "Section B"
    }
  ],
  "important_changes": [
    {
      "description": "Key employee impact change",
      "old_text": "Old text snippet",
      "new_text": "New text snippet",
      "old_page": 1,
      "new_page": 2,
      "old_section": "Section A",
      "new_section": "Section B"
    }
  ]
}
"""

def call_llm_comparison_api(old_doc: Dict, new_doc: Dict, api_key: str, model_name: str, api_url: str):
    """
    Calls configured LLM API to generate structured policy comparison.
    """
    old_chunks = old_doc.get("chunks", [])
    new_chunks = new_doc.get("chunks", [])

    old_formatted = "\n\n".join(
        f"[Page: {c.get('page_number') or 'N/A'}, Section: {c.get('section_heading') or 'General'}]\n{c.get('text', '')}"
        for c in old_chunks
    )

    new_formatted = "\n\n".join(
        f"[Page: {c.get('page_number') or 'N/A'}, Section: {c.get('section_heading') or 'General'}]\n{c.get('text', '')}"
        for c in new_chunks
    )

    prompt = f"OLD POLICY DOCUMENT ('{old_doc.get('filename')}'):\n{old_formatted}\n\n====================\n\nNEW POLICY DOCUMENT ('{new_doc.get('filename')}'):\n{new_formatted}"

    endpoint = api_url or "https://api.openai.com/v1/chat/completions"
    model = model_name or "gpt-3.5-turbo"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": COMPARISON_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")

    with urllib.request.urlopen(req, timeout=35) as response:
        res_body = response.read().decode("utf-8")
        res_json = json.loads(res_body)
        content = res_json["choices"][0]["message"]["content"]
        return json.loads(content)


def generate_structured_fallback_comparison(old_doc: Dict, new_doc: Dict) -> Dict:
    """
    Fallback section-by-section diff comparator engine when LLM_API_KEY is unconfigured.
    Compares chunks from Old Policy vs New Policy while attaching page and section metadata.
    """
    old_chunks = old_doc.get("chunks", [])
    new_chunks = new_doc.get("chunks", [])

    old_sec_map = {c.get("section_heading", "General"): c for c in old_chunks}
    new_sec_map = {c.get("section_heading", "General"): c for c in new_chunks}

    added = []
    removed = []
    modified = []
    conflicts = []
    important_changes = []

    # Check for removed or modified sections
    for sec_name, old_c in old_sec_map.items():
        if sec_name not in new_sec_map:
            removed_item = {
                "description": f"Section '{sec_name}' was present in old policy but removed in new policy.",
                "old_text": old_c.get("text", ""),
                "new_text": None,
                "old_page": old_c.get("page_number"),
                "new_page": None,
                "old_section": sec_name,
                "new_section": None
            }
            removed.append(removed_item)
            important_changes.append(removed_item)
        else:
            new_c = new_sec_map[sec_name]
            old_text = old_c.get("text", "").strip()
            new_text = new_c.get("text", "").strip()

            if old_text.lower() != new_text.lower():
                mod_item = {
                    "description": f"Provisions in section '{sec_name}' were updated.",
                    "old_text": old_text,
                    "new_text": new_text,
                    "old_page": old_c.get("page_number"),
                    "new_page": new_c.get("page_number"),
                    "old_section": sec_name,
                    "new_section": sec_name
                }
                modified.append(mod_item)
                if any(k in old_text.lower() or k in new_text.lower() for k in ["must", "may", "days", "leave", "notice", "deadline", "require"]):
                    important_changes.append(mod_item)

    # Check for added sections
    for sec_name, new_c in new_sec_map.items():
        if sec_name not in old_sec_map:
            added_item = {
                "description": f"New section '{sec_name}' added to policy.",
                "old_text": None,
                "new_text": new_c.get("text", ""),
                "old_page": None,
                "new_page": new_c.get("page_number"),
                "old_section": None,
                "new_section": sec_name
            }
            added.append(added_item)
            important_changes.append(added_item)

    # Fallback summary narrative
    summary_text = (
        f"Compared '{old_doc.get('filename')}' against '{new_doc.get('filename')}'. "
        f"Found {len(added)} added provisions, {len(removed)} removed provisions, and {len(modified)} modified provisions."
    )

    return {
        "summary": summary_text,
        "added": added,
        "removed": removed,
        "modified": modified,
        "conflicts": conflicts,
        "important_changes": important_changes[:6]
    }


def compare_policy_documents(old_doc: Dict, new_doc: Dict) -> Dict:
    """
    Main entry point for policy version comparison.
    Attempts LLM API call if LLM_API_KEY is configured; otherwise uses grounded fallback engine.
    """
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model_name = os.getenv("LLM_MODEL_NAME", "gpt-3.5-turbo").strip()
    api_url = os.getenv("LLM_API_URL", "").strip()

    if api_key and api_key != "your_llm_api_key_here":
        try:
            return call_llm_comparison_api(old_doc, new_doc, api_key, model_name, api_url)
        except Exception as err:
            logger.warning(f"LLM comparison API call failed: {str(err)}. Using grounded fallback comparator.")
            return generate_structured_fallback_comparison(old_doc, new_doc)
    else:
        logger.info("LLM_API_KEY unconfigured. Using grounded fallback comparator engine.")
        return generate_structured_fallback_comparison(old_doc, new_doc)
