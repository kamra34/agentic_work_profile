import PyPDF2
from docx import Document
from pathlib import Path
from typing import Tuple

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
    except Exception as e:
        raise Exception(f"Error reading PDF: {str(e)}")

def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX file"""
    try:
        doc = Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Error reading DOCX: {str(e)}")

def extract_text_from_file(file_path: str) -> Tuple[str, str]:
    """
    Extract text from either PDF or DOCX file
    Returns: (extracted_text, file_type)
    """
    file_extension = Path(file_path).suffix.lower()

    if file_extension == '.pdf':
        text = extract_text_from_pdf(file_path)
        return text, 'pdf'
    elif file_extension in ['.docx', '.doc']:
        text = extract_text_from_docx(file_path)
        return text, 'docx'
    else:
        raise ValueError(f"Unsupported file type: {file_extension}")
