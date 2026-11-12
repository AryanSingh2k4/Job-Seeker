# ATS Analysis, Candidate Profile & AI Resume/Cover Letter Tailoring Engine
## Technical Specification & Architecture Design

**Author:** `@matcher` (JobSeeker Swarm)
**Target:** `@architect`
**Document Version:** 2.1.0 (selection-only enforcement revision)
**Status:** Ready for System Architecture Integration  

---

## 1. Candidate Master Profile Data Model

The **Candidate Master Profile** is the single source of truth (Ground Truth) for all application generation. It holds superset data—far more than fits on a single resume—enabling dynamic slicing and tailoring.

### 1.0 Resume Import: Draft-then-Confirm (mandatory flow)

Existing resumes are the usual on-ramp, but **an LLM parse of a PDF is never trusted silently** — a mis-parsed bullet becomes a false claim on every generated resume.

```
[Upload PDF/DOCX] -> [LLM extraction into DRAFT structure]
      -> every imported bullet/skill flagged `verified = false`
      -> Website review UI: user confirms, edits, or deletes each item
      -> only user-confirmed facts enter the master profile
```

- Import is a **draft generator**, not a source of truth.
- Drafts are persisted in `resume_import_drafts` (`status = DRAFT`) and are never read by the matcher. Only `POST /api/v1/profile/import-resume/confirm` copies accepted items into master tables with `verified = 1`.
- The bullet-pool editor renders imported metrics as locked chips awaiting confirmation; unverified bullets are visually flagged until confirmed.
- API: `POST /api/v1/profile/import-resume` (returns draft) → `POST /api/v1/profile/import-resume/confirm` (commits verified facts).

### 1.1 JSON Schema / Pydantic Data Structures

```python
from pydantic import BaseModel, Field, HttpUrl, EmailStr
from typing import List, Optional, Dict, Literal
from datetime import date

class ContactInfo(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    city: str
    state: str
    country: str
    postal_code: Optional[str] = None
    linkedin_url: Optional[HttpUrl] = None
    github_url: Optional[HttpUrl] = None
    portfolio_url: Optional[HttpUrl] = None
    citizenship: List[str]
    current_work_authorization: str  # e.g., "US Citizen", "Green Card", "H1B", "OPT", "F1", "EU Citizen"
    requires_sponsorship: bool
    requires_future_sponsorship: bool

class SkillItem(BaseModel):
    id: str  # e.g., "sk_python"
    canonical_name: str  # "Python"
    category: Literal["languages", "frameworks", "databases", "cloud_devops", "tools", "architecture_patterns", "soft_skills"]
    proficiency: Literal["beginner", "intermediate", "advanced", "expert"]
    years_of_experience: float
    last_used_year: int
    aliases: List[str] = []  # ["py", "python3"]

class BulletPoint(BaseModel):
    id: str  # unique id for audit trail
    raw_text: str  # Original factual text
    action_verb: str
    skills_used: List[str]  # IDs referencing SkillItem
    metrics_quantified: List[str]  # e.g., ["45% latency reduction", "$120k cost savings", "10M DAU"]
    domain_tags: List[str]  # ["backend", "distributed_systems", "microservices"]
    priority_score: float = 1.0  # Default importance weight

class WorkExperience(BaseModel):
    id: str
    company_name: str
    company_url: Optional[HttpUrl] = None
    role_title: str
    location: str
    location_type: Literal["onsite", "hybrid", "remote"]
    start_date: str  # "YYYY-MM"
    end_date: Optional[str] = None  # None if current
    is_current: bool = False
    bullet_pool: List[BulletPoint]
    technologies: List[str]

class Education(BaseModel):
    id: str
    institution: str
    degree: str  # e.g., "Bachelor of Science"
    field_of_study: str  # "Computer Science"
    start_date: str
    end_date: str
    gpa: Optional[str] = None
    honors: List[str] = []
    relevant_coursework: List[str] = []

class Project(BaseModel):
    id: str
    name: str
    role: str
    repo_url: Optional[HttpUrl] = None
    live_url: Optional[HttpUrl] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    bullet_pool: List[BulletPoint]
    technologies: List[str]

class Certification(BaseModel):
    id: str
    name: str
    issuing_organization: str
    issue_date: str
    expiration_date: Optional[str] = None
    credential_id: Optional[str] = None
    verification_url: Optional[HttpUrl] = None

class ScreeningQAPair(BaseModel):
    category: Literal["work_auth", "salary", "experience", "notice_period", "relocation", "diversity", "general"]
    question_canonical: str  # e.g., "years_experience_python", "target_salary_min", "willing_to_relocate"
    question_patterns: List[str]  # regex or phrase triggers
    answer_value: str
    answer_type: Literal["text", "number", "boolean", "select_option"]

class CandidateMasterProfile(BaseModel):
    user_id: str
    contact: ContactInfo
    summary_baseline: str
    experiences: List[WorkExperience]
    education: List[Education]
    projects: List[Project]
    skills: List[SkillItem]
    certifications: List[Certification]
    qa_screening_answers: List[ScreeningQAPair]
    target_job_preferences: Dict[str, any] = Field(default_factory=dict)
```

