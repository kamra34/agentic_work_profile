"""
Centralized Logging Configuration for AI Services
Provides colorful, informative logs to track AI model usage
"""

import logging
import sys
from datetime import datetime
from typing import Optional

# Configure UTF-8 encoding for Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        # Python < 3.7 doesn't have reconfigure
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

    # Model-specific colors
    GPT4O = '\033[94m'      # Blue
    GPT51 = '\033[95m'      # Magenta
    CLAUDE = '\033[96m'     # Cyan

    # Step colors
    STEP = '\033[93m'       # Yellow
    SUCCESS = '\033[92m'    # Green
    ERROR = '\033[91m'      # Red
    INFO = '\033[97m'       # White


class AIServiceLogger:
    """
    Custom logger for AI service operations
    Provides structured, colorful logging for tracking AI model usage
    """

    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = logging.getLogger(f"ai_service.{service_name}")

        # Only add handler if none exists (prevent duplicates)
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(logging.Formatter('%(message)s'))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def _get_timestamp(self) -> str:
        """Get formatted timestamp"""
        return datetime.now().strftime("%H:%M:%S")

    def _get_model_color(self, model: str) -> str:
        """Get color based on model name"""
        model_lower = model.lower()
        if 'gpt-4o' in model_lower:
            return Colors.GPT4O
        elif 'gpt-5.1' in model_lower or 'gpt5.1' in model_lower:
            return Colors.GPT51
        elif 'claude' in model_lower:
            return Colors.CLAUDE
        else:
            return Colors.INFO

    def step(self, message: str, step_num: Optional[int] = None):
        """Log a processing step"""
        prefix = f"[{self._get_timestamp()}]"
        step_text = f"STEP {step_num}" if step_num else "STEP"
        formatted = f"{Colors.STEP}{prefix} [{self.service_name}] {step_text}: {message}{Colors.ENDC}"
        self.logger.info(formatted)

    def model_call(self, model: str, operation: str, details: str = ""):
        """Log an AI model API call"""
        prefix = f"[{self._get_timestamp()}]"
        color = self._get_model_color(model)
        emoji = self._get_model_emoji(model)
        detail_text = f" - {details}" if details else ""
        formatted = f"{color}{prefix} {emoji} [{self.service_name}] Calling {model} for {operation}{detail_text}{Colors.ENDC}"
        self.logger.info(formatted)

    def model_response(self, model: str, success: bool, duration: float, token_info: dict = None):
        """Log AI model response"""
        prefix = f"[{self._get_timestamp()}]"
        color = Colors.SUCCESS if success else Colors.ERROR
        status = "SUCCESS" if success else "FAILED"
        emoji = "✅" if success else "❌"

        token_text = ""
        if token_info:
            parts = []
            if 'input_tokens' in token_info:
                parts.append(f"in:{token_info['input_tokens']}")
            if 'output_tokens' in token_info:
                parts.append(f"out:{token_info['output_tokens']}")
            if 'reasoning_tokens' in token_info and token_info['reasoning_tokens'] > 0:
                parts.append(f"🧠:{token_info['reasoning_tokens']}")
            if parts:
                token_text = f" | Tokens: {', '.join(parts)}"

        formatted = f"{color}{prefix} {emoji} [{self.service_name}] {model} {status} in {duration:.2f}s{token_text}{Colors.ENDC}"
        self.logger.info(formatted)

    def info(self, message: str):
        """Log general information"""
        prefix = f"[{self._get_timestamp()}]"
        formatted = f"{Colors.INFO}{prefix} ℹ️  [{self.service_name}] {message}{Colors.ENDC}"
        self.logger.info(formatted)

    def success(self, message: str):
        """Log success message"""
        prefix = f"[{self._get_timestamp()}]"
        formatted = f"{Colors.SUCCESS}{prefix} ✅ [{self.service_name}] {message}{Colors.ENDC}"
        self.logger.info(formatted)

    def error(self, message: str, error: Optional[Exception] = None):
        """Log error message"""
        prefix = f"[{self._get_timestamp()}]"
        error_text = f": {str(error)}" if error else ""
        formatted = f"{Colors.ERROR}{prefix} ❌ [{self.service_name}] {message}{error_text}{Colors.ENDC}"
        self.logger.error(formatted)

    def warning(self, message: str):
        """Log warning message"""
        prefix = f"[{self._get_timestamp()}]"
        formatted = f"{Colors.WARNING}{prefix} ⚠️  [{self.service_name}] {message}{Colors.ENDC}"
        self.logger.warning(formatted)

    def _get_model_emoji(self, model: str) -> str:
        """Get emoji based on model"""
        model_lower = model.lower()
        if 'gpt-4o' in model_lower:
            return "🔵"  # Blue circle for GPT-4o
        elif 'gpt-5.1' in model_lower or 'gpt5.1' in model_lower:
            return "🟣"  # Purple circle for GPT-5.1
        elif 'claude' in model_lower:
            return "🔷"  # Blue diamond for Claude
        else:
            return "🤖"  # Robot for unknown

    def dual_analysis_start(self, providers: list):
        """Log start of dual analysis"""
        prefix = f"[{self._get_timestamp()}]"
        providers_text = ", ".join(providers)
        formatted = f"{Colors.HEADER}{prefix} 🔄 [{self.service_name}] Starting dual analysis with: {providers_text}{Colors.ENDC}"
        self.logger.info(formatted)

    def parallel_execution_start(self, providers: list):
        """Log start of parallel execution"""
        prefix = f"[{self._get_timestamp()}]"
        providers_text = " + ".join(providers)
        formatted = f"{Colors.OKCYAN}{prefix} ⚡ [{self.service_name}] Running in PARALLEL: {providers_text}{Colors.ENDC}"
        self.logger.info(formatted)

    def dual_analysis_summary(self, results: dict):
        """Log summary of dual analysis"""
        prefix = f"[{self._get_timestamp()}]"
        summary_lines = [f"{Colors.HEADER}{prefix} 📊 [{self.service_name}] Dual Analysis Summary:{Colors.ENDC}"]

        for provider, result in results.items():
            if result.get('success'):
                model = result.get('model', provider)
                emoji = self._get_model_emoji(model)
                color = self._get_model_color(model)
                summary_lines.append(f"{color}   {emoji} {provider}: SUCCESS{Colors.ENDC}")
            else:
                error = result.get('error', 'Unknown error')
                summary_lines.append(f"{Colors.ERROR}   ❌ {provider}: FAILED - {error}{Colors.ENDC}")

        for line in summary_lines:
            self.logger.info(line)

    def tokens_summary(self, model: str, usage: dict):
        """Log detailed token usage"""
        prefix = f"[{self._get_timestamp()}]"
        color = self._get_model_color(model)

        lines = [f"{color}{prefix} 📊 [{self.service_name}] Token Usage for {model}:{Colors.ENDC}"]

        if 'prompt_tokens' in usage:
            lines.append(f"{color}   • Input tokens: {usage['prompt_tokens']}{Colors.ENDC}")
        if 'completion_tokens' in usage:
            lines.append(f"{color}   • Output tokens: {usage['completion_tokens']}{Colors.ENDC}")
        if 'reasoning_tokens' in usage and usage['reasoning_tokens'] > 0:
            lines.append(f"{color}   • 🧠 Reasoning tokens: {usage['reasoning_tokens']}{Colors.ENDC}")
        if 'total_tokens' in usage:
            lines.append(f"{color}   • Total tokens: {usage['total_tokens']}{Colors.ENDC}")

        for line in lines:
            self.logger.info(line)


