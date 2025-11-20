import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path

env_path = '.env'
load_dotenv(dotenv_path=env_path)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
client = OpenAI()
system_prompt = """
You are an expert job requirement analyst.
Always respond with valid JSON following the schema I will define.
"""

user_prompt = "How much gold would it take to coat the Statue of Liberty in a 1mm layer?"

response_5 = client.responses.create(
    model="gpt-5.1",
    reasoning={"effort": "medium"},
    input=[
        {
            "role": "system",
            "content": [
                {
                    "type": "input_text",
                    "text": system_prompt
                }
            ]
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": user_prompt
                }
            ]
        }
    ]
)

print("gpt 5.1 thinking Response:")
print(response_5)
print(json.loads(response_5.output_text))

response_4o = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

print("gpt 4o Response:")
print(response_4o)
print(json.loads(response_4o.choices[0].message.content))