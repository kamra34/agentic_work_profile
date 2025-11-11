"""
Test script to demonstrate hierarchical structure creation
Run this after authenticating and creating a profile
"""

import requests
import json

BASE_URL = "http://localhost:8000"

# You'll need to update this with your actual token
TOKEN = "your_token_here"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def test_summary_section(profile_id):
    """Test creating a summary section with direct content"""
    print("\n1. Creating Summary Section...")

    section_data = {
        "title": "Professional Summary",
        "section_type": "summary",
        "icon": "👤",
        "content_type": "paragraph",
        "content": "Experienced software engineer with 10+ years in full-stack development, specializing in Python, React, and cloud infrastructure. Led multiple teams to deliver high-impact projects.",
        "order": 0,
        "meta_info": {"source": "manual"}
    }

    response = requests.post(
        f"{BASE_URL}/api/profiles/{profile_id}/sections",
        headers=headers,
        json=section_data
    )

    if response.status_code == 200:
        print("✓ Summary section created successfully")
        return response.json()
    else:
        print(f"✗ Error: {response.status_code} - {response.text}")
        return None


def test_education_section(profile_id):
    """Test creating education section with one-level entries"""
    print("\n2. Creating Education Section...")

    # Create section
    section_data = {
        "title": "Education",
        "section_type": "education",
        "icon": "🎓",
        "content_type": "empty",
        "order": 2,
        "meta_info": {"source": "manual"}
    }

    response = requests.post(
        f"{BASE_URL}/api/profiles/{profile_id}/sections",
        headers=headers,
        json=section_data
    )

    if response.status_code != 200:
        print(f"✗ Error creating section: {response.status_code} - {response.text}")
        return None

    section = response.json()
    section_id = section["id"]
    print(f"✓ Education section created (ID: {section_id})")

    # Add PhD entry with bullet points
    entry_data = {
        "title": "PhD in Computer Science",
        "subtitle": "MIT",
        "start_date": "2015",
        "end_date": "2019",
        "location": "Cambridge, MA",
        "content_type": "bullets",
        "items": [
            {"content": "Thesis: Machine Learning for Code Generation"},
            {"content": "GPA: 4.0/4.0"},
            {"content": "Published 5 papers in top-tier conferences"}
        ],
        "extra_data": {"degree_type": "Doctorate"},
        "meta_info": {"source": "manual"}
    }

    response = requests.post(
        f"{BASE_URL}/api/sections/{section_id}/entries",
        headers=headers,
        json=entry_data
    )

    if response.status_code == 200:
        print("✓ PhD entry created successfully")
    else:
        print(f"✗ Error creating entry: {response.status_code} - {response.text}")

    return section


