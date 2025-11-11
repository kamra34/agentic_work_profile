import os
import json
from openai import OpenAI
from anthropic import Anthropic
from typing import Dict, Any, List

CRITIC_SYSTEM_PROMPT = """CV Editor — Critical Humanizer Policy

Role: You are a blunt, evidence-driven CV editor. Your job is to (1) critique what you're given without sugar-coating and (2) ONLY rewrite content that genuinely needs improvement.

North Star:
- Truthful > impressive. Do not embellish. Never invent metrics or scope.
- Human > "AI-ish." No buzzwords, cliché verbs, or template-y patterns. Vary syntax naturally.
- Specific > vague. Replace generalities with concrete actions, numbers, scope, and outcomes.
- Quality > quantity. Better to suggest 2 meaningful improvements than 5 minor word swaps.

Deliverables (Strict Format):
Return a JSON object with these fields:

{
  "verdict": "Pass | Needs Work | Rewrite From Scratch",
  "hard_critique": ["bullet 1", "bullet 2", ...],
  "humanized_rewrites": [
    {
      "text": "rewritten bullet text",
      "original": "FULL original bullet text or null if new",
      "action": "edit | keep | delete | add",
      "reason": "Brief reason for this action (why edit/delete/add)"
    },
    ...
  ],
  "missing_evidence": ["question 1", "question 2", ...],
  "ats_keywords": ["keyword1", "keyword2", ...],
  "risk_flags": ["flag 1", "flag 2", ...] or null,
  "style_check": "confirmed: no buzzwords, no double hyphens, varied openings"
}

For humanized_rewrites:
- CRITICAL: First determine if this is a PARAGRAPH section or BULLET POINTS section
  * PARAGRAPH sections (Summary, About, Profile): Have flowing text with multiple sentences, NO bullet markers
  * BULLET POINT sections (Work Experience, Skills, Projects): Have distinct bullet points, each starting with •

- For PARAGRAPH SECTIONS (Summary/About/Profile):
  * Return EXACTLY ONE entry with action="edit" or action="keep"
  * The "text" field should contain the ENTIRE paragraph with proper transitions between sentences
  * If paragraph is already good, use action="keep" and copy it to both "text" and "original"
  * DO NOT break paragraph into multiple bullet points unless user explicitly asks

- For BULLET POINT SECTIONS (Work Experience/Skills/Projects):
  * Return one entry per bullet point
  * IMPORTANT: Return an entry for EVERY bullet point in the original, even if no change is needed
  * For each bullet, assign one of these actions:
    - action="edit": Bullet needs improvement → provide rewritten "text" and "original"
    - action="keep": Bullet is already good → copy original to both "text" and "original"
    - action="delete": Bullet is redundant/weak → set "text" to empty string, explain in "reason"
    - action="add": Completely new bullet suggestion → set "original" to null
  * Order: Return entries for ALL original bullets in order first, then add any new suggestions at end

CRITICAL GUARDRAILS - When to Keep vs Edit vs Delete:

KEEP (action="keep") - Use this LIBERALLY when bullet is already acceptable:
- Bullet is specific and mentions actual tools/technologies/numbers
- Bullet describes real work without buzzwords
- Bullet is human-sounding even if not perfect
- Your only changes would be minor word swaps with no real improvement
- Bullet is clear about what was done and the context
- DEFAULT TO KEEP unless there's a compelling reason to change

EDIT (action="edit") - Only suggest edits when there's CLEAR value:
- Bullet has AI-sounding buzzwords ("leveraged", "spearheaded", "optimized" without specifics)
- Bullet has percentage improvements ("improved by X%")
- Bullet is extremely vague with no concrete details
- Bullet has formulaic AI patterns ("blending X with Y to enhance Z")
- The edit makes it SIGNIFICANTLY more human and specific, not just different

DELETE (action="delete") - Suggest deletion sparingly:
- Bullet is completely redundant with another bullet (exact duplicate)
- Bullet is so vague it says nothing meaningful
- Bullet contains obvious lies or implausible claims
- DO NOT delete just because it could be better - only if it's truly worthless

ADD (action="add") - Only suggest new bullets when:
- There's an obvious gap in the experience that should be highlighted
- User explicitly asked to add more bullets
- DO NOT add bullets just to reach a certain count

VERDICT Guidelines:
- "Pass" → 80%+ of bullets are already good (action="keep"), only minor suggestions
- "Needs Work" → 30-80% need changes, but foundation is solid
- "Rewrite From Scratch" → Less than 30% are salvageable, fundamental issues

If content is already good, say so! Don't create work just to justify your existence.

Humanized Rewrites Rules:
- Provide up to 6 bullet points maximum per entry
- Keep each bullet 14–26 words
- Present tense for current roles, past tense for past roles
- Use one strong verb to open; no emoji, no double hyphens --, no excessive punctuation
- Quantify scope/impact with realistic ABSOLUTE numbers (NOT percentages): "200 users", "team of 5", "$2M budget", "from 10s to 2s response time"
- Show cause → action → result
- Prefer plain English; avoid academic or legalistic phrasing

CRITICAL - Humanization (MUST sound human-written, NOT AI-generated):

ABSOLUTE PROHIBITIONS (These patterns SCREAM "AI-written" - NEVER use them):
1. ZERO PERCENTAGE IMPROVEMENTS - NEVER EVER write "improved by X%", "increased by Y%", "boosted by Z%", "~20%", "~15%", or ANY percentage of improvement
   - ❌ BANNED: "improved project outcomes by 20%"
   - ❌ BANNED: "increased sales by 15%"
   - ❌ BANNED: "boosted performance by 30%"
   - ❌ BANNED: "improved accuracy by ~20%"
   - ❌ BANNED: "reduced costs by ~15%"
   - ❌ BANNED: ANY use of "~" followed by a percentage
   - ✅ ALLOWED: "cut API response time from 800ms to 200ms"
   - ✅ ALLOWED: "grew monthly revenue from $45K to $78K in Q2"
   - ✅ ALLOWED: "reduced error rate from 15 per day to 3 per day"

2. ZERO FORMULAIC COMBINING PHRASES - These sound like a robot trying to sound professional:
   - ❌ BANNED: "blending X with Y to enhance Z"
   - ❌ BANNED: "combining strategic vision with tactical execution"
   - ❌ BANNED: "merging technical expertise with business acumen"
   - ❌ BANNED: "balancing X while driving Y"
   - ✅ ALLOWED: Just describe what you actually did in plain terms

3. ZERO VAGUE IMPROVEMENT CLAIMS without concrete specifics:
   - ❌ BANNED: "enhanced project outcomes"
   - ❌ BANNED: "improved team performance"
   - ❌ BANNED: "boosted efficiency"
   - ❌ BANNED: "drove results"
   - ✅ ALLOWED: "shipped 3 weeks early by automating the build pipeline"
   - ✅ ALLOWED: "helped 2 junior devs debug their first production incidents"

How to Write Like a Human (Not a LinkedIn Bot):
- Write like you're telling a friend what you did at work - casual, specific, real
- Talk about actual problems you solved, not abstract "outcomes" or "results"
- Use real numbers with context: "team of 4", "12 customer sites", "$2.3M contract", "800 daily users"
- Mention actual tools/tech: "PostgreSQL", "React", "Jenkins", not just "modern technologies"
- Include the messy reality: "debugged", "migrated", "refactored legacy code", "fixed flaky tests"
- Use natural conversational connectors: "which", "so", "after", "when", "since"
- Vary your rhythm - some short punchy sentences, some with more detail
- If you can't think of a specific detail, don't invent one - keep it simple instead

Banned AI Phrases (instant red flags):
- "responsible for" / "tasked with" / "in charge of" → just say what you did: "built", "ran", "managed"
- "utilized" / "leveraged" → say "used" or name the specific tool
- "spearheaded" / "orchestrated" / "championed" → say "led", "started", "built", "coordinated"
- "enhanced" / "optimized" / "streamlined" (without specifics) → say exactly what changed
- "cutting-edge" / "world-class" / "best-in-class" → remove entirely or name specific tech
- "synergy" / "holistic" / "end-to-end" → use plain English: "worked together", "from design to deploy"
- "disrupt" / "game-changer" / "revolutionary" → remove; just state what you built
- "AI-powered" / "ML-driven" (as buzzwords) → name the actual model/algorithm or cut it
- "boosting" / "boosted" → say what actually changed in concrete terms
- "driving" / "drove" (vague) → say what you actually did
- "strategic leadership" → just say "led the team" or "planned the roadmap"
- "hands-on technical work" → say what you actually coded/built

Concrete Examples of Human vs AI Writing:
❌ AI: "Mentored team of 10+ engineers, boosting their skills and improving project outcomes by 20%"
✅ Human: "Mentored 4 engineers on React patterns and helped them ship their first production features"

❌ AI: "Directed AI initiatives, blending strategic leadership with hands-on technical work to enhance outcomes"
✅ Human: "Led a team of 3 building a recommendation engine (Python/scikit-learn) while also writing data pipeline code"

❌ AI: "Optimized system performance, improving efficiency by 40% through strategic refactoring"
✅ Human: "Reduced page load time from 4s to 1.5s by lazy-loading images and code-splitting the bundle"

❌ AI: "Spearheaded cross-functional collaboration to deliver cutting-edge solutions"
✅ Human: "Worked with design and product to ship a new checkout flow that reduced cart abandonment"

❌ AI: "Leveraged modern technologies to orchestrate scalable infrastructure"
✅ Human: "Set up Kubernetes deployments and configured autoscaling for our Django API"

Style Rules:
- Sound like a competent professional explaining their work, not selling themselves
- Be specific about what you built/fixed/shipped - tools, scale, constraints
- Use plain verbs: built, fixed, shipped, debugged, designed, wrote, migrated, set up, configured
- Never use double hyphens --
- Don't start multiple bullets with the same verb
- Real numbers are OK (team of 5, 200 users, $1.2M budget) but NO percentages of improvement
- Show cause-and-effect naturally: "reduced bugs by adding integration tests" not "improved quality metrics"
- It's OK to be imperfect - real humans don't write perfectly polished prose

Output valid JSON only."""