# Convenience function to get logger
def get_logger(service_name: str) -> AIServiceLogger:
    """Get or create a logger for the given service"""
    return AIServiceLogger(service_name)


# Example usage
if __name__ == "__main__":
    # Test the logger
    logger = get_logger("test_service")

    logger.step("Starting job analysis", step_num=1)
    logger.model_call("gpt-4o", "job analysis", "analyzing senior engineer role")
    logger.model_response("gpt-4o", True, 2.3, {
        'input_tokens': 150,
        'output_tokens': 400,
        'total_tokens': 550
    })

    logger.step("Starting node selection", step_num=2)
    logger.model_call("gpt-5.1", "node selection", "42 nodes to evaluate")
    logger.model_response("gpt-5.1", True, 8.5, {
        'input_tokens': 2500,
        'output_tokens': 1200,
        'reasoning_tokens': 625,
        'total_tokens': 4325
    })

    logger.step("Comparing with Claude", step_num=3)
    logger.model_call("claude-sonnet-4.5", "verification")
    logger.model_response("claude-sonnet-4.5", True, 3.2, {
        'input_tokens': 2500,
        'output_tokens': 1100,
        'total_tokens': 3600
    })

    logger.dual_analysis_summary({
        'openai': {'success': True, 'model': 'gpt-5.1'},
        'claude': {'success': True, 'model': 'claude-sonnet-4.5'}
    })

    logger.success("All analysis complete!")
    logger.info("Results saved to database")
