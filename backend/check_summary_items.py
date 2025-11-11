#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Check how many summary items exist in the profile
"""
import sys
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import SectionEntry, SectionItem, Section

load_dotenv()

# Setup database
engine = create_engine(os.getenv('DATABASE_URL'))
Session = sessionmaker(bind=engine)
session = Session()

# Get profile first
from models import Profile
profile = session.query(Profile).filter_by(user_id=1).first()
if not profile:
    print('No profile found!')
    session.close()
    exit()

# Get summary section
summary_section = session.query(Section).filter_by(profile_id=profile.id, section_type='summary').first()
print(f'Summary section ID: {summary_section.id if summary_section else None}')

if summary_section:
    entries = session.query(SectionEntry).filter_by(section_id=summary_section.id).all()
    print(f'Number of summary entries: {len(entries)}')

    for entry in entries:
        items = session.query(SectionItem).filter_by(entry_id=entry.id).all()
        print(f'\n  Entry {entry.id} ("{entry.title}"): {len(items)} items')
        for item in items:
            print(f'    Item {item.id}: {item.content[:100]}...')
else:
    print('No summary section found!')

session.close()