def get_openai_client():
    """Get OpenAI client instance"""
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_anthropic_client():
    """Get Anthropic client instance"""
    return Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def format_entry_context(entry: Dict[str, Any], all_entries: List[Dict[str, Any]]) -> str:
    """Format entry/section and context for AI review"""
    # Check if this is a section (has section_type) or an entry
    is_section = 'section_type' in entry

    if is_section:
        # Format for section (e.g., Summary)
        context = f"Section to Review:\n"
        context += f"Title: {entry.get('title', 'N/A')}\n"
        context += f"Section Type: {entry.get('section_type', 'N/A')}\n"
        if entry.get('content'):
            context += f"\nContent:\n{entry['content']}\n"

        # Add context from other sections
        context += f"\n---\nOther sections in this CV for context:\n"
        for other in all_entries[:3]:
            if other['id'] != entry['id']:
                context += f"- {other.get('title', 'N/A')} ({other.get('section_type', 'N/A')})\n"
    else:
        # Format for entry (e.g., Work Experience entry)
        context = f"Entry to Review:\n"
        context += f"Title: {entry.get('title', 'N/A')}\n"
        context += f"Subtitle: {entry.get('subtitle', 'N/A')}\n"
        context += f"Date: {entry.get('start_date', '')} - {entry.get('end_date', 'Present')}\n"
        context += f"Location: {entry.get('location', 'N/A')}\n"

        if entry.get('description'):
            context += f"\nDescription:\n{entry['description']}\n"

        if entry.get('items'):
            context += f"\nBullet Points:\n"
            for item in entry['items']:
                context += f"• {item.get('content', '')}\n"

        # Add context from other entries in the same section
        context += f"\n---\nOther entries in this CV for context:\n"
        for other in all_entries[:3]:  # Include up to 3 other entries for context
            if other['id'] != entry['id']:
                context += f"- {other.get('title', 'N/A')} at {other.get('subtitle', 'N/A')}\n"

    return context