---

## 2. Job Description Analysis & Entity Extraction Engine

Raw scraped job postings from LinkedIn, Indeed, Greenhouse, Lever, and Workday are messy and contaminated with company boilerplate, EEO statements, and recruiter filler.

### 2.1 Extraction Pipeline Flow
```
[Raw Scraped JD (HTML/Text)]
            │
            ▼
[Preprocessing & Noise Stripper] (Regex filters for EEO, Benefits, Legal boilerplate)
            │
            ▼
[LLM Structured Extractor] (Instructor / Pydantic schema validation)
            │
            ▼
[Entity Canonicalizer] (Fuzzy + Embedding match against standard Taxonomy)
            │
            ▼
[ParsedJobProfile Object]
```

### 2.2 Parsed Job Schema (`ParsedJobProfile`)
```python
class ParsedJobProfile(BaseModel):
    job_id: str
    title_raw: str
    title_normalized: str  # e.g., "Senior Software Engineer" -> "SENIOR_BACKEND_ENGINEER"
    seniority_level: Literal["intern", "entry", "mid", "senior", "lead", "staff", "principal", "director"]
    min_years_experience: float
    required_hard_skills: List[str]  # Canonical skill names
    preferred_hard_skills: List[str]
    soft_skills: List[str]
    core_responsibilities: List[str]
    domain_keywords: List[str]  # Industry domain terms (e.g., "Fintech", "HIPAA", "Kubernetes", "PCI-DSS")
    education_minimum: Optional[str] = None
    work_location_type: Literal["remote", "hybrid", "onsite"]
    allowed_locations: List[str]
    visa_sponsorship_statement: Literal["supported", "not_supported", "unknown"]
    salary_range: Optional[Dict[str, Optional[float]]] = None  # {"min": 140000, "max": 180000, "currency": "USD"}
    summary_mission: str  # 1-sentence synopsis of what the team builds
```

### 2.3 Extraction Prompt Strategy
- Employs **few-shot structured outputs** with strict JSON schema enforcement.
- Separates **hard requirements** ("Must have 5+ years Go") from **preferred/nice-to-have** ("Experience with Kafka is a plus").
- Taxonomy canonicalization maps variants (e.g. `['k8s', 'kube', 'kubernetes']` -> `Kubernetes`).

---

## 3. Semantic Matching & Compatibility Scoring

A multi-tiered composite scoring algorithm guarantees high precision, prevents spamming unviable applications, and ranks jobs intelligently.

### 3.1 Composite Scoring Formula

$$\text{FinalMatchScore} = \text{HardGateMultiplier} \times \left( W_{\text{req}} \cdot S_{\text{req}} + W_{\text{pref}} \cdot S_{\text{pref}} + W_{\text{vec}} \cdot S_{\text{vec}} + W_{\text{llm}} \cdot S_{\text{llm}} + W_{\text{exp}} \cdot S_{\text{exp}} \right)$$

Where default weights are:
- $W_{\text{req}} = 0.35$ (Required Skills Match)
- $W_{\text{pref}} = 0.15$ (Preferred Skills Match)
- $W_{\text{vec}} = 0.20$ (Vector Semantic Similarity)
- $W_{\text{llm}} = 0.20$ (Qualitative Role Alignment Evaluation)
- $W_{\text{exp}} = 0.10$ (Years of Experience Alignment)

### 3.2 Gatekeeper / Hard Filters ($\text{HardGateMultiplier} \in \{0, 1\}$)
If any gate fails, the multiplier is **0** (Immediate Disqualification):
1. **Visa Sponsorship Mismatch**: Job explicitly says "No Sponsorship / US Citizens Only" and Candidate requires visa sponsorship.
2. **Location Restriction Mismatch**: Job is strictly onsite in NYC, candidate is remote in Berlin.
3. **Severe Seniority Gap**: Job requires 8+ years, candidate has <1.5 years (or vice-versa for internships).

