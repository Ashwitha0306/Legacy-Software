# A Grounded Multi-Agent Framework for Autonomous Legacy Software Intelligence

> **Research Platform** | IEEE Conference Publication | Final Year Engineering Project

A production-quality web platform that helps developers understand undocumented **Java Spring Boot** legacy codebases using a **Grounded Retrieval-Augmented Verification (RAV)** multi-agent pipeline.

---

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌────────────────────┐
│  Frontend   │────▶│  Backend        │────▶│  Analysis Service  │
│  React/Vite │     │  Node/Express   │     │  Python/FastAPI    │
│  :3000      │     │  :5000          │     │  :8000             │
└─────────────┘     └────────┬────────┘     └────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  MongoDB Atlas  │
                    └─────────────────┘
```

## RAV Pipeline

```
ZIP / GitHub URL
      │
      ▼
[Agent 1] Project Upload & Validation
      │
      ▼
[Agent 2] Preprocessing
      │
      ▼
[Agent 3] Tree-sitter Parser → AST
      │
      ▼
[Agent 4] SSKG Construction (NetworkX Knowledge Graph)
      │
      ▼
[Agent 5] Retrieval Agent (graph-based context)
      │
      ▼
[Agent 6] Reconstruction Agent (Llama 3, grounded ONLY on retrieved context)
      │
      ▼
[Agent 7] Verification Agent → status + confidence + evidence citations
      │
      ▼
[Agent 8] Evaluation Agent → Precision, Recall, F1, Hallucination Rate...
      │
      ▼
Interactive Dashboard
```

---

## Prerequisites

### 1. Node.js (≥ 18)
```bash
node --version
```

### 2. Python (≥ 3.11)
```bash
python --version
```

### 3. MongoDB Atlas
- Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
- Copy your connection string into `.env` under `MONGODB_URI`

### 4. Ollama (local LLM)
```bash
# Install Ollama: https://ollama.ai
# Windows: download the installer from https://ollama.ai/download

# After installation, pull Llama 3:
ollama pull llama3

# Verify it runs:
ollama run llama3 "Hello!"
```

### 5. Git (required for GitHub URL ingest)
```bash
git --version
```

---

## Quick Start

```bash
# 1. Clone and enter repo
git clone <repo-url>
cd "Legacy software"

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env: add your MongoDB URI, JWT secret, etc.

# 3. Install backend dependencies
cd backend
npm install
cd ..

# 4. Install frontend dependencies
cd frontend
npm install
cd ..

# 5. Install Python dependencies
cd analysis-service
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
cd ..

# 6. Start all services (3 terminals)
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Analysis Service
cd analysis-service && uvicorn main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
Legacy software/
├── frontend/                   # React + Vite + Tailwind + React Flow
├── backend/                    # Node.js + Express API Gateway
├── analysis-service/           # Python + FastAPI (all AI agents)
├── .env.example
├── .gitignore
└── README.md
```

---

## Research Metrics

The platform measures:

| Metric | Type |
|--------|------|
| Precision / Recall / F1 | Automated |
| Hallucination Rate | Automated |
| Evidence Citation Accuracy | Automated |
| Verification Classification Accuracy | Automated |
| Architecture Reconstruction Accuracy | Automated |
| API Detection Accuracy | Automated |
| Software Knowledge Coverage | Automated |
| Documentation Drift Detection Accuracy | Automated |
| Architecture Drift Detection Accuracy | Automated |
| Time Saved vs. Manual Review | Estimated |
| Developer Trust Score | Manual user study (survey export) |

---

## Ablation Study

Three conditions compared on identical Java Spring Boot codebases:

| Condition | SSKG | Verification | Model |
|-----------|------|-------------|-------|
| Plain LLM | ✗ | ✗ | Llama 3 |
| RAG-only | ✓ (retrieval) | ✗ | Llama 3 |
| Full RAV | ✓ (retrieval) | ✓ | Llama 3 |

The **same base model** (Llama 3) is used across all conditions so that the pipeline — not model quality — is the independent variable.

---

## License

MIT — see LICENSE for details.
