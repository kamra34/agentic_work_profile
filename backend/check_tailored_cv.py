#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Check tailored CV data in database
"""
import sys
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import TailoredCVVersion

load_dotenv()

# Setup database
engine = create_engine(os.getenv('DATABASE_URL'))
Session = sessionmaker(bind=engine)
session = Session()

# Get all tailored CVs
cvs = session.query(TailoredCVVersion).all()

print(f"Found {len(cvs)} tailored CVs\n")

for cv in cvs:
    print("="*80)
    print(f"ID: {cv.id}")
    print(f"Job Title: {cv.job_title}")
    print(f"Company: {cv.company_name}")
    print(f"Status: {cv.status}")
    print(f"Created: {cv.created_at}")
    print(f"\nScores:")
    print(f"  OpenAI Fit Score: {cv.openai_fit_score}")
    print(f"  Claude Fit Score: {cv.claude_fit_score}")
    print(f"  OpenAI ATS Score: {cv.openai_ats_score}")
    print(f"  Claude ATS Score: {cv.claude_ats_score}")
    print(f"\nNotes: {cv.notes}")
    print()

session.close()
