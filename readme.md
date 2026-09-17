# Grounded AI

> Production-grade, local-first RAG and document intelligence platform.

Grounded AI is a document question-answering system designed to generate
answers strictly from retrieved source documents.

Instead of relying entirely on an LLM's internal knowledge, Grounded AI
uses document ingestion, semantic search, BM25 keyword retrieval,
hybrid retrieval, reranking, relevance gating, and answer-grounding
verification to reduce unsupported answers and hallucinations.

## ✨ Highlights

- 📄 PDF and Markdown document ingestion
- 🧩 Intelligent document chunking
- 🧠 Local Hugging Face embeddings
- 🔎 Vector similarity search
- 🔤 BM25 keyword retrieval
- 🔀 Hybrid retrieval
- 🎯 Cross-encoder reranking
- 🛡️ Relevance gate for low-confidence queries
- ✅ Answer grounding verification
- 🚫 Refusal for unsupported questions
- 📊 Retrieval and answer evaluation
- 🏠 Local-first architecture
- 🆓 No paid OpenAI API required

## 🏗️ Architecture

```text
                    ┌──────────────────┐
                    │      User        │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Query API      │
                    └────────┬─────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Query Normalization  │
                  └──────────┬───────────┘
                             │
                             ▼
             ┌────────────────────────────────┐
             │       Hybrid Retrieval         │
             │                                │
             │  Vector Search + BM25 Search   │
             └───────────────┬────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │    Reranker      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Relevance Gate   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Ollama / LLM     │
                    └────────┬─────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │ Answer Grounding Check   │
                └────────────┬─────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Grounded Answer  │
                    └──────────────────┘



### Evaluation section

This is especially important because your project has **real evaluation numbers**, not just "it works."

```
## 📊 Evaluation

Grounded AI includes an evaluation pipeline for measuring retrieval,
reranking, grounding, and refusal behavior.

| Metric | Result |
|---|---:|
| Grounding Accuracy | 86.7% |
| Refusal Accuracy | 100% |
| Overall Accuracy | 90.0% |
| Answer Grounding | 100% |
| Unsupported Claim Rate | 0% |
| Recall@5 | 100% |
| MRR | 1.000 |
| Reranker Survival | 100% |

### Evaluation Summary

- Retrieval hits: 15/15
- Reranker hits: 15/15
- Grounded answers: 13/13
- Unsupported claims: 0/7

  ## 🛠️ Tech Stack

### Backend

- Node.js
- TypeScript
- Express.js
- Ollama
- Hugging Face Transformers
- LangChain
- BM25
- PDF parsing

### Retrieval

- Semantic vector retrieval
- BM25 keyword retrieval
- Hybrid retrieval
- Cross-encoder reranking
- Relevance gating

### Frontend

- React
- Vite

### Development

- Git
- GitHub
- npm

## 🚀 Getting Started

### 1. Clone the repository

git clone https://github.com/karthhikyadav/grounded-ai.git
cd grounded-ai

### 2. Install backend dependencies

cd backend
npm install

### 3. Configure environment variables

Copy `.env.example` to `.env` and configure the required values.

### 4. Generate the vector index

npm run ...

### 5. Start the backend

npm run dev

The API will start locally.

### 6. Run evaluation

npm run evaluate


## 📁 Project Structure


grounded-ai/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   ├── embeddings/
│   │   ├── evaluation/
│   │   ├── ingestion/
│   │   └── retrieval/
│   ├── documents/
│   ├── data/
│   │   └── evaluation/
│   ├── uploads/
│   ├── package.json
│   └── .env.example
│
├── frontend/
│
├── .gitignore
└── README.md


And finally:

## 🔮 Future Improvements

- Persistent vector database
- Streaming answers
- Source citation UI
- Document management dashboard
- Multi-document collections
- Conversation history
- Improved evaluation datasets
- Production deployment
- Authentication and authorization

## 📌 Project Status

Grounded AI is actively being developed.

The current system includes the core RAG pipeline, hybrid retrieval,
reranking, relevance gating, answer-grounding verification, and
automated evaluation.

## 👨‍💻 Author

Karthik Yadav

Built as a production-oriented AI/RAG engineering project.
