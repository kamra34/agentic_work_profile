# AI-Powered Resume Tailoring Platform

**Version 2.0.0** - Now with Application Tracker!

An intelligent resume builder that helps job seekers create perfectly tailored resumes for specific job applications using dual AI analysis from OpenAI and Anthropic Claude.

## Overview

This platform transforms the traditional resume creation process by leveraging artificial intelligence to analyze job descriptions and intelligently recommend which elements from your master profile should be included in your tailored resume. Unlike generic resume builders, our system uses dual AI models to provide unbiased, data-driven recommendations.

## Key Features

### 1. Master Profile Management
- Create and maintain a comprehensive master profile with all your professional information
- Organize your experience into structured sections:
  - Professional Summary
  - Work Experience (with hierarchical company/role structure)
  - Skills (categorized by type)
  - Education
  - Projects
  - Certifications
  - Awards
  - Publications
  - Languages
  - Volunteer Work
- Add detailed bullet points for each experience
- Manual entry with full control over your content

### 2. AI-Powered Job Analysis
- Paste any job description to receive comprehensive dual AI analysis
- **OpenAI GPT-4o Analysis**: Analyzes job requirements, technical skills, soft skills, experience level, and responsibilities
- **Anthropic Claude Sonnet 4.5 Analysis**: Provides independent second opinion on job requirements
- Extract key requirements including:
  - Job category and level
  - Required technical skills
  - Soft skills and competencies
  - Experience requirements
  - Education requirements
  - Key responsibilities
  - Nice-to-have qualifications

### 3. Profile Fit Scoring
- Receive honest, unbiased fit scores from both AI models (0-100%)
- Understand your strengths for the position
- Identify gaps in your profile relative to job requirements
- Get actionable recommendations for improvement
- ATS (Applicant Tracking System) compatibility scoring

### 4. Intelligent Resume Tailoring
- AI models vote on which items from your master profile to include
- **Important**: AI doesn't create new content - it selects from your existing profile items
- Each item shows which AI model(s) recommended it (OpenAI, Claude, or both)
- Get reasoning for why specific experiences and skills are recommended
- Maintain authenticity while optimizing for the specific role

### 5. Saved Resume Management
- Save multiple tailored resumes for different job applications
- View all details including:
  - Job title and company name
  - Complete job description
  - AI fit scores and ATS scores from both models
  - AI-recommended profile items
- Real-time PDF preview of your resume
- Toggle visibility of individual items using eye icons
- Recalculate ATS scores based on visible items
- Download professional PDF resumes

### 6. Application Tracking (Coming Soon)
- Track all your job applications in one place
- Monitor application status (Applied, Interviewing, Rejected, Offered, etc.)
- View complete application history
- Access final resume versions used for each application
- Visual dashboard with application analytics

## Technology Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **PostgreSQL**: Robust relational database
- **SQLAlchemy**: ORM for database operations
- **OpenAI API**: GPT-4o for job analysis and recommendations
- **Anthropic API**: Claude Sonnet 4.5 for independent AI analysis
- **ReportLab**: Professional PDF generation
- **JWT Authentication**: Secure user sessions

### Frontend
- **React**: Modern UI library
- **Vite**: Fast build tool and dev server
- **CSS3**: Custom styling with modern design

## Workflow

1. **Profile Creation**: Build your comprehensive master profile with all relevant sections and detailed bullet points

2. **Job Analysis**: Paste a job description and receive dual AI analysis with fit scores and ATS compatibility ratings from both OpenAI and Claude

3. **AI Selection**: Let both AI models independently vote on which items from your profile best match the job requirements (they select from your existing content, not generate new content)

4. **Review & Customize**: Review AI recommendations, toggle item visibility, and customize your tailored resume while seeing real-time PDF preview

5. **Save & Track**: Save your tailored resume with all details, track its ATS score, and download a professional PDF when ready to apply

6. **Application Management**: (Coming Soon) Track application status, view analytics, and manage your job search pipeline

## AI Models Used

### OpenAI GPT-4o
- Advanced language model for job description analysis
- Provides fit scoring and ATS compatibility assessment
- Recommends profile items based on job requirements

### Anthropic Claude Sonnet 4.5
- Independent second AI opinion
- Unbiased analysis of job requirements
- Cross-validation of recommendations

## Benefits

- **Save Time**: Quickly create tailored resumes instead of manually editing for each job
- **Improve Quality**: AI-powered recommendations ensure you highlight the most relevant experience
- **Increase Success Rate**: Optimize for ATS systems and hiring manager expectations
- **Maintain Authenticity**: AI selects from your real experiences, no fake content
- **Data-Driven Decisions**: Dual AI analysis provides confidence in your choices
- **Track Progress**: (Coming Soon) Manage your entire job search process in one place

## Security & Privacy

- Secure JWT-based authentication
- Password hashing with bcrypt
- User data isolation
- Environment-based configuration
- CORS protection

## Project Structure

```
agentic_work_profile/
├── backend/              # FastAPI backend
│   ├── main.py          # Main API endpoints
│   ├── models.py        # Database models
│   ├── schemas.py       # Pydantic schemas
│   ├── *_service.py     # AI and business logic services
│   └── pdf_service.py   # PDF generation
├── frontend/            # React frontend
│   └── src/
│       ├── components/  # React components
│       ├── App.jsx     # Main app component
│       └── main.jsx    # Entry point
├── README.md           # This file
├── INSTALLATION.md     # Setup instructions
└── bump_version.py     # Version management utility
```

## Versioning

This project uses [Semantic Versioning](https://semver.org/):
- **Backend Version**: See `backend/VERSION` and `backend/CHANGELOG.md`
- **Frontend Version**: See `frontend/VERSION` and `frontend/CHANGELOG.md`

To bump versions:
```bash
# Bump backend patch version (2.0.0 -> 2.0.1)
python bump_version.py backend patch

# Bump frontend minor version (2.0.0 -> 2.1.0)
python bump_version.py frontend minor

# Bump both major versions (2.0.0 -> 3.0.0)
python bump_version.py both major
```

## License

This project is private and proprietary.

## Support

For issues, questions, or feature requests, please contact the development team.
