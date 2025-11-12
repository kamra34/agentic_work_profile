// Mock recommendations data captured from actual AI responses
// Generated from: backend/temp/step3_recommendations_new.json
// Use this for Step 3 UI testing without calling AI APIs

export const MOCK_RECOMMENDATIONS_STEP3 = {
  "openai": {
    "success": true,
    "model": "openai-gpt-4o",
    "recommendations": {
      "selected_nodes": [
        {
          "id": 65,
          "include": true,
          "confidence": 0.9,
          "reason": "The summary section is crucial for providing an overview of the candidate's qualifications and experience.",
          "relevance_tags": ["overview", "introduction"]
        },
        {
          "id": 77,
          "include": true,
          "confidence": 0.95,
          "reason": "Demonstrates leadership and hands-on Python development, aligning with the job's must-have requirements.",
          "relevance_tags": ["leadership", "Python"]
        },
        {
          "id": 78,
          "include": true,
          "confidence": 0.95,
          "reason": "Highlights experience with AWS and chunking strategies, directly relevant to the job requirements.",
          "relevance_tags": ["AWS", "chunking"]
        },
        {
          "id": 79,
          "include": true,
          "confidence": 0.9,
          "reason": "Shows technical depth and problem-solving in vector search, relevant to the role.",
          "relevance_tags": ["vector indexes", "problem-solving"]
        },
        {
          "id": 81,
          "include": true,
          "confidence": 0.9,
          "reason": "Experience with containers and monitoring aligns with MLOps requirements.",
          "relevance_tags": ["containers", "monitoring"]
        },
        {
          "id": 82,
          "include": true,
          "confidence": 0.95,
          "reason": "Experience with AWS services like Bedrock, SageMaker, and Lambda is highly relevant.",
          "relevance_tags": ["AWS", "SageMaker", "Lambda"]
        },
        {
          "id": 83,
          "include": true,
          "confidence": 0.9,
          "reason": "Demonstrates experience with rollback strategies, a key requirement.",
          "relevance_tags": ["rollback strategies", "MLOps"]
        },
        {
          "id": 84,
          "include": true,
          "confidence": 0.85,
          "reason": "Highlights strong communication skills, a soft skill requirement.",
          "relevance_tags": ["communication", "soft skills"]
        },
        {
          "id": 85,
          "include": false,
          "confidence": 0.7,
          "reason": "While relevant, this node is less critical compared to others for the specific job requirements.",
          "relevance_tags": ["integration", "coordination"]
        },
        {
          "id": 86,
          "include": false,
          "confidence": 0.7,
          "reason": "Project management details are less emphasized in the job description.",
          "relevance_tags": ["project management"]
        },
        {
          "id": 87,
          "include": false,
          "confidence": 0.7,
          "reason": "Integration experience is relevant but not a primary focus of the job description.",
          "relevance_tags": ["integration"]
        },
        {
          "id": 88,
          "include": true,
          "confidence": 0.85,
          "reason": "Experience with RAG services and unstructured data handling is relevant.",
          "relevance_tags": ["RAG", "unstructured data"]
        },
        {
          "id": 89,
          "include": true,
          "confidence": 0.85,
          "reason": "Relevant to model monitoring, a key job requirement.",
          "relevance_tags": ["monitoring", "MLOps"]
        },
        {
          "id": 90,
          "include": true,
          "confidence": 0.9,
          "reason": "Mentoring aligns with the leadership requirement.",
          "relevance_tags": ["mentoring", "leadership"]
        },
        {
          "id": 91,
          "include": true,
          "confidence": 0.85,
          "reason": "Published research demonstrates academic rigor and advanced degree relevance.",
          "relevance_tags": ["research", "academic"]
        },
        {
          "id": 92,
          "include": true,
          "confidence": 0.85,
          "reason": "Awards highlight impact and innovation, strengthening the candidate's story.",
          "relevance_tags": ["awards", "impact"]
        },
        {
          "id": 64,
          "include": true,
          "confidence": 0.9,
          "reason": "Professional experience is essential to demonstrate the candidate's work history.",
          "relevance_tags": ["experience", "work history"]
        },
        {
          "id": 71,
          "include": true,
          "confidence": 0.95,
          "reason": "Current role as a Lead Data Scientist aligns with the seniority level required.",
          "relevance_tags": ["leadership", "current role"]
        },
        {
          "id": 93,
          "include": true,
          "confidence": 0.9,
          "reason": "Highlights strategic and technical contributions, relevant to the role.",
          "relevance_tags": ["strategy", "technical"]
        },
        {
          "id": 94,
          "include": false,
          "confidence": 0.7,
          "reason": "Delivery management is less emphasized in the job description.",
          "relevance_tags": ["delivery management"]
        },
        {
          "id": 95,
          "include": false,
          "confidence": 0.7,
          "reason": "While relevant, this node is less critical compared to others for the specific job requirements.",
          "relevance_tags": ["alignment", "priorities"]
        },
        {
          "id": 96,
          "include": false,
          "confidence": 0.7,
          "reason": "Coordination with partners is less emphasized in the job description.",
          "relevance_tags": ["coordination", "partners"]
        },
        {
          "id": 97,
          "include": false,
          "confidence": 0.7,
          "reason": "Translating business requirements is relevant but not a primary focus.",
          "relevance_tags": ["business requirements"]
        },
        {
          "id": 98,
          "include": false,
          "confidence": 0.7,
          "reason": "Integration of data flows is less emphasized in the job description.",
          "relevance_tags": ["data integration"]
        },
        {
          "id": 101,
          "include": false,
          "confidence": 0.7,
          "reason": "Product management is less emphasized in the job description.",
          "relevance_tags": ["product management"]
        },
        {
          "id": 102,
          "include": false,
          "confidence": 0.7,
          "reason": "Project structuring is less emphasized in the job description.",
          "relevance_tags": ["project structuring"]
        },
        {
          "id": 103,
          "include": true,
          "confidence": 0.85,
          "reason": "Leading cross-functional teams is relevant to the leadership requirement.",
          "relevance_tags": ["leadership", "cross-functional"]
        },
        {
          "id": 104,
          "include": true,
          "confidence": 0.85,
          "reason": "Hands-on technical contributions align with the job requirements.",
          "relevance_tags": ["technical", "contributions"]
        },
        {
          "id": 105,
          "include": true,
          "confidence": 0.9,
          "reason": "Technical leadership is a key requirement for the role.",
          "relevance_tags": ["leadership", "technical"]
        },
        {
          "id": 106,
          "include": true,
          "confidence": 0.85,
          "reason": "Guiding teams in data science methodologies aligns with the role.",
          "relevance_tags": ["guidance", "methodologies"]
        },
        {
          "id": 107,
          "include": true,
          "confidence": 0.85,
          "reason": "Mentoring aligns with the leadership requirement.",
          "relevance_tags": ["mentoring", "leadership"]
        },
        {
          "id": 108,
          "include": true,
          "confidence": 0.85,
          "reason": "Technical contributions are crucial for demonstrating hands-on experience.",
          "relevance_tags": ["technical", "contributions"]
        },
        {
          "id": 109,
          "include": true,
          "confidence": 0.85,
          "reason": "Experience with ML pipelines is directly relevant to the job requirements.",
          "relevance_tags": ["ML pipelines", "experience"]
        },
        {
          "id": 110,
          "include": false,
          "confidence": 0.7,
          "reason": "Workflow automation is less emphasized in the job description.",
          "relevance_tags": ["automation"]
        },
        {
          "id": 111,
          "include": true,
          "confidence": 0.9,
          "reason": "Experience with AWS services and RAG is highly relevant.",
          "relevance_tags": ["AWS", "RAG"]
        },
        {
          "id": 112,
          "include": true,
          "confidence": 0.85,
          "reason": "Designing AI solutions on AWS is relevant to the job requirements.",
          "relevance_tags": ["AWS", "AI solutions"]
        },
        {
          "id": 114,
          "include": true,
          "confidence": 0.85,
          "reason": "Key achievements highlight the candidate's impact and success.",
          "relevance_tags": ["achievements", "impact"]
        },
        {
          "id": 115,
          "include": true,
          "confidence": 0.85,
          "reason": "Delivery impact aligns with the job's focus on successful project execution.",
          "relevance_tags": ["delivery", "impact"]
        },
        {
          "id": 116,
          "include": true,
          "confidence": 0.85,
          "reason": "Leadership recognition strengthens the candidate's story.",
          "relevance_tags": ["leadership", "recognition"]
        },
        {
          "id": 117,
          "include": true,
          "confidence": 0.85,
          "reason": "Mentorship experience aligns with the leadership requirement.",
          "relevance_tags": ["mentorship", "leadership"]
        },
        {
          "id": 99,
          "include": true,
          "confidence": 0.85,
          "reason": "Research experience supports the advanced degree requirement.",
          "relevance_tags": ["research", "education"]
        },
        {
          "id": 118,
          "include": true,
          "confidence": 0.85,
          "reason": "Advanced research in ML supports the candidate's technical expertise.",
          "relevance_tags": ["research", "ML"]
        },
        {
          "id": 119,
          "include": true,
          "confidence": 0.85,
          "reason": "Research in statistical methods aligns with the quantitative field requirement.",
          "relevance_tags": ["research", "quantitative"]
        },
        {
          "id": 120,
          "include": true,
          "confidence": 0.85,
          "reason": "Co-supervision of theses demonstrates leadership and mentoring skills.",
          "relevance_tags": ["mentoring", "leadership"]
        },
        {
          "id": 121,
          "include": true,
          "confidence": 0.85,
          "reason": "Published research supports the advanced degree requirement.",
          "relevance_tags": ["research", "publication"]
        },
        {
          "id": 100,
          "include": true,
          "confidence": 0.8,
          "reason": "Early career experience in data analytics is relevant to the candidate's overall story.",
          "relevance_tags": ["experience", "analytics"]
        },
        {
          "id": 122,
          "include": false,
          "confidence": 0.7,
          "reason": "Network performance analysis is less relevant to the current job requirements.",
          "relevance_tags": ["network", "performance"]
        },
        {
          "id": 123,
          "include": false,
          "confidence": 0.7,
          "reason": "Development in C++ and Java is less relevant to the current job requirements.",
          "relevance_tags": ["development", "C++", "Java"]
        },
        {
          "id": 124,
          "include": false,
          "confidence": 0.7,
          "reason": "Multimedia applications experience is less relevant to the current job requirements.",
          "relevance_tags": ["multimedia", "applications"]
        },
        {
          "id": 125,
          "include": false,
          "confidence": 0.7,
          "reason": "Participation in international projects is less emphasized in the job description.",
          "relevance_tags": ["international", "projects"]
        },
        {
          "id": 126,
          "include": false,
          "confidence": 0.7,
          "reason": "Translation of network probes is less relevant to the current job requirements.",
          "relevance_tags": ["network", "probes"]
        },
        {
          "id": 127,
          "include": false,
          "confidence": 0.7,
          "reason": "EU and ESA projects are less emphasized in the job description.",
          "relevance_tags": ["EU", "ESA"]
        },
        {
          "id": 128,
          "include": true,
          "confidence": 0.9,
          "reason": "Education section is crucial for demonstrating the candidate's academic background.",
          "relevance_tags": ["education", "background"]
        },
        {
          "id": 129,
          "include": true,
          "confidence": 0.95,
          "reason": "Ph.D. in a quantitative field meets the advanced degree requirement.",
          "relevance_tags": ["Ph.D.", "quantitative"]
        },
        {
          "id": 130,
          "include": true,
          "confidence": 0.85,
          "reason": "M.Sc. supports the candidate's technical education background.",
          "relevance_tags": ["M.Sc.", "education"]
        },
        {
          "id": 131,
          "include": true,
          "confidence": 0.9,
          "reason": "Core skills section is essential to highlight the candidate's key competencies.",
          "relevance_tags": ["skills", "competencies"]
        },
        {
          "id": 132,
          "include": true,
          "confidence": 0.9,
          "reason": "Technical proficiencies align with the job's technical skills requirements.",
          "relevance_tags": ["technical", "proficiencies"]
        },
        {
          "id": 134,
          "include": true,
          "confidence": 0.95,
          "reason": "Proficiency in Python, R, and MATLAB directly aligns with the job requirements.",
          "relevance_tags": ["Python", "R", "MATLAB"]
        },
        {
          "id": 135,
          "include": true,
          "confidence": 0.85,
          "reason": "Machine learning and AI skills are highly relevant to the role.",
          "relevance_tags": ["machine learning", "AI"]
        },
        {
          "id": 136,
          "include": false,
          "confidence": 0.7,
          "reason": "Data visualization is less emphasized in the job description.",
          "relevance_tags": ["data visualization"]
        },
        {
          "id": 137,
          "include": true,
          "confidence": 0.85,
          "reason": "Containerization is relevant to MLOps practices.",
          "relevance_tags": ["containerization", "MLOps"]
        },
        {
          "id": 138,
          "include": true,
          "confidence": 0.9,
          "reason": "CI/CD pipelines and MLOps practices are key requirements.",
          "relevance_tags": ["CI/CD", "MLOps"]
        },
        {
          "id": 139,
          "include": true,
          "confidence": 0.85,
          "reason": "Cloud infrastructure management aligns with AWS experience requirement.",
          "relevance_tags": ["cloud", "AWS"]
        },
        {
          "id": 133,
          "include": true,
          "confidence": 0.9,
          "reason": "Professional skills section is essential to highlight the candidate's soft skills.",
          "relevance_tags": ["skills", "soft skills"]
        },
        {
          "id": 140,
          "include": true,
          "confidence": 0.85,
          "reason": "Organizational and leadership skills are relevant to the role.",
          "relevance_tags": ["leadership", "organization"]
        },
        {
          "id": 141,
          "include": false,
          "confidence": 0.7,
          "reason": "Strategic project planning is less emphasized in the job description.",
          "relevance_tags": ["project planning"]
        },
        {
          "id": 142,
          "include": true,
          "confidence": 0.9,
          "reason": "Machine learning experience aligns with the job's experience requirement.",
          "relevance_tags": ["machine learning", "experience"]
        },
        {
          "id": 143,
          "include": false,
          "confidence": 0.7,
          "reason": "Project management skills are less emphasized in the job description.",
          "relevance_tags": ["project management"]
        },
        {
          "id": 144,
          "include": false,
          "confidence": 0.7,
          "reason": "Analytical skills are relevant but less emphasized compared to other skills.",
          "relevance_tags": ["analytical", "skills"]
        },
        {
          "id": 146,
          "include": false,
          "confidence": 0.5,
          "reason": "Content is not relevant to the job description.",
          "relevance_tags": ["irrelevant"]
        }
      ],
      "selection_summary": {
        "total_nodes": 50,
        "recommended_include": 35,
        "recommended_exclude": 15
      },
      "tailoring_strategy": "The strategy focuses on aligning the candidate's experience and skills with the job requirements, emphasizing technical proficiencies, leadership experience, and relevant achievements to strengthen the candidate's fit for the senior data science role."
    }
  },
  "claude": {
    "success": true,
    "model": "claude-sonnet-4.5",
    "recommendations": {
      "selected_nodes": [
        {
          "id": 65,
          "include": true,
          "confidence": 0.95,
          "reason": "Essential section header for CV structure",
          "relevance_tags": ["structure"]
        },
        {
          "id": 77,
          "include": true,
          "confidence": 0.98,
          "reason": "Perfect match - demonstrates team leadership, Python expertise, and hands-on technical approach required for Lead role",
          "relevance_tags": ["leadership", "python", "team_management", "production"]
        },
        {
          "id": 78,
          "include": true,
          "confidence": 0.99,
          "reason": "Excellent match - shows AWS Bedrock, RAG pipelines, production scale, and chunking strategies - all key requirements",
          "relevance_tags": ["aws", "bedrock", "rag", "production", "chunking", "retrieval_systems"]
        },
        {
          "id": 79,
          "include": true,
          "confidence": 0.95,
          "reason": "Demonstrates technical leadership balance and vector search experience (vector indexes requirement)",
          "relevance_tags": ["leadership", "vector_indexes", "technical_depth"]
        },
        {
          "id": 81,
          "include": true,
          "confidence": 0.97,
          "reason": "Strong MLOps demonstration - containers, monitoring, production systems - core requirements",
          "relevance_tags": ["mlops", "containers", "model_monitoring", "production"]
        },
        {
          "id": 82,
          "include": true,
          "confidence": 0.99,
          "reason": "Perfect AWS match - Bedrock, SageMaker, Lambda all listed as requirements",
          "relevance_tags": ["aws", "bedrock", "sagemaker", "lambda", "production"]
        },
        {
          "id": 83,
          "include": true,
          "confidence": 0.96,
          "reason": "Shows rollback strategies and production experience - both key requirements",
          "relevance_tags": ["rollback_strategies", "production", "ai_agents"]
        },
        {
          "id": 84,
          "include": true,
          "confidence": 0.92,
          "reason": "Demonstrates strong communication skills and evidence-based decision making",
          "relevance_tags": ["communication", "leadership", "evidence_based"]
        },
        {
          "id": 85,
          "include": true,
          "confidence": 0.85,
          "reason": "Shows program management and coordination skills relevant for Lead role",
          "relevance_tags": ["program_management", "coordination"]
        },
        {
          "id": 86,
          "include": true,
          "confidence": 0.88,
          "reason": "Demonstrates project structuring and delivery management skills for Lead position",
          "relevance_tags": ["project_management", "delivery", "metrics"]
        },
        {
          "id": 87,
          "include": true,
          "confidence": 0.85,
          "reason": "Shows data integration experience, relevant for enterprise ML systems",
          "relevance_tags": ["data_integration", "enterprise"]
        },
        {
          "id": 88,
          "include": true,
          "confidence": 0.97,
          "reason": "Perfect match - production RAG services, retrieval systems experience (must-have requirement)",
          "relevance_tags": ["rag", "production", "retrieval_systems", "metadata"]
        },
        {
          "id": 89,
          "include": true,
          "confidence": 0.94,
          "reason": "Strong MLOps and model monitoring demonstration - key requirements",
          "relevance_tags": ["mlops", "model_monitoring", "production"]
        },
        {
          "id": 90,
          "include": true,
          "confidence": 0.93,
          "reason": "Shows team leadership and mentoring - important for Lead role (2+ years leading teams requirement)",
          "relevance_tags": ["leadership", "mentoring", "team_management"]
        },
        {
          "id": 91,
          "include": true,
          "confidence": 0.9,
          "reason": "Demonstrates advanced quantitative background and research experience",
          "relevance_tags": ["research", "quantitative", "publications"]
        },
        {
          "id": 92,
          "include": true,
          "confidence": 0.88,
          "reason": "Shows recognition and impact in AI delivery - relevant for senior role",
          "relevance_tags": ["recognition", "impact", "ai_delivery"]
        },
        {
          "id": 64,
          "include": true,
          "confidence": 0.95,
          "reason": "Essential section header for CV structure",
          "relevance_tags": ["structure"]
        },
        {
          "id": 71,
          "include": true,
          "confidence": 0.98,
          "reason": "Current Lead role title perfectly matches seniority level and shows 4+ years in position",
          "relevance_tags": ["leadership", "seniority", "current_role"]
        },
        {
          "id": 93,
          "include": true,
          "confidence": 0.95,
          "reason": "Reinforces leadership and technical contribution balance required for Lead role",
          "relevance_tags": ["leadership", "technical", "program_management"]
        },
        {
          "id": 94,
          "include": true,
          "confidence": 0.85,
          "reason": "Shows delivery management skills relevant for Lead position",
          "relevance_tags": ["delivery", "management"]
        },
        {
          "id": 95,
          "include": true,
          "confidence": 0.82,
          "reason": "Demonstrates strategic planning and stakeholder alignment skills",
          "relevance_tags": ["strategy", "stakeholder_management"]
        },
        {
          "id": 96,
          "include": true,
          "confidence": 0.8,
          "reason": "Shows coordination and delivery management capabilities",
          "relevance_tags": ["coordination", "delivery"]
        },
        {
          "id": 97,
          "include": true,
          "confidence": 0.87,
          "reason": "Demonstrates communication and translation skills - soft skill requirement",
          "relevance_tags": ["communication", "requirements_analysis"]
        },
        {
          "id": 98,
          "include": true,
          "confidence": 0.83,
          "reason": "Shows data integration experience relevant for ML systems",
          "relevance_tags": ["data_integration", "platforms"]
        },
        {
          "id": 101,
          "include": true,
          "confidence": 0.85,
          "reason": "Product management skills relevant for Lead role",
          "relevance_tags": ["product_management"]
        },
        {
          "id": 102,
          "include": true,
          "confidence": 0.88,
          "reason": "Shows project structuring skills and measurable approach - evidence-based decision making",
          "relevance_tags": ["project_management", "metrics", "evidence_based"]
        },
        {
          "id": 103,
          "include": true,
          "confidence": 0.95,
          "reason": "Perfect match for 2+ years leading teams requirement",
          "relevance_tags": ["leadership", "cross_functional", "team_management"]
        },
        {
          "id": 104,
          "include": true,
          "confidence": 0.96,
          "reason": "Shows balance of leadership and hands-on technical work with ML/LLM",
          "relevance_tags": ["leadership", "technical", "ml", "llm"]
        },
        {
          "id": 105,
          "include": true,
          "confidence": 0.9,
          "reason": "Technical leadership section relevant for Lead role",
          "relevance_tags": ["technical_leadership"]
        },
        {
          "id": 106,
          "include": true,
          "confidence": 0.92,
          "reason": "Shows team guidance in DS/ML - matches 6-10+ years DS/ML/AI experience requirement",
          "relevance_tags": ["leadership", "data_science", "ml", "enterprise"]
        },
        {
          "id": 107,
          "include": true,
          "confidence": 0.88,
          "reason": "Demonstrates mentoring and leadership capabilities",
          "relevance_tags": ["mentoring", "leadership"]
        },
        {
          "id": 108,
          "include": true,
          "confidence": 0.9,
          "reason": "Technical contribution section header - shows hands-on involvement",
          "relevance_tags": ["technical"]
        },
        {
          "id": 109,
          "include": true,
          "confidence": 0.94,
          "reason": "Shows ML pipeline development and optimization - core technical requirements",
          "relevance_tags": ["ml", "pipelines", "optimization"]
        },
        {
          "id": 110,
          "include": true,
          "confidence": 0.85,
          "reason": "Demonstrates automation and scalability focus - MLOps relevant",
          "relevance_tags": ["automation", "scalability", "mlops"]
        },
        {
          "id": 111,
          "include": true,
          "confidence": 0.99,
          "reason": "Perfect match - AWS (Bedrock, SageMaker, Step Functions), RAG, retrieval systems - all key requirements",
          "relevance_tags": ["aws", "bedrock", "sagemaker", "step_functions", "rag", "retrieval_systems"]
        },
        {
          "id": 112,
          "include": true,
          "confidence": 0.95,
          "reason": "Shows AWS deployment experience and AI agents - relevant technical skills",
          "relevance_tags": ["aws", "deployment", "ai_agents"]
        },
        {
          "id": 114,
          "include": true,
          "confidence": 0.88,
          "reason": "Achievements section adds credibility and impact",
          "relevance_tags": ["achievements"]
        },
        {
          "id": 115,
          "include": true,
          "confidence": 0.9,
          "reason": "Shows end-to-end delivery capability important for Lead role",
          "relevance_tags": ["delivery", "program_management"]
        },
        {
          "id": 116,
          "include": true,
          "confidence": 0.85,
          "reason": "Recognition for AI solutions delivery - shows impact and innovation",
          "relevance_tags": ["recognition", "ai", "innovation"]
        },
        {
          "id": 117,
          "include": true,
          "confidence": 0.88,
          "reason": "Demonstrates leadership and mentoring - supports 2+ years leading teams requirement",
          "relevance_tags": ["mentoring", "leadership"]
        },
        {
          "id": 99,
          "include": true,
          "confidence": 0.92,
          "reason": "Shows advanced research background contributing to quantitative field requirement",
          "relevance_tags": ["research", "quantitative", "academic"]
        },
        {
          "id": 118,
          "include": true,
          "confidence": 0.88,
          "reason": "Reinforces advanced ML and quantitative background",
          "relevance_tags": ["research", "ml", "quantitative"]
        },
        {
          "id": 119,
          "include": true,
          "confidence": 0.85,
          "reason": "Shows deep statistical and ML algorithm experience - supports advanced degree requirement",
          "relevance_tags": ["statistics", "ml", "algorithms", "quantitative"]
        },
        {
          "id": 120,
          "include": true,
          "confidence": 0.82,
          "reason": "Additional evidence of mentoring and supervision capabilities",
          "relevance_tags": ["mentoring", "supervision"]
        },
        {
          "id": 121,
          "include": true,
          "confidence": 0.88,
          "reason": "Publications in IEEE demonstrate advanced quantitative field expertise",
          "relevance_tags": ["publications", "ieee", "quantitative", "research"]
        },
        {
          "id": 100,
          "include": false,
          "confidence": 0.7,
          "reason": "Early career role, less relevant for Lead position, limited direct ML/AI focus",
          "relevance_tags": ["early_career", "analytics"]
        },
        {
          "id": 122,
          "include": false,
          "confidence": 0.65,
          "reason": "Early career progression, not directly relevant to current Lead role requirements",
          "relevance_tags": ["early_career", "network_analysis"]
        },
        {
          "id": 123,
          "include": false,
          "confidence": 0.6,
          "reason": "Technical details from early career, not relevant to current ML/AI focus",
          "relevance_tags": ["early_career", "cpp", "java"]
        },
        {
          "id": 124,
          "include": false,
          "confidence": 0.55,
          "reason": "Early career project work, not directly relevant to DS/ML leadership role",
          "relevance_tags": ["early_career", "qoe"]
        },
        {
          "id": 125,
          "include": false,
          "confidence": 0.58,
          "reason": "Early career international projects, less relevant than current AI/ML work",
          "relevance_tags": ["early_career", "international_projects"]
        },
        {
          "id": 126,
          "include": false,
          "confidence": 0.62,
          "reason": "Early career technical work, not as relevant as current ML/AI leadership",
          "relevance_tags": ["early_career", "development"]
        },
        {
          "id": 127,
          "include": false,
          "confidence": 0.6,
          "reason": "Early career project contributions, less impactful than current achievements",
          "relevance_tags": ["early_career", "projects"]
        },
        {
          "id": 128,
          "include": true,
          "confidence": 0.95,
          "reason": "Essential section header - education is a must-have requirement",
          "relevance_tags": ["structure", "education"]
        },
        {
          "id": 129,
          "include": true,
          "confidence": 0.98,
          "reason": "PhD in quantitative field - directly matches 'Advanced degree in quantitative field' must-have requirement",
          "relevance_tags": ["phd", "quantitative", "advanced_degree", "must_have"]
        },
        {
          "id": 130,
          "include": true,
          "confidence": 0.85,
          "reason": "Master's degree supports advanced quantitative background",
          "relevance_tags": ["masters", "quantitative", "engineering"]
        },
        {
          "id": 131,
          "include": true,
          "confidence": 0.95,
          "reason": "Essential section header for skills",
          "relevance_tags": ["structure", "skills"]
        },
        {
          "id": 132,
          "include": true,
          "confidence": 0.95,
          "reason": "Technical skills section header - important for ATS matching",
          "relevance_tags": ["structure", "technical_skills"]
        },
        {
          "id": 134,
          "include": true,
          "confidence": 0.98,
          "reason": "Perfect match - Python (must-have), R and MATLAB (nice-to-have), SQL all listed as requirements",
          "relevance_tags": ["python", "r", "matlab", "sql", "must_have"]
        },
        {
          "id": 135,
          "include": true,
          "confidence": 0.96,
          "reason": "Core ML and AI skills directly relevant to DS/ML/AI experience requirement",
          "relevance_tags": ["ml", "ai", "generative_ai"]
        },
        {
          "id": 136,
          "include": true,
          "confidence": 0.75,
          "reason": "Data visualization skills relevant but not core requirements",
          "relevance_tags": ["visualization", "analytics"]
        },
        {
          "id": 137,
          "include": true,
          "confidence": 0.92,
          "reason": "Containers listed as technical requirement - good match",
          "relevance_tags": ["containers", "orchestration"]
        },
        {
          "id": 138,
          "include": true,
          "confidence": 0.96,
          "reason": "Perfect match - CI/CD and MLOps both listed as technical requirements",
          "relevance_tags": ["cicd", "mlops", "must_have"]
        },
        {
          "id": 139,
          "include": true,
          "confidence": 0.94,
          "reason": "Cloud infrastructure management supports AWS requirement",
          "relevance_tags": ["cloud", "aws", "infrastructure"]
        },
        {
          "id": 133,
          "include": true,
          "confidence": 0.9,
          "reason": "Professional skills section relevant for Lead role",
          "relevance_tags": ["structure", "professional_skills"]
        },
        {
          "id": 140,
          "include": true,
          "confidence": 0.94,
          "reason": "Leadership and management skills essential for Lead role - matches 2+ years leading teams",
          "relevance_tags": ["leadership", "management", "must_have"]
        },
        {
          "id": 141,
          "include": true,
          "confidence": 0.88,
          "reason": "Strategic planning relevant for Lead position",
          "relevance_tags": ["strategy", "planning"]
        },
        {
          "id": 142,
          "include": true,
          "confidence": 0.98,
          "reason": "Perfect match - 10+ years ML experience exceeds 6-10+ years DS/ML/AI requirement",
          "relevance_tags": ["ml", "experience", "must_have"]
        },
        {
          "id": 143,
          "include": true,
          "confidence": 0.92,
          "reason": "Project management skills important for Lead role and program leadership",
          "relevance_tags": ["project_management", "leadership"]
        },
        {
          "id": 144,
          "include": true,
          "confidence": 0.9,
          "reason": "Analytical and statistical skills support quantitative background and evidence-based decision making",
          "relevance_tags": ["analytics", "statistics", "evidence_based"]
        },
        {
          "id": 146,
          "include": false,
          "confidence": 0.95,
          "reason": "Appears to be irrelevant text/error - should be excluded",
          "relevance_tags": ["irrelevant", "error"]
        }
      ],
      "selection_summary": {
        "total_nodes": 61,
        "recommended_include": 54,
        "recommended_exclude": 7
      },
      "tailoring_strategy": "This CV is exceptionally well-matched for the Lead Data Science role. The strategy focuses on highlighting the candidate's perfect alignment with must-have requirements: PhD in quantitative field, 10+ years ML experience, current Lead role with 4+ years duration, hands-on Python expertise, extensive AWS experience (Bedrock, SageMaker, Lambda, Step Functions), production RAG/retrieval systems experience, and strong MLOps capabilities. The candidate demonstrates the rare combination of technical depth and leadership breadth required for senior roles. Only early career positions and irrelevant content were excluded to maintain focus on leadership-level achievements and current technical relevance. The summary bullets effectively showcase the hands-on technical leadership style that balances strategic oversight with deep technical involvement."
    }
  },
  "total_nodes": 70
};
