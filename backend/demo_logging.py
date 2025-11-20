"""
Demo script to showcase the comprehensive logging system
Run this to see all the different log outputs in action
"""

import sys
import os
from dotenv import load_dotenv

# Load environment
load_dotenv('../.env')

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from logger_config import get_logger

def demo_logging_features():
    """Demonstrate all logging features"""

    logger = get_logger("Demo")

    print("\n" + "="*80)
    print("LOGGING SYSTEM DEMONSTRATION")
    print("="*80)

    # 1. Step logging
    logger.step("Initializing job analysis workflow", step_num=1)

    # 2. Info messages
    logger.info("Processing job description of 2,500 characters")

    # 3. Model call logging
    logger.model_call("gpt-5.1", "job analysis", "analyzing senior engineer role")

    # 4. Successful response
    logger.model_response("gpt-5.1", True, 8.5, {
        'input_tokens': 2500,
        'output_tokens': 1200,
        'reasoning_tokens': 625,
        'total_tokens': 4325
    })

    # 5. Success message
    logger.success("Job analysis completed successfully")

    # 6. Token usage summary
    logger.tokens_summary("gpt-5.1", {
        'prompt_tokens': 2500,
        'completion_tokens': 1200,
        'reasoning_tokens': 625,
        'total_tokens': 4325
    })

    # 7. Different model (GPT-4o)
    logger.step("Running profile scoring", step_num=2)
    logger.model_call("gpt-4o", "profile scoring", "evaluating candidate fit")
    logger.model_response("gpt-4o", True, 2.3, {
        'input_tokens': 1500,
        'output_tokens': 400,
        'total_tokens': 1900
    })
    logger.success("Profile scoring: Fit=85, ATS=92, Verdict=SHOULD_APPLY")

    # 8. Claude model
    logger.step("Verifying with Claude", step_num=3)
    logger.model_call("claude-sonnet-4.5", "verification analysis")
    logger.model_response("claude-sonnet-4.5", True, 3.8, {
        'input_tokens': 2500,
        'output_tokens': 1100,
        'total_tokens': 3600
    })

    # 9. Dual analysis
    logger.dual_analysis_start(["OpenAI (gpt-5.1)", "Claude (Sonnet 4.5)"])
    logger.dual_analysis_summary({
        'OpenAI': {'success': True, 'model': 'gpt-5.1'},
        'Claude': {'success': True, 'model': 'claude-sonnet-4.5'}
    })

    # 10. Warning
    logger.warning("Node count is high (127 nodes) - this may take longer")

    # 11. Error (simulated)
    logger.step("Attempting node selection", step_num=4)
    logger.model_call("gpt-5.1", "node selection", "42 nodes to evaluate")
    # Simulate error
    logger.error("API timeout after 180 seconds")
    logger.model_response("gpt-5.1", False, 180.5)

    # 12. Final summary
    print("\n" + "="*80)
    logger.success("Demo complete! All logging features demonstrated")
    print("="*80 + "\n")

    print("\nLOGGING FEATURES:")
    print("✓ Color-coded output (Blue=GPT-4o, Purple=GPT-5.1, Cyan=Claude)")
    print("✓ Model-specific emojis (🔵 GPT-4o, 🟣 GPT-5.1, 🔷 Claude)")
    print("✓ Timestamps on every log message")
    print("✓ Step-by-step workflow tracking")
    print("✓ Detailed token usage (including reasoning tokens)")
    print("✓ Success/Error indicators")
    print("✓ Dual analysis summaries")
    print("✓ Service name tagging")
    print("\nThese logs will appear in your backend console when using the app!")

if __name__ == "__main__":
    # Reconfigure stdout for UTF-8 to handle emojis
    sys.stdout.reconfigure(encoding='utf-8')

    demo_logging_features()