def test_work_experience_nested(profile_id):
    """Test creating work experience with nested structure (Company -> Roles)"""
    print("\n3. Creating Work Experience Section (Nested)...")

    # Create section
    section_data = {
        "title": "Work Experience",
        "section_type": "work_experience",
        "icon": "💼",
        "content_type": "empty",
        "order": 1,
        "meta_info": {"source": "manual"}
    }

    response = requests.post(
        f"{BASE_URL}/api/profiles/{profile_id}/sections",
        headers=headers,
        json=section_data
    )

    if response.status_code != 200:
        print(f"✗ Error creating section: {response.status_code} - {response.text}")
        return None

    section = response.json()
    section_id = section["id"]
    print(f"✓ Work Experience section created (ID: {section_id})")

    # Add company with nested roles
    entry_data = {
        "title": "Ericsson",
        "subtitle": "Telecommunications",
        "start_date": "2019",
        "end_date": "Present",
        "location": "Stockholm, Sweden",
        "content_type": "empty",
        "extra_data": {
            "company_size": "100,000+",
            "industry": "Telecommunications"
        },
        "meta_info": {"source": "manual"},
        "sub_entries": [
            {
                "title": "Line Manager",
                "start_date": "2020",
                "end_date": "Present",
                "content_type": "bullets",
                "items": [
                    {"content": "Led team of 10 engineers across 3 time zones"},
                    {"content": "Improved deployment pipeline efficiency by 40%"},
                    {"content": "Mentored 5 junior engineers to senior positions"}
                ],
                "meta_info": {"source": "manual"}
            },
            {
                "title": "Senior Data Scientist",
                "start_date": "2019",
                "end_date": "2020",
                "content_type": "bullets",
                "items": [
                    {"content": "Developed ML models for network optimization"},
                    {"content": "Reduced model latency by 60%"},
                    {"content": "Deployed models to production serving 10M+ users"}
                ],
                "meta_info": {"source": "manual"}
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/sections/{section_id}/entries",
        headers=headers,
        json=entry_data
    )

    if response.status_code == 200:
        print("✓ Ericsson entry with nested roles created successfully")
    else:
        print(f"✗ Error creating entry: {response.status_code} - {response.text}")

    return section


def test_work_experience_incremental(profile_id, section_id):
    """Test creating work experience incrementally (Company first, then add roles)"""
    print("\n4. Creating Work Experience Incrementally...")

    # Create company entry first
    company_data = {
        "title": "Google",
        "subtitle": "Technology",
        "start_date": "2016",
        "end_date": "2019",
        "location": "Mountain View, CA",
        "content_type": "empty",
        "extra_data": {
            "company_size": "100,000+",
            "industry": "Technology"
        },
        "meta_info": {"source": "manual"}
    }

    response = requests.post(
        f"{BASE_URL}/api/sections/{section_id}/entries",
        headers=headers,
        json=company_data
    )

    if response.status_code != 200:
        print(f"✗ Error creating company: {response.status_code} - {response.text}")
        return

    company = response.json()
    company_id = company["id"]
    print(f"✓ Google company entry created (ID: {company_id})")

    # Now add role under the company
    role_data = {
        "parent_entry_id": company_id,
        "title": "Software Engineer",
        "start_date": "2016",
        "end_date": "2019",
        "content_type": "bullets",
        "items": [
            {"content": "Built large-scale distributed systems handling 1B+ requests/day"},
            {"content": "Designed and implemented microservices architecture"},
            {"content": "Reduced infrastructure costs by 30%"}
        ],
        "meta_info": {"source": "manual"}
    }

    response = requests.post(
        f"{BASE_URL}/api/sections/{section_id}/entries",
        headers=headers,
        json=role_data
    )

    if response.status_code == 200:
        print("✓ Software Engineer role added under Google")
    else:
        print(f"✗ Error creating role: {response.status_code} - {response.text}")


def test_skills_section(profile_id):
    """Test creating skills section with categorized entries"""
    print("\n5. Creating Skills Section...")

    # Create section
    section_data = {
        "title": "Technical Skills",
        "section_type": "skills",
        "icon": "⚡",
        "content_type": "empty",
        "order": 3,
        "meta_info": {"source": "manual"}
    }

    response = requests.post(
        f"{BASE_URL}/api/profiles/{profile_id}/sections",
        headers=headers,
        json=section_data
    )

    if response.status_code != 200:
        print(f"✗ Error creating section: {response.status_code} - {response.text}")
        return None

    section = response.json()
    section_id = section["id"]
    print(f"✓ Skills section created (ID: {section_id})")

    # Add categorized skills
    categories = [
        {
            "title": "Programming Languages",
            "items": [
                {"content": "Python (Expert)"},
                {"content": "JavaScript/TypeScript (Advanced)"},
                {"content": "Java (Intermediate)"}
            ]
        },
        {
            "title": "Frameworks & Libraries",
            "items": [
                {"content": "React, FastAPI, Django"},
                {"content": "TensorFlow, PyTorch"},
                {"content": "Node.js, Express"}
            ]
        },
        {
            "title": "Tools & Platforms",
            "items": [
                {"content": "AWS, GCP, Docker, Kubernetes"},
                {"content": "PostgreSQL, MongoDB, Redis"},
                {"content": "Git, CI/CD, Terraform"}
            ]
        }
    ]

    for category in categories:
        entry_data = {
            "title": category["title"],
            "content_type": "bullets",
            "items": category["items"],
            "meta_info": {"source": "manual"}
        }

        response = requests.post(
            f"{BASE_URL}/api/sections/{section_id}/entries",
            headers=headers,
            json=entry_data
        )

        if response.status_code == 200:
            print(f"✓ {category['title']} entry created")
        else:
            print(f"✗ Error: {response.status_code} - {response.text}")

    return section


def main():
    """Main test flow"""
    print("=== Hierarchical Structure Test Suite ===")
    print("\nBefore running this script:")
    print("1. Start the backend server")
    print("2. Register/login and get your auth token")
    print("3. Create a profile and get its ID")
    print("4. Update TOKEN variable in this script")
    print("\nPress Enter to continue or Ctrl+C to exit...")
    input()

    profile_id = int(input("Enter your profile ID: "))

    # Run tests
    test_summary_section(profile_id)
    test_education_section(profile_id)
    work_section = test_work_experience_nested(profile_id)

    if work_section:
        test_work_experience_incremental(profile_id, work_section["id"])

    test_skills_section(profile_id)

    print("\n=== Test Complete ===")
    print(f"\nView your profile: GET {BASE_URL}/api/profiles/{profile_id}")


if __name__ == "__main__":
    main()
