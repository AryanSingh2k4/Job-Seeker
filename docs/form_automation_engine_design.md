# Form Automation & Application Submission Engine — Technical Architecture (v2)

**Document Version:** 2.2.0 (Tauri 2 desktop revision — no Chrome extension, no CDP-attach to the user's daily Chrome; dashboard is a Next.js static export inside the shell)

## 1. Executive Summary & Core Mandate

The **Form Automation & Submission Engine** is the execution arm of JobSeeker: it navigates to application pages, fills multi-step forms, answers screening questions, uploads tailored documents, and submits — under strict safety controls, with a human final check by default.

v2 changes the execution runtime fundamentally:

| v1 (rejected) | v2 (selected) |
| :--- | :--- |
| Attach Playwright via CDP (`localhost:9222`) to the user's **daily** Chrome to inherit logins | A **dedicated, app-managed automation browser profile** launched headed by Playwright's persistent context; the user logs in once per platform |
| Manifest V3 Chrome extension with in-page floating HUD for review | **No extension.** The automation window is visible on the user's desktop; final review happens **in the page itself**, mirrored on the dashboard's Run Monitor |
| Review UI lived inside a content-script HUD | Review UI = the real final screen of the application form + the desktop dashboard |

---

## 2. Runtime Selection

### 2.1 Comparative Analysis

| Criteria | Standalone Headless Playwright | CDP-attach to user's daily Chrome | MV3 Chrome Extension | **Persistent Headed Context (dedicated profile)** ✔ |
| :--- | :--- | :--- | :--- | :--- |
| Bot-detection footprint | Poor (`navigator.webdriver`, headless UA, synthetic fingerprints) | Excellent (real daily profile) | Excellent (is the real browser) | **Excellent** (real Chrome, real hardware/IP fingerprint; persistent history & cookies accumulate organic trust) |
| Feasibility on current Chrome | Fine | **Broken**: Chrome ≥136 ignores `--remote-debugging-port` with the default user-data directory (security change against cookie theft — developer.chrome.com/blog/remote-debugging-port). The daily profile can no longer expose CDP. | Fine but… | **Fine** — `--user-data-dir` under app data is explicitly the supported path |
| Logins / 2FA | Re-login churn, checkpoint risk | Free (already logged in) | Free | **One-time per platform** via the login wizard; sessions persist indefinitely |
| Local file upload of generated PDFs | Native | Native | **Blocked** (MV3 sandbox cannot read arbitrary local files; needs Native Messaging bridge) | **Native** (`set_inputFiles` / CDP `DOM.setFileInputFiles`) |
| Long-running orchestration | Full | Full | **Fragile** (service workers die ~30s idle) | **Full** |
| Human takeover mid-run | Clunky (debug window) | Natural | Natural | **Natural** — it is a visible window on the user's desktop; user can grab the mouse at any time |
| Complexity / install burden | Low | Low | High (extension build, MV3 limitations, separate UI) | **Low** |

### 2.2 Selected Architecture

```
+--------------------------------------------------------------------------+
| JobSeeker Backend (FastAPI)                                               |
|   - Application state machine, queue, rate throttler                     |
|   - Browser Runtime Manager (launch / health / login wizard)             |
|   - Q&A Resolution Engine (deterministic -> LLM fallback)                |
|   - Supplies tailored PDFs from local storage                            |
+---------------------------+----------------------------------------------+
                            | Playwright persistent context (headed)
                            v
+--------------------------------------------------------------------------+
| Automation Chrome (dedicated --user-data-dir, VISIBLE window)            |
|   - Real Chrome binary + real hardware fingerprint + user's home IP      |
|   - Persistent logins: user signs in once per platform (2FA included)   |
|   - The USER WATCHES IT WORK; takeover at any moment by grabbing mouse   |
+--------------------------------------------------------------------------+
                            ^
                            | WebSocket stage events (/ws/telemetry)
                            v
+--------------------------------------------------------------------------+
| Website Dashboard — Run Monitor: live stepper, Q&A answers with          |
| provenance badges, CAPTCHA alerts, "Approve & Submit" for paused runs    |
+--------------------------------------------------------------------------+
```

**Why visible-and-dedicated beats stealth-and-attached:** Chrome 136 made attaching to the daily profile impossible, but the deeper point is operational — a dedicated profile still presents a genuine browser fingerprint and accumulates session history, while being watched by a human it behaves like one. Stealth tricks are not needed when the browser is real and the human is present.

---

## 3. Browser Runtime Manager

The single owner of the automation browser's lifecycle:

1. **Launch/attach**: `chrome --user-data-dir=<app-data>/browser-profile` (Chrome-for-Testing binary, version-pinned) via `playwright.chromium.launch_persistent_context(headless=False)`. Idempotent: attaches if already running.
2. **Health**: `GET /api/v1/browser/status` → running?, logged-in platforms (probes lightweight auth markers), profile age. Dashboard shows a persistent status banner.
3. **First-run login wizard**: guided per-platform sign-ins (LinkedIn, Workday tenants). The user types credentials/2FA — **JobSeeker never sees or stores credentials**; they live in the profile's encrypted storage like any normal browser.
4. **Session sharing**: discovery Tier-3 (authenticated LinkedIn crawling, URL unshortening) reuses this profile's storage state — one login serves the entire system.
5. **Containment**: separate profile = the user's daily Chrome is never touched, and if a platform ever restricts the account, blast radius is the automation lane.

---

## 4. Platform Detection & Adapters

A hierarchical pattern matcher loads the right driver on navigation:

```typescript
interface PlatformAdapter {
  platformName: string;
  matchUrl(url: string, document: Document): boolean;
  detectFormState(page: Page): Promise<FormState>;
  fillStandardFields(page: Page, profile: CandidateProfile): Promise<FillResult>;
  answerCustomQuestions(page: Page, qaResolver: QAResolver): Promise<QAFillResult>;
  attachDocuments(page: Page, docs: ApplicationDocuments): Promise<UploadResult>;
  navigateNextOrReview(page: Page): Promise<NavigationResult>;
}
```

**Selector policy (all adapters)**: prefer stable `data-*` / `name` / ARIA roles over CSS classes; fall back to text-keyword matching. **Never match on localized `aria-label` strings alone** (e.g. LinkedIn's "Continue to next step" is UI-language dependent) — pair them with `data-test-*` attributes or English text plus structural position. Every adapter ships with recorded-HTML fixture tests (§9).

### 4.1 LinkedIn "Easy Apply" (opt-in lane only)
Multi-step modal (`div.jobs-easy-apply-modal`, `div[data-test-modal]`):
1. Detect `button.jobs-apply-button` — Easy Apply vs external redirect routing.
2. Step navigation via `data-test-*` buttons paired with text/aria fallbacks ("Continue", "Review", "Submit").
3. Steps: contact info → resume selection (radio list vs `input[type=file]`) → experience/education (pre-filled from profile; verify) → screening questions (radio fieldsets, selects, years-of-experience numeric inputs) → review.
4. Failure recovery: dismiss modal → "Discard application" → clean reset, log `failure_stage`.

### 4.2 Greenhouse (`boards.greenhouse.io` / embeds)
`#first_name`, `#last_name`, `#email`, `#phone`, `input[type=file]#resume`, `#cover_letter`; custom questions in `.field` containers (`job_application_answers_attributes_*`); EEO dropdowns always offer "I decline to self-identify".

### 4.3 Lever (`jobs.lever.co`)
`#application-form`; `input[name=name|email|phone|org]`; socials `input[name="urls[LinkedIn]"]` etc.; hidden resume input (CDP injection); `.application-additional` custom cards.

### 4.4 Ashby (`jobs.ashbyhq.com`)
React SPA — semantic `name`/ARIA mapping; hidden `input[type=file]`; question extraction by label-text adjacency.

### 4.5 Workday (`*.myworkdayjobs.com`) — Phase 4, hardest
Per-tenant accounts (persistent session from login wizard); "Apply Manually" chosen over "Autofill with Resume" for deterministic control; `data-automation-id` locators across the 5-page stepper.

### 4.6 Generic fallback
Label-input association ladder: `label[for]` → nested label → `aria-label`/`aria-labelledby` → placeholder/name heuristics → proximity traversal. React/Vue state sync via native-setter + synthetic event cycle:

```javascript
function setNativeValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(element, value); else element.value = value;
  element.dispatchEvent(new Event('input',  { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur',   { bubbles: true }));
}
```

---

## 5. Intelligent Q&A Answering

```
Screening Question (label, options, field type)
        |
        v
[Tier 1: Deterministic router]  regex + vector match vs QA bank
        | confident >= 0.88                     | below / unseen
        v                                       v
[Return cached answer]          [High-stakes? ──yes──> PAUSE for human]
                                        |no
                                        v
                        [Tier 2: LLM fallback — truthfulness-constrained,
                         profile-grounded, cached for user review]
        |
        v
[Option Snapper] exact → fuzzy (>=80%) → semantic mapping to <option>/radio
        |
        v
[Execute on page] with human-like typing delays
```

**High-stakes gate (Amendment 2, non-negotiable):** work authorization, visa sponsorship, criminal background, security clearance, and exact-years-of-experience questions are **never** LLM-guessed. They resolve from the verified `CandidateMasterProfile` or the run pauses for the human.

Deterministic patterns (from the master plan §6 of v1, retained): work-auth, sponsorship, notice period, salary expectation, skill-years lookup against the skills taxonomy, relocation, driver's license.

---

## 6. File Upload

1. Locate file input (visible or hidden), `setInputFiles(pdfPath)` — native, no OS file dialog.
2. Custom dropzones: locate the hidden `input[type=file]` behind the styled drop area; if truly absent, synthesize `dragenter/dragover/drop` with a `DataTransfer` carrying the PDF bytes.
3. Verify before advancing: `files.length === 1`, non-zero size, upload progress cleared, no validation error banner.

---

## 7. Operational Modes & Safety Controls

### 7.1 Assisted Review Mode (default)

```
[Form auto-filled] -> [PAUSE at final Review screen]
   -> chime + desktop notification + WS HITL_REVIEW_REQUIRED to dashboard
   -> Run Monitor shows every answer with provenance (DETERMINISTIC / LLM / UNRESOLVED)
   -> User EITHER clicks Submit in the visible browser window (primary)
              OR clicks "Approve & Submit" on the dashboard (backend clicks submit)
```

The final screen of the real form **is** the review UI — nothing is hidden behind an overlay.

### 7.2 Autonomous Mode (strictly gated — unified contract)

All of the following, no exceptions:
- Explicit user opt-in in Settings (separate from the LinkedIn opt-in).
- **Non-LinkedIn ATS platforms only** (Greenhouse, Lever, Ashby).
- Match score **≥ 95**.
- 100% of Q&A resolved by Tier 1 deterministic with full confidence.
- Zero unhandled/ambiguous fields; pre-submit sanity check passes.
- Full-page confirmation screenshot + receipt parsing, always.

### 7.3 Rate Limits & Humanization

| Control | Value |
| :--- | :--- |
| LinkedIn / day | ≤ 25 (opt-in lane) |
| ATS / day | ≤ 40 |
| Global / day | 20 (default, user-configurable) |
| Inter-application cooldown | 3–8 min random |
| Keystroke delay | 60–180 ms/char, occasional 300 ms pause |
| Field-to-field delay | 1.2–3.5 s |
| Page dwell | 12–45 s |
| Working window | 08:30–18:30 local |
| Company cooldown | 1 application / company / 14-day rolling window (unless user overrides) |
| Rate checks | Atomic DB transaction before every run (no race conditions) |

### 7.4 CAPTCHA — Zero-Bypass Policy

Never solved, never bypassed, no third-party solvers — ever.
1. Detection via network/DOM signatures (`iframe[src*=recaptcha]`, `turnstile`, `arkose`, `#captcha-internal`).
2. Freeze automation; foreground the visible window; chime + notification + WS `CAPTCHA_CHALLENGE_DETECTED`.
3. Human solves it in the window; run resumes on clearance.
4. AFK timeout: unsolved after **5 minutes** → abort cleanly (`CAPTCHA_BLOCKED`), discard modal, pause that platform's queue until the user restarts it. Two CAPTCHAs in 30 min on one platform → 4-hour platform cooldown.

---

## 8. State Machine & Audit (single store)

All state and audit live in the **unified SQLite database** (`applications`, `qa_answers_audit`, `audit_logs` — see master plan §5). There is no separate audit database.

```
QUEUED -> STARTING -> AUTOFILLING -> PAUSED_FOR_REVIEW -> SUBMITTED
             |             |                  |
             v             v                  v
         BLOCKED        FAILED            DISCARDED / CAPTCHA_BLOCKED
     (auth missing)  (field/upload/     (user cancels, AFK timeout)
                      submit failure
                      with failure_stage)
```

Every run records: platform, mode, timestamps, duration, all Q&A answers (value, tier, confidence, `user_verified`), resume/letter paths, confirmation receipt, screenshot path, and `failure_stage` (`INITIAL_LOAD | CONTACT_FIELDS | QA_FIELDS | FILE_UPLOAD | FINAL_SUBMIT`).

---

## 9. Testing Strategy (adapter fixtures)

- **Recorded HTML fixtures**: save real pages (each Greenhouse/Lever step, LinkedIn modal states, Ashby form) as static files; adapters run offline against fixtures. A live-site redesign shows up as a failing fixture test, not a mis-filled application.
- **Weekly refresh chore**: re-record fixtures for the big four (30 min); diff selectors.
- **Local mock ATS**: an in-repo HTML application form with inputs/dropzone/multi-step behavior used by E2E before ever touching a live site.
- **Failure-path tests**: discard recovery, CAPTCHA freeze, AFK timeout, upload verification failure.

---

## 10. Integration Contracts

Unchanged from v1 (consumed by the backend and the dashboard):

```typescript
interface ApplicationJobInput {
  jobId: string; company: string; title: string;
  applicationUrl: string; isEasyApply: boolean;
  detectedPlatform?: "LINKEDIN" | "GREENHOUSE" | "LEVER" | "ASHBY" | "WORKDAY" | "GENERIC";
}

interface ApplicationTailoredArtifacts {
  jobId: string;
  tailoredResumePath: string;      // local absolute path to PDF
  tailoredCoverLetterPath?: string;
  candidateProfile: MasterCandidateProfile;
  jobDescriptionKeywords: string[];
}

interface ApplicationSubmissionResult {
  jobId: string;
  status: "SUBMITTED" | "PAUSED_FOR_REVIEW" | "FAILED" | "DISCARDED";
  confirmationMessage?: string; screenshotPath: string; timestamp: string;
}
```

---

## 11. Summary of Recommendations

1. **Dedicated visible automation browser** via Playwright persistent context — real fingerprint, one-time logins, human-watchable, no extension, no dead CDP-attach pattern.
2. **Assisted mode default**: final review happens in the real form's last screen; the dashboard mirrors state and can trigger submit.
3. **One autonomous gate**: non-LinkedIn ATS + ≥95 match + 100% deterministic answers + opt-in.
4. **High-stakes Q&A never LLM-guessed**; CAPTCHA never bypassed; caps/cooldowns/jitter enforced atomically.
5. **Fixtures, not hope**: every adapter is tested against recorded HTML before it ever runs live.
