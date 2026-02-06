# User Guide - ResumeConverter

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Resume Management](#resume-management)
4. [Missions](#missions)
5. [Profile Matching](#profile-matching)
6. [Resume Adaptations](#resume-adaptations)
7. [AI Assistant](#ai-assistant)
8. [Administration](#administration)
9. [Interface and Navigation](#interface-and-navigation)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [FAQ](#faq)
13. [Roadmap](#roadmap)
14. [Glossary](#glossary)
15. [Support](#support)

---

## Introduction

### What is ResumeConverter?

**ResumeConverter** is an AI-powered resume management and optimization platform. Designed for staffing agencies and recruitment firms, it allows you to:

- **Analyze** resumes with detailed AI evaluation
- **Improve** resume quality and impact automatically
- **Adapt** resumes for specific missions or positions
- **Anonymize** resumes to protect candidate identity
- **Track** performance with detailed scores
- **Export** resumes to PDF format

### Why Use ResumeConverter?

- **Time savings**: Automated analysis and improvement
- **ATS optimization**: Maximum compatibility with recruitment systems
- **Personalization**: Intelligent adaptation for each opportunity
- **Confidentiality**: Anonymous mode with trigram to protect identity
- **Centralized tracking**: Manage all your resumes in one place

---

## Quick Start

### First Login

1. Access the application via your browser
2. Log in with credentials provided by your administrator
3. Explore the dashboard displaying your main statistics

### Typical Workflow

```
1. Import a resume → 2. Analyze → 3. Improve → 4. Create a mission → 5. Adapt the resume → 6. Export
```

---

## Resume Management

### Importing a Resume

#### Supported Formats

- **PDF** (.pdf) - Recommended for best accuracy
- **Microsoft Word** (.docx, .doc)
- **Maximum size**: 50 MB

#### Import Process

1. Go to **"Resume Library"** in the side menu
2. Click the **"Upload a new resume"** button
3. Drag and drop your file or click to select
4. Analysis starts automatically

#### What Happens After Import?

The AI automatically performs:

1. **Text extraction**: Reading document content
2. **Structural analysis**: Identifying sections (experience, education, etc.)
3. **Skills detection**: Extracting technical and soft skills
4. **Multi-criteria evaluation**: Assigning scores across 6 dimensions
5. **Suggestion generation**: Improvement recommendations

**Analysis time**: 10-30 seconds depending on resume complexity

### Understanding Scores

Each resume receives a detailed evaluation across **6 categories**:

#### 1. Executive Summary
- **Evaluates**: Hook quality, value proposition clarity
- **Criteria**: Impact, conciseness, relevance

#### 2. Skills
- **Evaluates**: Skills presentation and relevance
- **Criteria**: Organization, technical/soft skills balance, keywords

#### 3. Professional Experience
- **Evaluates**: Experience clarity and impact
- **Criteria**: Quantified results, action verbs, progression

#### 4. Education
- **Evaluates**: Academic background presentation
- **Criteria**: Clarity, relevance, certifications

#### 5. ATS Compatibility
- **Evaluates**: Ability to pass automated recruiter filters
- **Criteria**: Keywords, formatting, structure

#### 6. Hobbies & Languages
- **Evaluates**: Additional information
- **Criteria**: Relevance, language proficiency

#### Global Score

The **global score** is a weighted average of the 6 categories. Weights can be configured by the administrator.

**Interpretation**:
- **80-100%**: Excellent - Optimized resume
- **60-79%**: Good - Some improvements possible
- **40-59%**: Average - Improvements recommended
- **0-39%**: Low - Revision needed

### Viewing a Resume

Click on a resume in the **"Resume Library"** list to access its detailed view with multiple tabs:

#### Overview Tab
- Visual scores with radar charts
- Main information (name, title, client)
- Detected tags and skills
- Quick actions (improve, export, delete)

#### Skills & Tags Tab
- Complete list of detected skills
- Categorization: technical skills, soft skills, tools, industries

#### Original Tab
- View of extracted text from original resume
- File metadata

#### Improved Tab
- AI-generated optimized version
- Editable with rich text editor
- Export to PDF with template selection

### Improving a Resume

1. Open an analyzed resume
2. Click the **"Improve Resume"** button
3. The AI generates an optimized version with:
   - Reformulation for greater impact
   - ATS keyword optimization
   - Achievement highlighting
   - Professional structure

**Note**: In anonymous mode, the improved resume will not contain personally identifiable information.

### Exporting a Resume

1. Open a resume (Improved tab)
2. Click **"Export"**
3. Choose the formatting template
4. The PDF file downloads automatically

---

## Missions

### What is a Mission?

A **mission** represents a professional opportunity (position, project, contract) for which you want to adapt resumes.

### Creating a Mission

1. Go to **"Missions"** in the menu
2. Click **"New Mission"**
3. Fill in the form:

| Field | Description | Required |
|-------|-------------|----------|
| **Title** | Position title | Yes |
| **Client** | Client company | Yes |
| **Description** | Detailed position description | Yes |

#### Tips for an Effective Description

**Include**:
- Complete job description
- Main responsibilities
- Required technical skills
- Desired soft skills
- Company context

**Avoid**:
- Descriptions that are too short (< 100 words)
- Vague or generic information

### Managing Missions

The Missions page displays all your opportunities with:
- Title and company
- Number of adapted resumes
- Creation date
- Actions (view, edit, delete)

---

## Profile Matching

### What is Profile Matching?

**Profile Matching** is a powerful feature that automatically finds the best resumes in your database for a given mission. The AI analyzes the skills required by the mission and compares them to available profiles.

### Accessing Profile Matching

1. Go to **"Profile Matching"** in the sidebar menu
2. Select a mission from the dropdown
3. Click **"Search"**

### How Does Matching Work?

#### Step 1: Keyword Extraction

During the first search for a mission, the AI automatically extracts keywords from the description:
- **Technical skills**: Languages, frameworks, methodologies
- **Tools**: Software, platforms, technologies
- **Industries**: Sectors, areas of expertise
- **Soft skills**: Personal qualities, behavioral competencies

These keywords are cached to speed up subsequent searches.

#### Step 2: Profile Scoring

Each resume is evaluated across 4 categories with configurable weights:

| Category | Default Weight | Description |
|----------|----------------|-------------|
| **Skills** | 40% | Technical skills |
| **Tools** | 25% | Software and technologies |
| **Industries** | 20% | Sector experience |
| **Soft Skills** | 15% | Personal qualities |

The initial score is a weighted average of these 4 categories.

#### Step 3: Title-Based Refinement

The AI then analyzes each candidate's **job title** against the mission requirements:

- A highly relevant title (e.g., "Lead React Developer" for a senior React mission) can add up to **+15 points**
- A less relevant title (e.g., "Project Manager" for a pure technical mission) can subtract up to **-15 points**
- A generic title ("Consultant", "Engineer") has a neutral impact

This adjustment helps better rank candidates whose profile matches the target position. The adjustment is visible on each profile card with a colored badge (green = bonus, red = penalty) and an explanation.

### Customizing Weights

1. Click **"Advanced Options"** below the mission selector
2. Adjust the sliders for each category
3. Weights automatically rebalance to total 100%
4. Re-run the search to apply new weights

### Understanding Results

#### Profile Card

Each found profile displays:
- **Name and title** of the candidate
- **Overall score** (match percentage)
- **Category scores**: Skills, Tools, Industries, Soft Skills

#### Profile Details

Click on a card to see details:

**Matched skills** (in green):
- Resume tags that match mission requirements
- Organized by category (Skills, Tools, Industries, Soft Skills)

**Missing skills** (in red):
- Tags required by the mission but absent from the resume
- Helps identify candidate gaps

### AI Detailed Analysis

For deeper insights, you can request an **in-depth AI analysis**:

1. Click **"Analyze profile"** on a profile card
2. The AI generates a comprehensive report including:

| Section | Description |
|---------|-------------|
| **Verdict** | Overall assessment (Excellent match, Good match, etc.) |
| **Summary** | 2-3 sentence synthesis of the fit |
| **Strengths** | Candidate's assets for this mission |
| **Gaps** | Missing skills with criticality level |
| **Recommendations** | Advice for the candidate or recruiter |
| **Interview Questions** | Suggested questions to validate uncertain points |
| **Risk Level** | Recruitment risk assessment |

#### Gap Criticality Levels

- **Critical** (red): Essential skill missing
- **Important** (orange): Important but not blocking skill
- **Minor** (yellow): Secondary skill, easy to acquire

#### Recommendation Types

- **Highlight** (green): Points to emphasize during interview
- **Develop** (blue): Skills to develop quickly
- **Acquire** (purple): Recommended training or certifications

### Available Actions

From a profile, you can:
- **Analyze profile**: Launch detailed AI analysis
- **View Resume**: Access the full resume details

### Refresh Keywords

If you modify a mission description, click the **"Refresh"** button (refresh icon) to force the AI to re-extract keywords.

### Best Practices

1. **Detailed descriptions**: The more detailed the mission, the more accurate the matching
2. **Adjust weights**: Adapt weights according to the relative importance of criteria
3. **Analyze top profiles**: Use detailed analysis for the top 3-5 candidates
4. **Check gaps**: Missing skills can be discussion points during interviews

---

## Resume Adaptations

### What is an Adaptation?

An **adaptation** is a customized version of a resume, optimized for a specific mission. The AI analyzes the match between the profile and the offer, then generates a tailored resume.

### Creating an Adaptation

#### From a Resume

1. Open a resume in the Resume Library
2. Click **"Adapt to a mission"**
3. Select the target mission
4. Click **"Generate adaptation"**

#### From a Mission

1. Open a mission
2. Click **"Adapt a resume"**
3. Select the resume to adapt
4. Click **"Generate adaptation"**

### Match Analysis

The AI performs a multi-step analysis:

1. **Skills Matching**: Comparison with required skills
2. **Contextual Analysis**: Evaluation of relevant experience
3. **Match Score**: Score from 0 to 100

**Score interpretation**:
- **80-100**: Excellent match
- **60-79**: Good match
- **40-59**: Average match
- **0-39**: Low match

### Adaptation Content

- **Adapted Resume**: Customized version with reformulated summary, reorganized experiences, aligned skills
- **Analysis Report**: Detailed score, strengths, areas for improvement

---

## AI Assistant

### Accessing the Assistant

The AI assistant is available via the **chat button** (bubble icon) at the bottom right of the screen.

**Note**: The assistant can be disabled by an administrator. If you don't see the button, contact your administrator.

### Features

#### Contextual Help
- Explanations of application features
- Step-by-step task guidance
- Answers to frequently asked questions

#### Personalized Advice
- Recommendations for improving your resumes
- Skills suggestions
- Writing tips

### Example Questions

**About usage**:
- "How do I analyze a resume?"
- "How do I create an adaptation?"
- "How do I export to PDF?"

**About scores**:
- "Why is my ATS score low?"
- "How can I improve the skills score?"

**Technical questions**:
- "What file formats are supported?"
- "How long does analysis take?"

### Limitations

The assistant is designed to answer questions about **ResumeConverter** only. It cannot:
- Answer off-topic questions
- Give general career advice
- Write complete resumes
- Access your personal data

---

## Administration

*These features are reserved for users with the "Admin" role.*

### User Management

#### Creating a User

1. Go to **"Users"** in the admin menu
2. Click **"New user"**
3. Fill in: name, email, password, role, client

#### Roles and Permissions

| Role | Permissions |
|------|-------------|
| **User** | Manage own resumes, missions, adaptations |
| **Admin** | All permissions + user management, templates, settings |

### Resume Template Management

Templates define the structure and style of exported resumes.

1. Go to **"Resume Templates"**
2. Create or edit a template with the HTML/CSS editor
3. Set a default template

### System Settings

#### LLM Model Tab

**AI Model Selection**:
- GPT-4o (OpenAI) - Recommended
- GPT-4o-mini (OpenAI) - Faster
- Claude 3.5 Sonnet (Anthropic)
- Other available models

**CV Mode**:
- **Nominative**: Resumes retain all candidate personal information
- **Anonymous**: Personal information is replaced with a trigram (e.g., "JDO" for John Doe)

Anonymous mode automatically removes:
- First and last name (replaced by trigram)
- Email addresses
- Phone numbers
- LinkedIn, GitHub, portfolio links
- Postal address

#### Weighting Tab

Adjust the importance of each criterion in the global score:

| Category | Default Weight |
|----------|----------------|
| Executive Summary | 20% |
| Skills | 20% |
| Experience | 20% |
| Education | 15% |
| ATS | 15% |
| Hobbies & Languages | 10% |

#### Chatbot Tab

Enable or disable the AI assistant for all users.

### Security Logs

View security events:
- Successful and failed logins
- Permission changes
- Sensitive actions

### Metrics

View usage statistics:
- Number of analyzed resumes
- Adaptations created
- LLM token usage

---

## Interface and Navigation

### Visual Themes

- **Light Mode**: Bright interface
- **Dark Mode**: Dark interface, reduces eye strain

Click the sun/moon icon in the top bar to change theme.

### Languages

The application is available in:
- Français
- English

Use the language selector in the top bar.

### Navigation Structure

#### Side Menu

**Main Section**:
- Home (dashboard)
- Resume Library
- Missions
- Adaptations
- Resume Templates

**Admin Section** (if authorized):
- Users
- Security Logs
- Metrics
- Settings

#### Top Bar

- Logo: Return to home
- Theme: Toggle light/dark
- Language: FR/EN
- About: Information and changelog
- Profile and logout

---

## Best Practices

### For Quality Resumes

#### Before Import

- Use PDF format preferably
- Avoid complex columns and tables
- Ensure text is selectable (not a scan)
- Use standard fonts

#### Recommended Structure

1. Header (name, contact)
2. Professional summary
3. Experience (reverse chronological order)
4. Education
5. Skills
6. Languages and certifications

### For Effective Adaptations

- Create missions with detailed descriptions
- Include all required skills
- Specify company context
- Review and personalize generated adaptations

### Recommended Workflow

```
1. Import original resume
   ↓
2. Automatic analysis
   ↓
3. AI improvement
   ↓
4. Manual review if needed
   ↓
5. Create targeted missions
   ↓
6. Generate adaptations
   ↓
7. Export and send
```

---

## Troubleshooting

### Common Issues

#### Resume Won't Import

**Possible causes**:
- Unsupported format (use PDF or DOCX)
- Corrupted or password-protected file
- Size exceeds 50 MB
- Scanned PDF (image without text)

**Solutions**:
- Check file format
- Re-export the resume from the original application
- Use a PDF with selectable text

#### Analysis Takes Too Long

**Normal time**: 10-30 seconds

**If > 1 minute**:
- Refresh the page
- Check your internet connection
- Retry the analysis

#### Scores Seem Incorrect

- Check that the resume is well-structured
- View the extracted text (Original tab)
- Reorganize the resume if needed and rerun analysis

#### Cannot Log In

- Check your credentials (email and password)
- Verify your account is active
- Contact an administrator

#### PDF Export Not Working

- Verify the improved resume is generated
- Try a different browser
- Disable pop-up blockers

### Reporting a Bug

1. Note what you were doing and the error message
2. Take a screenshot if possible
3. Contact your administrator

### Performance Tips

- Use Chrome, Firefox, or Edge (recent versions)
- Stable internet connection
- Clear cache if display issues occur

---

## FAQ

### General Questions

**Q: How many resumes can I import?**
A: No limit. You can import as many resumes as needed.

**Q: Is my data secure?**
A: Yes, all data is stored securely and accessible only to authorized users.

**Q: Does the application work offline?**
A: No, an internet connection is required.

### Analysis Questions

**Q: How does the AI analyze resumes?**
A: The AI uses advanced language models to extract, analyze, and evaluate content according to recruitment best practices.

**Q: Can I modify evaluation criteria?**
A: Administrators can adjust category weights in settings.

**Q: Why is my ATS score low?**
A: A low ATS score typically indicates complex formatting, lack of keywords, or non-standard structure.

### Anonymous Mode Questions

**Q: What is anonymous mode?**
A: Anonymous mode replaces candidate personal information with a trigram (3 letters) and removes contact details.

**Q: How is the trigram generated?**
A: The trigram consists of the first letter of the first name and the first two letters of the last name (e.g., "JDO" for John Doe).

**Q: Can I switch between nominative and anonymous mode?**
A: Yes, the administrator can change the mode in settings. The change applies to new analyses and improvements.

### Chatbot Questions

**Q: I don't see the chatbot button, why?**
A: The assistant can be disabled by an administrator. Contact your administrator to enable it.

**Q: Are conversations saved?**
A: No, conversations are cleared when you close the chat window.

### Technical Questions

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, Edge (recent versions).

**Q: Is the application mobile-friendly?**
A: Yes, the interface adapts to tablets and smartphones.

---

## Roadmap

ResumeConverter is constantly evolving. Here are the improvements planned for upcoming versions:

### ESCO Integration

Integration of the **ESCO** (European Skills, Competences, Qualifications and Occupations) framework is under consideration. This evolution will enable:

- **France Travail Compatibility**: Using skills aligned with the official French employment agency framework
- **European Standardization**: Skills recognized throughout the European Union
- **Better Interoperability**: Easier exchanges with institutional recruitment systems

### Advanced Skills Management

A redesign of CV skills management is being considered to better distinguish:

- **Technical Environment**: Technologies, tools and platforms mastered (languages, frameworks, software)
- **Business Skills**: Functional know-how and expertise
- **Soft Skills**: Behavioral and interpersonal competencies

This distinction will allow for more refined analysis and more relevant recommendations.

### Technical Optimizations

Performance improvements are planned:

- **Server-side Loading**: Optimization of large data loading
- **Advanced Pagination**: Improved navigation in long lists
- **Performant Filtering**: Server-side filters for better responsiveness

### Continuous Fixes and Improvements

The team is constantly working on:

- **Bug Fixes**: Resolving issues reported by users
- **User Experience Enhancement**: More intuitive and fluid interface
- **New Features**: Based on user feedback

### Your Feedback is Valuable!

We strongly encourage users to share their comments, criticisms and suggestions for improvement. Every piece of feedback helps make the application better for everyone.

Don't hesitate to contact your administrator or use the AI assistant to share your ideas!

---

## Glossary

**ATS (Applicant Tracking System)**: Candidate tracking system used by recruiters to automatically filter resumes.

**Adaptation**: Customized version of a resume optimized for a specific mission.

**Trigram**: 3-letter code representing a candidate in anonymous mode.

**Match Score**: Measure (0-100) of the correspondence between a profile and a mission.

**LLM (Large Language Model)**: AI language processing model (GPT-4o, Claude, etc.).

**Nominative Mode**: Mode where the resume retains all personal information.

**Anonymous Mode**: Mode where personal information is replaced by a trigram.

**Soft Skills**: Behavioral competencies (communication, leadership, etc.).

**Hard Skills**: Measurable technical competencies (programming, languages, etc.).

---

## Support

### Getting Help

1. **AI Assistant**: Available 24/7 via the chat button
2. **This guide**: Complete documentation
3. **Administrator**: For questions specific to your organization

### Resources

- **Changelog**: View updates in "About"
- **API Documentation**: Swagger available for developers

---

**Last updated**: Version 1.3.0 - January 2026

**Recent updates**:
- Anonymous CV mode with trigram
- Progress overlay during analysis and improvement
- LLM prompt debugging (developer mode)
- Updated Swagger documentation

---

*For any questions about this documentation, contact your system administrator.*
