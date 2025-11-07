import os
import json
from openai import OpenAI
from typing import Dict, Any

client = None

def initialize_openai_client():
    """Initialize OpenAI client with API key from environment"""
    global client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    client = OpenAI(api_key=api_key)

def parse_cv_with_openai(cv_text: str, model: str = "gpt-4o") -> Dict[str, Any]:
    """
    Parse CV text using OpenAI and extract structured information

    Returns a dictionary with sections, entries, and items
    """
    if client is None:
        initialize_openai_client()

    system_prompt = """You are an expert CV/Resume parser. Extract ALL information from the CV and structure it hierarchically.

Return a JSON object with this exact structure:
{
  "sections": [
    {
      "title": "Section name (e.g., Summary, Professional Summary, About Me)",
      "section_type": "One of: summary, work_experience, education, skills, certifications, projects, languages, awards, publications, volunteer, interests",
      "content": "For simple sections like Summary, put the full text here. For complex sections, leave null.",
      "entries": [
        {
          "title": "Entry title (e.g., Job title, Degree name, Project name)",
          "subtitle": "Organization/Company/Institution name",
          "start_date": "Start date (any format found)",
          "end_date": "End date or 'Present'",
          "location": "Location if mentioned",
          "description": "Brief description if any",
          "metadata": {
            // Any additional fields like degree_type, gpa, technologies, etc.
          },
          "items": [
            "Bullet point 1",
            "Bullet point 2",
            // All achievements, responsibilities, course details, etc.
          ]
        }
      ]
    }
  ]
}

Important guidelines:
- Detect ALL sections automatically (don't limit to predefined types)
- For Summary/Objective/About sections: put content directly in "content", leave "entries" empty
- For Work Experience/Education/Projects: use "entries" array with full details
- For Skills: if categorized (e.g., "Programming: Python, Java"), each category is an entry with skills as items
- Extract ALL dates, locations, company names, technologies mentioned
- Preserve all bullet points and achievements
- If a section doesn't fit predefined types, use the most appropriate or "other"
- Be thorough - don't skip any information"""

    user_prompt = f"""Extract all information from this CV/Resume:\n\n{cv_text}"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1  # Low temperature for consistent extraction
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        raise Exception(f"Error parsing CV with OpenAI: {str(e)}")
