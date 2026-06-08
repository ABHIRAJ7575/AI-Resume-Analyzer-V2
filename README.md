<div align="center">

#   TalentGraph - AI
## *The Resume Overhauler 3000*

> **"Congratulations. Your resume has just been reviewed by something smarter than the HR who asked you to bring a physical Aadhaar Card xerox to a software engineering interview."**

<br />

<p align="center">
  <img src="https://skillicons.dev/icons?i=nextjs,tailwind,vercel,supabase,postgres,ts&theme=dark" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white" />&nbsp;
  <img src="https://img.shields.io/badge/Pinecone_VectorDB-00BCD4?style=flat-square&logoColor=white" />&nbsp;
  <img src="https://img.shields.io/badge/HuggingFace-FFD21E?style=flat-square&logo=huggingface&logoColor=black" />&nbsp;
  <img src="https://img.shields.io/badge/Turbopack-EF4444?style=flat-square&logo=turborepo&logoColor=white" />&nbsp;
  <img src="https://img.shields.io/badge/License-MIT-F7DF1E?style=flat-square" />&nbsp;
  <img src="https://img.shields.io/github/stars/ABHIRAJ7575/AI-Resume-Analyzer-V2?style=flat-square&color=FFD700&logo=github&label=Stars" />&nbsp;
  <img src="https://img.shields.io/badge/PRs-Welcome-22c55e?style=flat-square&logo=github&logoColor=white" />
</p>

</div>

---

##  Check It Live - Right Now

> *"Because a GitHub repo without a live link is like a resume with 'Available Upon Request' - theoretically useful, practically invisible to every recruiter on the planet."*

<div align="center">

### **[LIVE APP - INSERT URL HERE](YOUR_LIVE_URL_HERE)**

> 📌 *Live URL will be inserted here. Coming soon - significantly faster than IRCTC loading during Tatkal booking window. Probably.*

</div>

---

## 🌌 What Is This, Exactly?

**TalentGraph - AI** is a **production-grade, cyberpunk-themed AI resume dissection engine** that does to your CV exactly what a Senior Developer does to a fresher's first Pull Request - tears it apart with clinical precision, zero emotional mercy, and a subtle air of intellectual superiority.

Built for the era where *"I know Python"* on a resume often means someone once printed `Hello World` after watching a 12-minute YouTube tutorial, this system validates what candidates **actually know** versus what they **boldly claim to know** on page one.

Think of it as that hyper-critical **Tech Lead from a Big MNC** - the one who sips *Chai*, stares at your code in silence for 7 seconds, and then says *"yeh kya kar diya tune?"* before dropping feedback that makes you question every academic and life decision since Class 12.

**Except this version runs 24/7, never goes for a 2-hour lunch break, and doesn't mark your ticket as "Under Review" for three weeks.**

### What It Does - In Plain English

| Capability | What It Actually Does |
|---|---|
| 📄 Resume Parsing | Rips apart your PDF like a *chacha* reading your marksheet at a family function |
| 🧠 AI Analysis | Judges your entire career trajectory with Gemini 2.5 Flash precision |
| 📊 ATS Scoring | Determines if your resume survives the algorithm before a human ever sees it |
| 🔍 Semantic Vector Search | Cross-references against a Pinecone vector database of real industry patterns |
| ❓ Interview Question Generation | Synthesizes questions specifically designed to expose every gap you thought was hidden |
| ⚠️ Inconsistency Detection | Calls out *"5 years of experience in a technology that was invented 3 years ago"* |
| 💡 Improvement Engine | Tells you what to actually fix before the next rejection email arrives |

---

##  Tech Stack - The Complete Engineering Arsenal

> *"We could've used plain HTML, vanilla JS, and a Fetch call. But beta, zindagi mein kuch toh solid karo."*

### Core Architecture Layers

| Layer | Technology | The Real Reason |
|---|---|---|
| **Frontend Framework** | Next.js 16 + App Router | Because Create React App is a relic from a simpler, more innocent era |
| **Build Engine** | Turbopack | Webpack was taking longer to compile than IIT JEE Advanced result declarations |
| **Styling System** | Tailwind CSS | Because writing raw CSS in 2025 is like handwriting your DSA solutions in a system design interview |
| **UI Aesthetic** | Glassmorphism + Cyberpunk Dark | So the UI looks significantly cooler than your college project submission |
| **Typography** | `Orbitron` + `Rajdhani` | Fonts chosen to make unprepared recruiters feel aesthetically underprepared |
| **AI Core Engine** | `@google/genai` SDK + `gemini-2.5-flash` | The fastest model Google currently offers - still faster than Mumbai Local during peak hours |
| **Vector Intelligence** | `@pinecone-database/pinecone` | Semantic search that understands *context* - unlike most automated HR rejection emails |
| **Embeddings Pipeline** | Hugging Face Inference API | Open-source, powerful, and free - the holy trinity of developer happiness |
| **Persistence Layer** | Supabase PostgreSQL | Serverless Postgres that actually behaves when you need it to |
| **Deployment Target** | Vercel | Because `npm run build` deserves a happy ending |

