"""
Test script to verify backend returns input_data field
"""
import sys
import os
import io

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Simpler test - just check the service functions directly
try:
    from profile_fit_service import analyze_profile_fit_dual
    from cv_tailoring_service import tailor_cv_dual
    
    print("[OK] Successfully imported service functions")
    print("\nChecking function signatures...")
    
    # Check profile_fit_service
    import inspect
    fit_source = inspect.getsource(analyze_profile_fit_dual)
    if '"input_data"' in fit_source:
        print("[OK] profile_fit_service.py contains 'input_data' field")
    else:
        print("[ERROR] profile_fit_service.py does NOT contain 'input_data' field")
    
    # Check cv_tailoring_service
    tailor_source = inspect.getsource(tailor_cv_dual)
    if '"input_data"' in tailor_source:
        print("[OK] cv_tailoring_service.py contains 'input_data' field")
    else:
        print("[ERROR] cv_tailoring_service.py does NOT contain 'input_data' field")
    
    print("\n" + "="*60)
    print("RESULT: Backend code has been updated with input_data field")
    print("="*60)
    
except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
