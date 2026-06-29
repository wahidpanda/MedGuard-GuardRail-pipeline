# MedGuard — Guardrailed Medical RAG

A production-shaped retrieval-augmented assistant for patient-portal health questions, wrapped in a four-stage guardrail pipeline and fully observable through LangSmith. Built to demonstrate the parts of an LLM system that matter once it leaves a notebook: **safety, grounding, and monitoring.**

> ⚕️ **Scope note.** The knowledge base is general, non-diagnostic health information of the kind a hospital FAQ publishes. The point of the project is the *guardrail and observability architecture*, not medical authority. The assistant is prompt-scoped to never diagnose or prescribe.

---

## Why this exists

Most RAG demos stop at "retrieve, stuff into prompt, generate." That's the easy 20%. In a regulated domain like healthcare, the hard 80% is everything around the generation step:

- A user might paste an **SSN or MRN** — that PII must never reach a third-party LLM.
- A user might try to **jailbreak** the system into giving unsafe advice.
- A user might ask something **genuinely dangerous** (e.g. an overdose amount).
- And even on a benign question, the model might **hallucinate** an answer the source documents don't support — which, in medicine, is the most dangerous failure of all.

MedGuard puts a named, measurable gate in front of each of those failure modes, and traces every decision so you can prove the system behaved.

---

## Architecture

```
                          ┌──────────────────── LangSmith trace ────────────────────┐
                          │                                                          │
  user message ──▶  INPUT GUARDRAILS  ──▶  RETRIEVE  ──▶  GENERATE  ──▶  OUTPUT GUARDRAIL  ──▶  response
                    ├─ Prompt injection      (vector       (Groq          ├─ Groundedness
                    ├─ Safety & toxicity      search        Llama-3.3      │   judge (Llama-
                    └─ PII redaction          over FAQ)     grounded)      │   3.1-8b)
                          │                                                 │
                       can BLOCK                                        can BLOCK
                          │                                                 │
                          └──────────────▶  metrics store  ◀────────────────┘
                                                  │
                                          monitoring dashboard
```

**Two block points.** The input gates can refuse a request before a single token is generated (cheap, fast). The output gate can suppress an ungrounded answer after generation. A request only reaches the user if it clears both.

---

## The four guardrails

| Guardrail | Stage | What it catches | How |
|---|---|---|---|
| **PII Detection** | input | SSN, MRN, email, phone, DOB, card numbers | Regex redaction — the LLM only ever sees `[SSN]`, never the raw value |
| **Prompt Injection** | input | "ignore previous instructions", role-override, prompt-leak attempts | Pattern signals; 2+ distinct hits → block |
| **Safety & Toxicity** | input | Abuse, plus unsafe medical intent (overdose, self-harm, weaponization) | Keyword + intent patterns; unsafe intent → hard block |
| **Groundedness** | output | Hallucination — claims not supported by retrieved context | LLM-as-judge (fast 8B model) scores faithfulness 0–1 against the sources |

Each guardrail returns the same typed result (`pass` / `flag` / `block` + a 0–1 score + latency), so they compose cleanly and every one shows up identically in the trace and the dashboard. Swapping the regex PII detector for **Microsoft Presidio**, or the pattern injection check for a **fine-tuned classifier**, is a drop-in change — the interface doesn't move.

---

## Observability

Every stage is wrapped in a LangSmith `@traceable`, so a single request produces a nested trace: input-guardrail chain → retriever (with scored chunks) → LLM generation → output-guardrail judge. That gives you, per request, the full decision tree and token/latency cost.

The in-app **Monitoring** tab reads a rolling metrics window — total requests, block rate, p95 latency, mean groundedness, and a stacked breakdown of pass/flag/block per guardrail — so you can see the system's behavior at a glance without leaving the UI. LangSmith remains the system of record for deep trace inspection.

---

## Tech stack

- **Backend** — FastAPI, Pydantic v2, Groq (Llama-3.3-70B for generation, Llama-3.1-8B for the judge), LangSmith tracing
- **Retrieval** — sentence-transformers embeddings + cosine similarity, with a TF-IDF fallback so it runs with zero downloads
- **Frontend** — React + Vite, Recharts, a custom clinical design system
- **Graceful degradation** — runs fully offline with no API keys (extractive answers + lexical groundedness), so a reviewer can clone and run it in 60 seconds, then add keys to unlock the live LLM + tracing

---

## Quickstart

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # paste your OWN keys (see security note below)
uvicorn app.main:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # opens http://localhost:5173
```

Open the app, try the labelled example prompts (each one trips a different guardrail), then check the **Monitoring** tab.

### Running without keys
Leave `.env` as-is and it still works: retrieval, all four guardrails, and the dashboard run locally. You'll see extractive answers and a lexical groundedness heuristic. Add `GROQ_API_KEY` for generated answers and the LLM judge; add `LANGSMITH_API_KEY` for live tracing.

---

## 🔒 Security note

Never commit real keys. `.env` is gitignored; only `.env.example` (placeholders) is tracked. If a key is ever exposed, rotate it immediately at the provider console. PII is redacted **before** any text leaves the process for a third-party API — that ordering is deliberate and is the single most important line in the pipeline.

---

## Project layout

```
backend/
  app/
    core/         config + shared schemas
    guardrails/   pii · injection · toxicity · groundedness
    rag/          knowledge_base · retriever · pipeline (orchestration + tracing)
    monitoring/   rolling metrics store
    main.py       FastAPI routes: /chat /metrics /health /examples
frontend/
  src/
    components/   PipelineRail · Panels · Dashboard
    App.jsx       console + monitoring views
```

## Possible extensions

Streaming responses; a real vector DB (pgvector / Qdrant); Presidio for PII; a fine-tuned injection classifier; human-in-the-loop review queue for `flag`ged requests; LangSmith eval datasets to regression-test the guardrails on every deploy.
