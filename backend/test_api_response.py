import requests
import json

# Test the API endpoint directly
API_URL = "http://127.0.0.1:8000"

# Login first (assuming you have a test user)
login_response = requests.post(f"{API_URL}/api/login", json={
    "email": "test@example.com",
    "password": "test123"
})

if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    print("✓ Login successful")
    
    # Test job analysis
    job_desc = "Looking for a senior software engineer with Python experience"
    
    job_response = requests.post(
        f"{API_URL}/api/job/analyze",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"job_description": job_desc}
    )
    
    if job_response.status_code == 200:
        job_data = job_response.json()
        print("✓ Job analysis successful")
        
        # Get first successful analysis
        first_analysis = next((a for a in job_data["analyses"] if a.get("analysis") and not a.get("error")), None)
        
        if first_analysis:
            # Test profile fit
            fit_response = requests.post(
                f"{API_URL}/api/job/analyze-fit",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"job_analysis": first_analysis["analysis"]}
            )
            
            if fit_response.status_code == 200:
                fit_data = fit_response.json()
                print("✓ Profile fit analysis successful")
                print(f"\nResponse keys: {list(fit_data.keys())}")
                print(f"Has 'input_data': {'input_data' in fit_data}")
                
                if 'input_data' in fit_data:
                    print("\n✓✓✓ SUCCESS! input_data is present in response")
                    print(f"input_data keys: {list(fit_data['input_data'].keys())}")
                else:
                    print("\n✗✗✗ PROBLEM: input_data is NOT in response")
                    print(f"Full response keys: {fit_data.keys()}")
            else:
                print(f"✗ Profile fit failed: {fit_response.status_code}")
                print(fit_response.text)
    else:
        print(f"✗ Job analysis failed: {job_response.status_code}")
else:
    print(f"✗ Login failed: {login_response.status_code}")
    print("Note: You may need to update the login credentials in the script")