---

##  System Architecture & The Data Flow Gospel

> *"Documented thoroughly because future-me at 11:30 PM before a demo will have absolutely no memory of what present-me built at 3 AM."*

### High-Level Modular Design Matrix

The pipeline enforces **total separation of concerns** - deterministic algorithm scoring logic is completely decoupled from vector RAG flows, which are independently assembled before feeding structured data into the LLM context builder. No spaghetti architecture. No accidental global state leaks. No last-minute prayers to Stack Overflow.

```
+----------------------------------------------------------------------+
|                         CLIENT LAYER                                 |
|              Next.js 16 App Router + Turbopack Build Engine          |
+-----------------------------+----------------------------------------+
                              |
                              v
+----------------------------------------------------------------------+
|                    FILE UPLOAD HANDLER                               |
|              PDF DropZone + Client-Side Validation Layer             |
+-----------------------------+----------------------------------------+
                              |
                              v
+----------------------------------------------------------------------+
|                  API ROUTE ORCHESTRATOR                              |
|            /api/analyze  -  The Central Mission Control              |
+----------------+------------------------------+----------------------+
                 |                              |
                 v                              v
+------------------------+      +---------------------------------------+
|   PDF PARSER SERVICE   |      |      PARALLEL PROCESSING ENGINE       |
|  Text Extraction +     |      |                                       |
|  Content Sanitizer     +-----►|  +-----------------+ +-------------+  |
+------------------------+      |  |  DSA SCORING    | |  VECTOR RAG |  |
                                |  |    ENGINE       | |   PIPELINE  |  |
                                |  +--------+--------+ +------+------+  |
                                +-----------+------------------+---------+
                                            |                  |
                                            v                  v
                                +---------------------------------------+
                                |         SCORE AGGREGATOR              |
                                |   Weighted Hybrid: Deterministic + LLM|
                                +------------------+--------------------+
                                                   |
                                                   v
                                +---------------------------------------+
                                |       GEMINI 2.5 FLASH ENGINE         |
                                |  Feedback Synthesis + Interview Qs    |
                                +------+------------------+-------------+
                                       |                  |
                         +-------------+                  +--------------+
                         v                                               v
              +----------------------+                  +------------------------------+
              |  PINECONE + SUPABASE |                  |    RESULT PAYLOAD            |
              |  Persist + Retrieve  |                  |  -> Dashboard UI Render      |
              +----------------------+                  +------------------------------+
```

### Full Request Lifecycle - Sequence Diagram

```
User      DropZone     API Route    PDF Parser    DSA Scorer   Vector RAG   Pinecone   Supabase   Dashboard
 |           |             |             |             |            |           |          |          |
 +-Upload--->|             |             |             |            |           |          |          |
 |           +-POST /analyze>            |             |            |           |          |          |
 |           |             +-ExtractText>|             |            |           |          |          |
 |           |             |<-CleanText--+             |            |           |          |          |
 |           |             |             +-[PARALLEL EXECUTION BEGINS]--------->           |          |
 |           |             +-Calc Score-------------->|             |           |          |          |
 |           |             +-SemanticQuery----------->+------------>|           |          |          |
 |           |             |             |            |             +-Query---->|          |          |
 |           |             |             |            |             |<-Matches--+          |          |
 |           |             +-Aggregate Results<-------+-------------+           |          |          |
 |           |             +-Gemini Feedback-------------------------------------------->|          |
 |           |             +-Persist Analysis------------------------------------------->|          |
 |           |             +-Stream Result Payload------------------------------------------------------>|
 |           |<-Display----+             |             |            |           |          |          |
```

---

##  Feature Deep Dive - What's Actually Under The Hood

### Dual Hybrid Scoring Matrix

The most technically sophisticated component in the system. Two independent scoring engines execute in parallel and their outputs are fused through a calibrated weighting algorithm:

**Engine 1 - Deterministic DSA Scorer**

Tokenizes resume content and maps it against structured pattern libraries covering data structure vocabulary, algorithm complexity mentions, system design terminology, architectural patterns, and technical depth indicators. Hard numeric output. No interpretation. No bias.