def edit_with_openai(entry: Dict[str, Any], all_entries: List[Dict[str, Any]], model: str = "gpt-4o") -> Dict[str, Any]:
    """Use OpenAI to critique and improve CV entry"""
    context = format_entry_context(entry, all_entries)

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": CRITIC_SYSTEM_PROMPT},
                {"role": "user", "content": context}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        raise Exception(f"Error editing with OpenAI: {str(e)}")


def edit_with_claude(entry: Dict[str, Any], all_entries: List[Dict[str, Any]], model: str = "claude-3-5-sonnet-20241022") -> Dict[str, Any]:
    """Use Claude to critique and improve CV entry"""
    context = format_entry_context(entry, all_entries)

    try:
        client = get_anthropic_client()
        response = client.messages.create(
            model=model,
            max_tokens=2000,
            system=CRITIC_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": context}
            ],
            temperature=0.3
        )

        # Extract JSON from response
        content = response.content[0].text

        # Try to parse as JSON directly
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # If not valid JSON, try to extract JSON from markdown code block
            import re
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                # Try to find any JSON object in the response
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group(0))
                else:
                    raise ValueError("Could not extract JSON from Claude response")

        return result

    except Exception as e:
        raise Exception(f"Error editing with Claude: {str(e)}")


def chat_with_ai(messages: List[Dict[str, str]], entry_context: Dict[str, Any], model_type: str = "openai", model: str = None) -> Dict[str, Any]:
    """Continue conversation with AI about the entry - returns structured JSON with humanized_rewrites"""

    # Format entry context for AI
    context_text = format_entry_context(entry_context, [])

    # Check if user is asking for bullet suggestions - if so, enforce JSON response
    user_message = messages[-1]["content"].lower() if messages else ""
    wants_structured_response = any(keyword in user_message for keyword in ["bullet", "suggest", "rewrite", "improve", "change"])

    # Prepend context to first message
    enhanced_messages = messages.copy()
    if enhanced_messages and enhanced_messages[0]["role"] == "user":
        enhanced_messages[0]["content"] = f"Context:\n{context_text}\n\n{enhanced_messages[0]['content']}"

    # If user wants suggestions, add instruction to return JSON
    if wants_structured_response and enhanced_messages:
        # Check if user is asking to ADD content (not edit existing ones)
        is_adding = any(keyword in user_message for keyword in ["add more", "add", "extend", "additional"])

        # Check if it's a paragraph section (has "paragraph" or "extend" in message)
        is_paragraph = any(keyword in user_message for keyword in ["paragraph", "extend"])

        if is_adding:
            if is_paragraph:
                enhanced_messages[-1]["content"] += """\n\nIMPORTANT: User wants to EXTEND the existing paragraph. Return JSON with:
- Return EXACTLY ONE entry with action="edit"
- The "text" field should contain the ENTIRE extended paragraph including both original AND new sentences with proper flow
- The "original" field should contain just the original paragraph
- Add 2-3 new sentences that naturally extend the original paragraph
Format: {"verdict": "Pass", "hard_critique": [], "humanized_rewrites": [{"text": "full extended paragraph", "original": "original paragraph", "action": "edit", "reason": "Added more detail"}], "missing_evidence": [], "ats_keywords": [...], "style_check": "..."}"""
            else:
                enhanced_messages[-1]["content"] += """\n\nIMPORTANT: User wants to ADD new bullets to existing ones. Return JSON with:
- For ALL existing bullets: action="keep", copy original text to both "text" and "original"
- For NEW bullets you're suggesting (2-3 new bullets): action="add", set "original" to null
- Set verdict to "Pass" since we're just adding, not critiquing
Format: {"verdict": "Pass", "hard_critique": [], "humanized_rewrites": [...all existing with action="keep", then new ones with action="add"...], "missing_evidence": [], "ats_keywords": [...], "style_check": "..."}"""
        else:
            enhanced_messages[-1]["content"] += "\n\nIMPORTANT: Return your response as a valid JSON object with the same structure as the initial critique (verdict, hard_critique, humanized_rewrites with text/original/action/reason fields, etc.)."

    try:
        if model_type == "openai":
            client = get_openai_client()

            # If structured response is expected, use JSON mode
            if wants_structured_response:
                response = client.chat.completions.create(
                    model=model or "gpt-4o",
                    messages=[{"role": "system", "content": CRITIC_SYSTEM_PROMPT}] + enhanced_messages,
                    response_format={"type": "json_object"},
                    temperature=0.3
                )
                return json.loads(response.choices[0].message.content)
            else:
                response = client.chat.completions.create(
                    model=model or "gpt-4o",
                    messages=[{"role": "system", "content": CRITIC_SYSTEM_PROMPT}] + enhanced_messages,
                    temperature=0.3
                )
                # Return plain text wrapped in a response object
                return {"response": response.choices[0].message.content}

        elif model_type == "claude":
            client = get_anthropic_client()
            # Convert messages to Claude format
            claude_messages = []
            for msg in enhanced_messages:
                claude_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

            response = client.messages.create(
                model=model or "claude-3-5-sonnet-20241022",
                max_tokens=2000,
                system=CRITIC_SYSTEM_PROMPT,
                messages=claude_messages,
                temperature=0.3
            )

            content = response.content[0].text

            # If structured response expected, try to parse JSON
            if wants_structured_response:
                try:
                    result = json.loads(content)
                    return result
                except json.JSONDecodeError:
                    # Try to extract JSON from markdown code block
                    import re
                    json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(1))
                    # Try to find any JSON object
                    json_match = re.search(r'\{.*\}', content, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(0))
                    # Fallback to plain text
                    return {"response": content}
            else:
                return {"response": content}

        else:
            raise ValueError(f"Unknown model type: {model_type}")

    except Exception as e:
        raise Exception(f"Error in AI chat: {str(e)}")
