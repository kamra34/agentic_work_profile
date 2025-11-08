import os
import json
from openai import OpenAI
from typing import Dict, Any

def get_openai_client():
    """Get OpenAI client instance"""
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def parse_linkedin_with_openai(linkedin_url: str, model: str = "gpt-4o") -> Dict[str, Any]:
    """
    Use OpenAI to extract information from a LinkedIn profile URL.

    Since we cannot directly scrape LinkedIn (requires authentication and violates ToS),
    we ask the user to provide their LinkedIn profile information manually or via copy-paste.
    This function uses OpenAI to structure the provided LinkedIn profile text.
    """

    system_prompt = """You are an expert LinkedIn profile parser. The user will provide their LinkedIn profile URL.

Since you cannot directly access LinkedIn, instruct them that they need to:
1. Go to their LinkedIn profile
2. Copy the entire profile content (About, Experience, Education, Skills, etc.)
3. Paste it here for parsing

Return a JSON object with this structure:
{
    "sections": [
        {
            "title": "Section name (e.g., 'Experience', 'Education', 'Skills')",
            "section_type": "experience|education|skills|summary|other",
            "content": "Brief section description if any",
            "entries": [
                {
                    "title": "Job title or degree",
                    "subtitle": "Company or university",
                    "start_date": "MM/YYYY",
                    "end_date": "MM/YYYY or 'Present'",
                    "location": "City, Country",
                    "description": "Role description",
                    "items": ["Achievement 1", "Achievement 2"]
                }
            ]
        }
    ]
}

Extract ALL information comprehensively. Group related items logically."""

    user_prompt = f"""LinkedIn Profile URL: {linkedin_url}

Please note: I understand you cannot directly access LinkedIn. This is just the URL for reference.
Now, please paste the content from your LinkedIn profile below (About, Experience, Education, Skills, etc.):

[User should paste their LinkedIn profile content here]

For now, return a message instructing the user to provide their LinkedIn profile content."""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        raise Exception(f"Error parsing LinkedIn profile with OpenAI: {str(e)}")


def parse_linkedin_text_with_openai(linkedin_text: str, model: str = "gpt-4o") -> Dict[str, Any]:
    """
    Parse LinkedIn profile content that was copied and pasted by the user.
    """

    system_prompt = """You are an expert LinkedIn profile parser. Extract ALL information from the provided LinkedIn profile text.

Return a JSON object with this exact structure:
{
    "sections": [
        {
            "title": "Section name (e.g., 'Work Experience', 'Education', 'Skills')",
            "section_type": "experience|education|skills|summary|certifications|other",
            "content": "Section summary or description if any",
            "entries": [
                {
                    "title": "Job title, Degree, or main item",
                    "subtitle": "Company, University, or secondary info",
                    "start_date": "MM/YYYY format",
                    "end_date": "MM/YYYY or 'Present'",
                    "location": "City, Country if mentioned",
                    "description": "Overall description",
                    "items": ["Bullet point 1", "Bullet point 2", "Achievement 3"]
                }
            ]
        }
    ]
}

IMPORTANT:
- Extract EVERY detail from the LinkedIn profile
- Map section types correctly: 'experience', 'education', 'skills', 'summary', 'certifications', 'projects', or 'other'
- For Skills sections, each skill can be an item
- Parse dates carefully into MM/YYYY format
- If no structured entries, put content in the items array
- Return valid JSON only"""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract all information from this LinkedIn profile:\n\n{linkedin_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        raise Exception(f"Error parsing LinkedIn text with OpenAI: {str(e)}")