**Engine 2 - LLM Contextual Scorer (Gemini 2.5 Flash)**

Reads between the lines. Evaluates logical career progression, experience consistency, project depth plausibility, and technical claim validity. Most critically - it **penalizes fluffy buzzword padding** at scale. If your resume contains *"synergized cross-functional blockchain-native deliverables"*, this engine will find it, flag it, and judge it accordingly.

The final output is a **calibrated weighted hybrid score** - because real talent evaluation has never been purely algorithmic, and an AI that pretends otherwise is just a fancy keyword counter.

---

### Zero-Clip Universal Layout Engine

Built on an **independent split-container architecture** engineered for complete viewport independence:

- **Left Panel (Fully Static):** ATS scores, skill gap matrix, DSA rating, overall verdict - anchored, always visible, never scrolls away.
- **Right Panel (Independently Scrollable):** Suggested improvements, interview battery, inconsistency flags - scrolls on its own track without disturbing the metric panel.
- **Dynamic Tooltip Overlay Portal:** All tooltips inject into a root-level DOM portal, completely escaping parent container overflow boundaries. Zero text edge-clipping across every known viewport - from a 320px Android screen to a 4K boardroom projector.

---

### High-Volume UX Safeguard - The "Free Tier Survivor" Protocol

> *"Because every Indian developer will hit Google's free API tier wall at 2 AM, the night before the demo. It is not a bug. It is a rite of passage."*

When the system detects infrastructure stress signals (503 responses, rate limit triggers, exponential latency spikes), the **Exponential Backoff Interceptor** activates silently:

1. Detects all non-2xx infrastructure responses upstream
2. Applies progressive retry delay: `100ms -> 200ms -> 400ms -> 800ms -> graceful failure`
3. Switches UI into a **professional amber advisory card** - no crash, no broken state, no embarrassing red error floods
4. Logs the incident cleanly for post-session debugging

The user sees a calm, informative workload notice. The developer sees clean structured logs. No public meltdowns. No rewriting the entire codebase because Google decided today was a bad day.

---

## 💀 Developer Realities - The Sarcastic Bug-Tracking Ledger

> *"Software engineering is the art of converting cold chai, sleep debt, and Stack Overflow tabs into source code that works - most of the time, on most machines, under most conditions."*

> *"A project is not complete until the UI looks clean, the backend is optimized, the deployment pipeline has been rebuilt twice, and the developer has questioned their career path at least 45 times due to a single misplaced semicolon at line 312."*

---

### Bug #001 - The Great Global Scope Heist

**Incident Report:** The Gemini API kept returning empty token parameter objects despite a brand-new, freshly generated API key that had never touched production.

**Root Cause:** An inner async execution closure was silently bypassing its own locally declared `const apiKey` and reaching all the way up the scope chain to latch onto an **uninitialized root-level variable** hanging at the very top of the module file. JavaScript scoping does not care about your intentions, your feelings, or your deadline.

**Resolution:** Relocated the key into a properly scoped configuration object. Three lines changed. Two hours lost. Everything worked instantly.

**Moral:** JavaScript scope resolution will test your patience faster than a BSNL customer care IVR that asks you to *"press 1 for English, press 2 for Hindi"* across seventeen menu levels - and then disconnects before connecting you to a human being. Read your scope chain before blaming the API.

---

### Bug #002 - Turbopack's Phantom Cache Dimension

**Incident Report:** Modified core initialization logic. Saved the file. Restarted the server. Refreshed the browser. The application continued running from an alternate timeline where the changes had never happened.

**Root Cause:** Turbopack aggressively caches compiled module chunks inside `.next/`. Your source file updated. The compiled binary in memory did not. Classic *"works on my last save"* energy.

**Resolution:**

```powershell
# Windows (PowerShell) - The Exorcism Ritual
Remove-Item -Recurse -Force .next
```

```bash
# macOS / Linux - The Clean Slate Protocol
rm -rf .next
```

Restart the dev server. Your changes will reappear - exactly like a GeeksForGeeks solution materializing in your browser the night before a coding round.

**Moral:** If Next.js is completely ignoring you, it is not personal. It is cached. The difference between a junior developer and a senior developer is that the senior developer clears `.next` *before* questioning their sanity, their code, and their life choices.

---

### Bug #003 - The 503 Overload Meditation Session

**Incident Report:** Completely random `503 Service Unavailable` responses flooding the console during high-concurrency testing windows. No code had changed. Nothing was broken locally. The universe was simply having a bad day.