### 3.3 Metric Calculation Breakdown
1. **Skills Jaccard/Overlap Score ($S_{\text{req}}$, $S_{\text{pref}}$)**:
   $$S_{\text{req}} = \frac{|\text{CandidateSkills} \cap \text{JobRequiredSkills}|}{|\text{JobRequiredSkills}|}$$
2. **Dense Vector Semantic Score ($S_{\text{vec}}$)**:
   - Embed candidate’s aggregated experience summary and project highlights vs. the job's core responsibilities and mission using `text-embedding-3-small` or local `all-MiniLM-L6-v2`.
   - Cosine similarity normalized to $[0, 1]$.
3. **LLM Qualitative Evaluation ($S_{\text{llm}}$)**:
   - Fast evaluator evaluates candidate trajectory vs job expectations.
   - Outputs: Match score (0-100), key strengths, critical missing requirements, and tailoring suggestions.

### 3.4 Triage Action Thresholds
- **$\ge 80\%$ (High Match)**: Auto-approve for resume tailoring and application staging.
- **$65\% - 79\%$ (Moderate Match)**: Tailor resume, stage in queue for Human-in-the-Loop (HITL) review.
- **$< 65\%$ (Low Match)**: Auto-skip or archive; log reason for candidate transparency.

---

## 4. Dynamic Resume Tailoring Engine & Anti-Fabrication Guardrail

### 4.1 Strict Zero-Hallucination Policy
> **Iron Rule:** The AI generator MUST NOT invent companies, credentials, employment dates, certifications, or fabricate experiences.

#### Allowed Tailoring Operations:
1. **Relevance Filtering & Selection**: Pick the top $K$ relevant work experiences and top $M$ projects from the master pool that directly match the JD.
2. **Bullet Re-ranking & Selection**: Under each role, select the 3-5 bullets from the master pool that demonstrate skills requested by the JD.
3. **Verbatim bullet use only**: selected bullets are copied byte-for-byte (after whitespace normalization) from the verified master bullet, including every number and unit. No rewriting, rephrasing, or keyword stuffing. JD vocabulary is aligned only by *choosing* which verified bullets to show.
4. **Skills Section Reordering**: Place matching hard skills at the front of each skills category.
5. **Baseline summary selection**: choose one pre-written, user-approved `summary_baseline` sentence (or none). Never synthesize a new summary.

### 4.2 Two-Stage Generation & Verification Pipeline
```
[Candidate Master Profile] + [Parsed Job Profile]
                      │
                      ▼
[LLM Tailoring Generator] (Pydantic Output: TailoredResumeSchema)
                      │
                      ▼
[Deterministic Fact-Diff Guardrail]
  - Compares tailored bullets vs master bullets
  - Validates: verbatim text equality (whitespace-normalized), no new numbers,
    no invented tools, no unearned titles
                      │
         ┌────────────┴────────────┐
       [PASS]                    [FAIL]
         │                         │
         ▼                         ▼
[PDF Render Engine]        [Reject & Fallback to Master Baseline]
```

### 4.3 Rendering Engine: Typst & HTML-to-PDF

#### Why Typst is the Recommended Standard:
- **Speed**: A single self-contained binary; small resume documents typically compile in tens of milliseconds (vs. pdflatex at 2-4 seconds with a 4GB TeXLive runtime).
- **Determinism**: Zero layout shifts or page-overflow quirks.
- **ATS Compliance — enforced by our own test, not asserted**: the pipeline includes a **round-trip verification** — compile the template, extract text with `pdfminer`/`pypdf`, and assert (a) single-column reading order and (b) 100% retention of bullets, skills, and keywords. A template that fails the round-trip does not ship. No external parser has been "verified" — this test is the verification.
- **Template Architecture**:
  - `templates/ats_classic.typ` (Single column, bold serif headers, must pass round-trip test).
  - `templates/modern_clean.typ` (Clean sans-serif, optimized spacing, must pass round-trip test).

#### Alternative: HTML/Tailwind + Playwright Print
- Playwright is already present in the JobSeeker stack for application submission.
- Uses `page.pdf(format='Letter', print_background=True, margin=...)`.

---

## 5. Tailored Cover Letter Generator