**Root Cause:** Google's free-tier Gemini infrastructure enforcing global rate limits under heavy concurrent load. This is not a bug in your code. Your code is absolutely fine. Google is just gently reminding you that you are on the free plan and the world is full of other developers making requests simultaneously.

**Resolution:** Built the Exponential Backoff Interceptor described in the Features section. The UI now renders a professional workload advisory card instead of projecting raw red error text directly at the user's face.

**Moral:** Do not rewrite your entire API layer when you receive a 503. Make *chai*. Wait 30 seconds. Retry the request. This is the way. Alternatively, upgrade your Gemini API tier - but where is the character development in that?

---

### Bug #004 - The Next.js Hydration Mismatch Horror *(Bonus Round)*

**Incident Report:** Console screaming `Hydration failed because the server rendered HTML didn't match the client` at 2:47 AM, three hours before a scheduled demo. Every. Single. Refresh.

**Root Cause:** Dynamic glassmorphism CSS values were being computed differently during SSR (no `window` object available on server) versus CSR (browser has full DOM context). Classic SSR/CSR boundary violation - the inevitable price of building beautiful dynamic UIs on a Server-Side Rendered framework.

**Resolution:** Wrapped the affected dynamic styling components in `useEffect` hooks to guarantee browser-only execution. Added `suppressHydrationWarning` where contextually appropriate and clearly documented.

**Moral:** Next.js SSR is an incredibly powerful system. It is also like a strict college professor who will loudly and publicly point out every discrepancy between what you *promised* and what you *actually delivered*. Respect the hydration boundary. It is non-negotiable - like the 7.5 CGPA cutoff on every placement portal.

---

## ⚙️ Local Environment Setup - The Complete Configuration Gospel

> *"Follow these steps in exact sequence. Deviations will result in compilation errors, configuration nightmares, and a quiet internal questioning of all technical decisions made this year."*

### Prerequisites Checklist

| Requirement | Minimum Version | Verify With |
|---|---|---|
| **Node.js** | `>= 18.x LTS` | `node --version` |
| **npm** | `>= 9.x` | `npm --version` |
| **Git** | Latest stable | `git --version` |

> *Ensure all three are installed before proceeding. Running `npm install` on Node 16 and wondering why it fails is the equivalent of attempting Tatkal booking 11 seconds after the window opens.*

---

### Step 1 - Clone the Repository

```bash
git clone https://github.com/ABHIRAJ7575/AI-Resume-Analyzer-V2.git
cd AI-Resume-Analyzer-V2
```

---

### Step 2 - Configure Environment Variables

Create your local environment secrets file:

```bash
# macOS / Linux
touch .env.local

# Windows PowerShell
New-Item .env.local
```

Populate it with the following configuration keys:

```env
# ---- GOOGLE GEMINI AI ----------------------------------------
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
# Get from: https://aistudio.google.com/app/apikey

# ---- PINECONE VECTOR DATABASE --------------------------------
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_HOST=your_pinecone_index_host_here
# Get from: https://app.pinecone.io -> Your Index -> Host URL

# ---- HUGGING FACE EMBEDDINGS ---------------------------------
HF_API_KEY=your_huggingface_api_key_here
# Get from: https://huggingface.co/settings/tokens

# ---- SUPABASE POSTGRESQL -------------------------------------
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Get from: https://app.supabase.com -> Project Settings -> API
```

> ⚠️ **Critical Security Note:** Never commit `.env.local` to version control. The `.gitignore` already excludes it by default - but if you accidentally push your API keys publicly, rotate all of them **immediately**. GitHub's secret scanner will detect them and send you a polite but deeply unsettling email. This is not a theoretical scenario.

---

### Step 3 - Install Dependencies

```bash
npm install
```

> *This will take approximately as long as IRCTC loads the train seat availability page during a long weekend booking rush. The `node_modules` folder will eventually emerge. It always does.*

---

### Step 4 - Launch the Development Server

```bash
npm run dev
```

Navigate to **[http://localhost:3000](http://localhost:3000)** in your browser.

> If port `3000` is already occupied by another process, Next.js will automatically shift to `3001`. If that is also taken, you have too many development servers running simultaneously. Consider closing some of those 43 Chrome tabs.

---

### Step 5 - Production Build Verification

Compile the full production bundle and verify all static routes resolve correctly before deploying:

```bash
npm run build    # Compiles and optimizes for production
npm run start    # Serves the compiled production build locally
```

A clean build output with zero errors means zero broken imports, zero type violations, and zero reasons for the CI/CD pipeline to reject your deployment. This is the moment you have earned that *chai*.

---

## 📁 Project Structure

```
AI-Resume-Analyzer-V2/
|
+-- app/
|   +-- api/
|   |   +-- analyze/
|   |       +-- route.ts              # Core API orchestrator
|   +-- layout.tsx                    # Root layout + font configuration
|   +-- page.tsx                      # Dashboard entry point
|
+-- components/
|   +-- DropZone.tsx                  # PDF upload interface + drag-drop handler
|   +-- ScorePanel.tsx                # Static ATS metric display (left panel)
|   +-- ImprovementPanel.tsx          # Scrollable suggestions panel (right panel)
|   +-- TooltipPortal.tsx             # Root-level DOM portal for zero-clip tooltips
|
+-- lib/
|   +-- gemini.ts                     # Gemini API client + exponential backoff
|   +-- pinecone.ts                   # Vector DB client + semantic query builder
|   +-- embeddings.ts                 # HuggingFace embedding generation pipeline
|   +-- parser.ts                     # PDF text extraction + sanitization layer
|   +-- scorer.ts                     # DSA pattern matching + hybrid score fusion
|
+-- types/
|   +-- analysis.ts                   # Complete TypeScript interface definitions
|
+-- .env.local                        # Secret API keys (gitignored)
+-- .gitignore
+-- next.config.ts
+-- tailwind.config.ts
+-- package.json
```

---

## 🌍 Contributing

Pull requests are genuinely welcome. For major architectural changes, please open an issue first to align on direction before writing code.

When filing a bug report, please include:

- Your OS and Node.js version
- Steps to reproduce the issue (exact sequence matters)
- Expected vs actual behavior
- Full error logs - sanitized of all API keys, please

> *"Before opening a GitHub Issue titled 'Bug: it doesn't work' with zero additional context - please take one deep breath, re-read the full error message, check if Stack Overflow already has 47 accepted answers for it, and then confirm you have actually checked the `.env.local` file."*

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for full details.

> *Free to use, free to modify, free to deploy, free to build on top of. Just do not post it on LinkedIn claiming you built the entire thing from scratch over a weekend. The commit history exists. The timestamps are public. We will know.*

---

## 🙏 Acknowledgements - The Actual Credits Roll

| Entity | Contribution |
|---|---|
| **Google Gemini Team** | For `gemini-2.5-flash` being fast enough that users do not lose patience |
| **Pinecone** | For vector semantic search that genuinely understands context |
| **Supabase** | For making PostgreSQL feel like a modern, civilized experience |
| **Vercel** | For deployment pipelines that complete faster than your relatives accept that software engineering is a real career |
| **Hugging Face** | For open-source embeddings that actually work out of the box |
| **Stack Overflow** | For answering questions we were too embarrassed to ask real humans |
| **Turbopack Team** | For trying. We appreciate the effort. We really do. |
| **The `.next` Cache** | For teaching us patience, resilience, and the value of `rm -rf` |
| **Every Indian CS Graduate** | Who ever listed *"Java, C, C++, Python, HTML, CSS, JavaScript, React, Node, MongoDB, MySQL, Docker, Kubernetes, AWS, Azure, GCP, Blockchain, ML, Deep Learning, Data Science, MS Word, and MS Excel"* on a single-page fresher resume - this tool was built to help you. You deserve better than a keyword mismatch rejection. |

---

<div align="center">

---

*Built with extreme technical precision, questionable sleep hygiene, an unreasonable number of open browser tabs, and a genuinely unhealthy volume of Chai by* **Abhiraj Dixit**

---

*"If your resume can survive a full TalentGraph AI analysis, it can survive anything - including the recruiter who asks you to explain the entire concept of blockchain in one sentence, immediately followed by 'do you know MS Office?'"*

---

<p align="center">
  <a href="https://github.com/ABHIRAJ7575">
    <img src="https://img.shields.io/badge/GitHub-ABHIRAJ7575-181717?style=flat-square&logo=github&logoColor=white" />
  </a>
  &nbsp;&nbsp;
  <a href="https://www.linkedin.com/in/abhiraj-dixit-6aa386313">
    <img src="https://img.shields.io/badge/LinkedIn-Abhiraj_Dixit-0A66C2?style=flat-square&logo=linkedin&logoColor=white" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/ABHIRAJ7575/AI-Resume-Analyzer-V2">
    <img src="https://img.shields.io/badge/Repository-AI--Resume--Analyzer--V2-0f0c29?style=flat-square&logo=github&logoColor=white" />
  </a>
</p>

<p align="center">
  <em>If this project helped you, a star on the repo costs nothing and means everything.</em>
</p>

</div>