Recruiters spend an average of 15-30 seconds scanning cover letters; generic AI cover letters ("I am thrilled to express my profound excitement...") get discarded instantly.

### 5.1 Dynamic 3-Paragraph High-Signal Blueprint

| Paragraph | Core Objective | Content & Strategy |
|---|---|---|
| **P1: The Hook & Role Alignment** | Direct, no-fluff statement of target role & immediate relevance. | State role, why this company's product/engineering mission resonates, and summary of directly relevant years of experience. |
| **P2: The Proof Point (Deep Dive)** | Connect 1 specific master project to the JD's #1 core problem. | Detail a real project from the candidate's history, the technical stack used, and the quantified business impact (e.g., latency, revenue, scale). |
| **P3: Domain Synergy & Close** | Address secondary technical needs and state immediate availability. | Highlight alignment on working style, remote/hybrid readiness, and a clean professional call to action. |

### 5.2 Cover Letter Parameters
- **Length Constraint**: Strictly 250-320 words (1 single page, large margins, matching resume typography).
- **Tone Selector**:
  - `technical_direct`: No fluff, focuses on architecture, metrics, and technical contributions (ideal for engineering/devops roles).
  - `startup_collaborative`: Energetic, cross-functional impact, speed of execution (ideal for early-stage startups).
  - `enterprise_formal`: Professional, governance, scale, and stakeholder communication (ideal for Fortune 500 / financial institutions).
- **Dual Output Format**:
  - `cover_letter.txt`: Plain text for direct insertion into web form textareas (e.g. Lever, Greenhouse).
  - `cover_letter.pdf`: Styled PDF matching the resume's exact typography and header block for file uploads.

---

## 6. Integration Contract & Public APIs for Other Agents

To seamlessly plug into `@crawler` (input source) and `@applier` (execution consumer), the Matcher engine exposes the following clean interfaces:

```python
class MatchingEngineAPI:
    def import_resume(self, pdf_bytes: bytes) -> DraftProfile:
        """Extracts a DRAFT profile from an existing resume (all bullets unverified).
        Must be followed by user confirmation before facts enter the master profile."""
        ...

    def parse_job_description(self, raw_jd: str) -> ParsedJobProfile:
        """Parses and canonicalizes raw JD text."""
        ...

    def compute_match_score(
        self, profile: CandidateMasterProfile, job: ParsedJobProfile
    ) -> MatchScoreResult:
        """Computes multi-dimensional compatibility score & gate status."""
        ...

    def generate_tailored_resume(
        self, profile: CandidateMasterProfile, job: ParsedJobProfile, format: Literal["pdf", "typst", "json"] = "pdf"
    ) -> TailoredResumeArtifact:
        """Generates verified tailored resume with anti-hallucination guardrail."""
        ...

    def generate_cover_letter(
        self, profile: CandidateMasterProfile, job: ParsedJobProfile, tone: str = "technical_direct"
    ) -> CoverLetterArtifact:
        """Generates targeted cover letter in plain text and PDF formats."""
        ...

    def resolve_screening_question(
        self, question_text: str, profile: CandidateMasterProfile
    ) -> ScreeningAnswerResponse:
        """Maps an unexpected form screening question to candidate's QA profile using LLM."""
        ...
```

---

## 7. LLM Cost Model & Cheap-First Routing (mandatory)

Every LLM-touching operation in this engine must pass through the routing ladder below — a frontier model is only invoked when the cheaper layers cannot resolve the task:

```
1. Deterministic (regex/rules)          ~0ms   $0        -> pre-filter, Tier-1 Q&A, hard gates
2. Local embeddings (MiniLM + sqlite-vec) ~ms  $0       -> S_vec, skill canonicalization, dedup
3. Frontier LLM (LiteLLM-routed)        ~2-5s  paid     -> JD extraction, S_llm, tailoring, cover letters
```

**Cost envelope (order of magnitude, to be re-measured after Week 1):**
- JD extraction ≈ 2-4k tokens · S_llm eval ≈ 1.5k · tailoring ≈ 3k · cover letter ≈ 1k → **~8-10k tokens per tailored job**
- At ~20 tailored jobs/day plus scoring of the wider funnel: roughly **0.3-0.5M tokens/day** — single-digit dollars/day on current frontier pricing, cents with a local model fallback.
- A configurable **monthly budget cap** (tracked in `app_settings`) pauses frontier calls and degrades to local-only scoring with reduced accuracy, visibly flagged in the UI — the system never silently overspends.
