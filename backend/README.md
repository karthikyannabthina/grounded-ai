# Grounded AI --- Recruiter-Focused Project Documentation

## 1. Project Overview

**Grounded AI** is a local, privacy-friendly document question-answering
system built around **Retrieval-Augmented Generation (RAG)**.

The main goal is not simply to generate answers with an LLM. The system
is designed to:

-   retrieve relevant information from uploaded documents
-   combine semantic and keyword-based retrieval
-   rerank retrieved evidence
-   prevent unsupported answers
-   validate generated answers against retrieved evidence
-   retry when the model produces unsupported claims
-   refuse when the available documents do not contain enough
    information
-   evaluate retrieval, reranking, relevance gating, refusal behavior,
    and answer grounding

The entire AI pipeline runs locally without requiring OpenAI API
billing.

------------------------------------------------------------------------

## 2. Why This Project Matters

A normal LLM can answer a question using information learned during
training, which can lead to hallucinations.

Grounded AI takes a different approach:

``` text
User Question
     ↓
Query Normalization
     ↓
Hybrid Retrieval
     ├── Vector Search
     └── BM25 Keyword Search
     ↓
Hybrid Ranking
     ↓
Local Reranker
     ↓
Relevance Gate
     ↓
Evidence Context
     ↓
Local LLM
     ↓
Answer Grounding Validator
     ↓
     ├── Supported → Return Answer
     └── Unsupported
             ↓
          Retry Once
             ↓
        Still Unsupported
             ↓
       Controlled Refusal
```

The important engineering idea is:

> **The LLM is not trusted as the source of truth. The retrieved
> documents are.**

------------------------------------------------------------------------

# 3. Technology Stack

## Backend / Core

-   TypeScript
-   Node.js
-   ES Modules
-   Local HTTP APIs
-   Async/await
-   Modular service architecture

## Retrieval

-   Local Hugging Face embeddings
-   `all-MiniLM-L6-v2`
-   Vector similarity search
-   BM25 keyword retrieval
-   Hybrid retrieval

## Reranking

-   Hugging Face cross-encoder reranker
-   `Xenova/ms-marco-MiniLM-L-6-v2`

## Generation

-   Ollama
-   `llama3.2:3b`
-   Local inference
-   No OpenAI API dependency

## Documents

-   PDF ingestion
-   Markdown ingestion
-   Document chunking
-   Metadata preservation

## Validation / Evaluation

-   Semantic similarity
-   Lexical evidence matching
-   Grounding validation
-   Retrieval metrics
-   Reranker metrics
-   Refusal evaluation

------------------------------------------------------------------------

# 4. Major Features Implemented

## 4.1 Document Ingestion

The system supports document-based knowledge rather than relying
directly on an LLM's general knowledge.

Implemented concepts include:

-   PDF loading
-   Markdown loading
-   document normalization
-   document chunking
-   chunk metadata
-   source tracking

Each chunk maintains enough metadata to identify where retrieved
evidence came from.

------------------------------------------------------------------------

# 5. Local Embedding Pipeline

The project originally explored API-based embeddings but was moved to a
completely local approach to avoid billing and external API dependency.

The final embedding approach uses:

**Hugging Face `all-MiniLM-L6-v2`**

Pipeline:

``` text
Document
   ↓
Chunks
   ↓
Embedding Model
   ↓
Numerical Vectors
   ↓
Vector Store
```

Queries are embedded using the same model.

This allows semantic similarity between:

-   user questions
-   document chunks

without sending document data to an external embedding API.

------------------------------------------------------------------------

# 6. Query Normalization

The retrieval layer normalizes common technical abbreviations before
searching.

Current normalization includes:

``` text
js      → JavaScript
nodejs  → Node.js
node    → Node.js
ts      → TypeScript
mongo   → MongoDB
```

Example:

``` text
"What are JS props?"
```

becomes approximately:

``` text
"What are JavaScript props?"
```

The original question is still preserved for the LLM.

This improves retrieval without changing what the user actually asked.

------------------------------------------------------------------------

# 7. Hybrid Retrieval

Instead of depending on only one retrieval strategy, Grounded AI
combines two approaches.

## Vector Retrieval

Vector search captures semantic similarity.

For example:

``` text
"How do components communicate?"
```

can retrieve content discussing:

``` text
parent components
child components
props
passing data
```

even when the exact words differ.

## BM25 Retrieval

BM25 captures keyword-level relevance.

This is particularly useful for:

-   technical terminology
-   exact API names
-   programming concepts
-   abbreviations
-   specific words in documents

## Hybrid Score

The current system combines both:

``` text
Hybrid Score =
    0.6 × Vector Score
  + 0.4 × BM25 Score
```

Current retrieval configuration:

``` text
Top K retrieval = 5
Vector weight   = 0.6
BM25 weight     = 0.4
```

This gives the system both semantic and lexical retrieval capabilities.

------------------------------------------------------------------------

# 8. Reranking

Initial retrieval is optimized for recall.

The system retrieves the top 5 candidates and then uses a local reranker
to determine which results are most relevant to the exact query.

Current flow:

``` text
Hybrid Retrieval
      ↓
Top 5 candidates
      ↓
Cross-Encoder Reranker
      ↓
Top 3 evidence chunks
```

Reranker model:

``` text
Xenova/ms-marco-MiniLM-L-6-v2
```

This separates:

-   broad candidate retrieval
-   precise relevance ranking

which is an important RAG architecture pattern.

------------------------------------------------------------------------

# 9. Relevance Gate

Before sending retrieved evidence to the LLM, Grounded AI checks whether
the best reranked result is relevant enough.

Current threshold:

``` text
Relevance threshold = -2.5
```

If the relevance score is below the threshold:

``` text
Question
   ↓
Retrieval
   ↓
Reranking
   ↓
Relevance Gate FAIL
   ↓
Controlled Refusal
```

This prevents obviously unsupported questions from reaching the
generation stage.

------------------------------------------------------------------------

# 10. Grounded Generation

The generation layer uses:

**Ollama + `llama3.2:3b`**

The LLM receives:

-   the original user question
-   retrieved document context
-   strict grounding instructions

The prompt explicitly instructs the model to:

-   use only the provided context
-   avoid outside knowledge
-   avoid unsupported assumptions
-   avoid adding unrelated explanations
-   avoid unsupported examples
-   avoid inventing implementation details
-   refuse when the context is insufficient

This is important because a RAG system is only useful if the generation
stage actually respects retrieved evidence.

------------------------------------------------------------------------

# 11. Answer Grounding Validator

A major part of the project is post-generation validation.

The system does not automatically trust the generated answer.

The answer is split into claims and each claim is checked against the
retrieved context.

Validation uses:

-   normalized text
-   lexical support
-   semantic similarity
-   supporting context tracking

Current semantic support threshold:

``` text
0.65
```

Conceptually:

``` text
Generated Answer
       ↓
Split into claims
       ↓
Check each claim
       ↓
Evidence support?
   ┌───────┴───────┐
   │               │
  YES              NO
   │               │
Continue        Reject answer
```

This provides a second layer of protection after retrieval.

------------------------------------------------------------------------

# 12. Retry + Controlled Refusal

One of the important reliability improvements is the retry mechanism.

If the generated answer fails grounding:

``` text
Initial Answer
      ↓
Grounding Validator
      ↓
FAIL
      ↓
Second LLM Attempt
      ↓
Grounding Validator
```

The second prompt becomes even stricter.

It explicitly tells the model:

-   the previous answer was rejected
-   do not use outside knowledge
-   do not fill missing information
-   do not infer relationships
-   do not expand beyond the evidence
-   if any part is unsupported, do not include it

If the second answer still fails:

``` text
Controlled Refusal
```

Current refusal:

``` text
I don't have enough information in the uploaded documents to answer that question.
```

This is a strong reliability feature because the system prefers refusing
over returning an unsupported answer.

------------------------------------------------------------------------

# 13. Evaluation System

A dedicated evaluation pipeline was built instead of judging the project
only by manually asking questions.

Current evaluation dataset:

``` text
20 total questions
15 answerable React questions
5 unsupported / unanswerable questions
```

The evaluation checks:

-   retrieval success
-   expected source retrieval
-   expected source rank
-   reranker survival
-   relevance gate
-   answer grounding
-   unsupported claims
-   refusal behavior

This makes the project measurable and repeatable.

------------------------------------------------------------------------

# 14. Evaluation Metrics

## Recall@5

Measures whether the expected source was retrieved in the top 5.

Current result:

``` text
100%
15 / 15
```

This means every answerable evaluation question had its expected source
retrieved within the top 5.

------------------------------------------------------------------------

## MRR

Mean Reciprocal Rank measures how high the expected source appears.

Current result:

``` text
1.000
```

This means the expected source was ranked first for the evaluated
answerable questions.

------------------------------------------------------------------------

## Reranker Survival

Measures whether the expected source remains after reranking.

Current result:

``` text
100%
15 / 15
```

This shows that the reranker did not remove the expected evidence from
the top 3 for the current evaluation set.

------------------------------------------------------------------------

## Refusal Accuracy

Measures whether unsupported questions are correctly rejected.

Current result:

``` text
100%
5 / 5
```

This is especially important for a grounded AI system because
unsupported questions should not produce confident hallucinated answers.

------------------------------------------------------------------------

## Answer Grounding

After the retry + refusal mechanism:

``` text
100%
```

The current evaluation produced no final unsupported claims because
unsupported generations were rejected and converted into controlled
refusals.

Important distinction:

> This metric measures whether the final answer passed the project's
> grounding policy. A refusal is treated as safe/grounded behavior.

It should not be interpreted as saying every answerable question was
answered successfully.

------------------------------------------------------------------------

## Unsupported Claim Rate

Current result:

``` text
0%
0 / 7
```

The system did not return unsupported claims in the final evaluated
answers.

This is one of the strongest reliability results of the current
pipeline.

------------------------------------------------------------------------

# 15. Current Evaluation Results

``` text
=================================
GROUNDED AI EVALUATION
=================================

Dataset: 20 questions

Grounding accuracy:      86.7%
Refusal accuracy:        100.0%
Overall accuracy:        90.0%

Answer grounding:        100.0%
Unsupported claim rate:  0.0%

Recall@5:                100.0%
MRR:                     1.000
Reranker survival:      100.0%

Retrieval hits:          15/15
Reranker hits:           15/15
Grounded answers:        13/13
Unsupported claims:      0/7
```

------------------------------------------------------------------------

# 16. Important Interpretation of the Metrics

The current metrics need to be interpreted correctly.

The retrieval pipeline is performing very well:

``` text
Recall@5       = 100%
MRR            = 1.000
Reranker       = 100%
```

The safety layer is also strong:

``` text
Refusal accuracy       = 100%
Answer grounding       = 100%
Unsupported claims     = 0%
```

The remaining weakness is **evidence coverage and answerability**, not
basic retrieval.

Some questions retrieve the correct source, but the selected top-3
context does not always contain enough explicit information to answer
the question.

For example, a source may mention that components are reusable, while
the question asks whether they can be reused throughout an application.
A model may try to make that broader connection even though the exact
statement is not present.

The current system correctly chooses to refuse rather than invent the
missing relationship.

------------------------------------------------------------------------

# 17. Example of the Safety System Working

Question:

``` text
How can React components be combined?
```

The retrieved context did not explicitly provide enough evidence about
the requested JSX relationship.

The LLM initially produced an answer involving JSX.

The grounding validator rejected it.

The retry also failed grounding.

The system therefore returned:

``` text
I don't have enough information in the uploaded documents to answer that question.
```

This is intentional behavior.

The system is designed to optimize for:

``` text
Evidence > Confidence
```

rather than:

``` text
Always answer
```

------------------------------------------------------------------------

# 18. Architecture

A simplified project architecture is:

``` text
src/
├── ingestion/
│   ├── PDF loader
│   └── Markdown loader
│
├── embeddings/
│   ├── embedding model
│   └── embedder
│
├── retrieval/
│   ├── vector store
│   ├── BM25 store
│   ├── hybrid retriever
│   ├── reranker
│   └── relevance gate
│
├── generation/
│   └── local Ollama LLM
│
├── evaluation/
│   ├── dataset
│   ├── answer grounding
│   └── evaluation runner
│
└── API / application layer
```

The actual project has additional infrastructure and supporting modules
around these core components.

------------------------------------------------------------------------

# 19. Engineering Decisions

## Local-first AI

The system intentionally avoids paid external AI APIs.

Benefits:

-   no API billing
-   no API key requirement for inference
-   documents remain local
-   reproducible local development
-   easier experimentation

------------------------------------------------------------------------

## Hybrid Retrieval Instead of Vector-Only Retrieval

Vector search is strong for semantic similarity, but keyword search is
useful for technical terminology and exact matches.

Combining them makes the retrieval system more robust.

------------------------------------------------------------------------

## Reranking Instead of Trusting Initial Retrieval

Initial retrieval optimizes recall.

Reranking improves precision.

This gives the architecture a clear two-stage retrieval strategy.

------------------------------------------------------------------------

## Validation After Generation

Many RAG systems stop after:

``` text
Retrieve → Generate
```

Grounded AI adds:

``` text
Retrieve → Rerank → Generate → Validate
```

This makes the LLM output testable instead of blindly trusted.

------------------------------------------------------------------------

## Refusal as a Feature

The system intentionally supports refusal.

For a document-grounded assistant:

``` text
Correct refusal
```

is better than:

``` text
Confident hallucination
```

------------------------------------------------------------------------

# 20. Problems Solved During Development

The project went through several iterations.

Important problems addressed include:

### External API dependency

The initial embedding approach encountered API quota/billing
limitations.

Solution:

``` text
Local Hugging Face embeddings
+
Local Ollama inference
```

------------------------------------------------------------------------

### Weak retrieval from abbreviations

Questions such as:

``` text
What are JS props?
```

could retrieve less reliably.

Solution:

``` text
Query normalization
```

------------------------------------------------------------------------

### Retrieval alone was not enough

Even with relevant documents retrieved, the LLM could produce
unsupported information.

Solution:

``` text
Answer grounding validator
```

------------------------------------------------------------------------

### LLM could still hallucinate after a strict prompt

Prompt-only grounding was not considered sufficient.

Solution:

``` text
Generate
→ Validate
→ Retry
→ Refuse
```

------------------------------------------------------------------------

### Unsupported questions could produce plausible answers

Solution:

``` text
Relevance Gate
+
Controlled Refusal
```

------------------------------------------------------------------------

### Evaluation was initially too coarse

The project evolved from simply checking whether retrieval passed to
separately measuring:

-   retrieval
-   reranking
-   relevance
-   answer grounding
-   unsupported claims
-   refusal behavior

This made the evaluation more meaningful.

------------------------------------------------------------------------

# 21. Current Limitations

The current system is intentionally not presented as a perfect RAG
system.

Known limitations:

1.  Evidence coverage is not yet measured as a first-class metric.
2.  Some answerable questions may be refused when the top-3 evidence is
    insufficient.
3.  The relevance threshold can produce false negatives for borderline
    reranker scores.
4.  The current grounding validator contains heuristic
    lexical/relationship checks.
5.  The evaluation dataset is currently focused mainly on
    React/JavaScript-style technical content.
6.  The current evaluation does not yet represent a large
    production-scale benchmark.
7.  Local 3B inference is less capable than larger hosted models, but
    provides privacy and zero API cost.

These limitations are useful engineering signals rather than hidden
weaknesses.

------------------------------------------------------------------------

# 22. Planned Next Improvement

The next planned improvement is **Evidence Coverage**.

Current architecture:

``` text
Hybrid Retrieval
      ↓
Top 5
      ↓
Reranker
      ↓
Top 3
      ↓
LLM
      ↓
Grounding Validator
```

Planned architecture:

``` text
Hybrid Retrieval
      ↓
Top 5
      ↓
Reranker
      ↓
Top 3
      ↓
Evidence Coverage Check
      ↓
LLM
      ↓
Grounding Validator
      ↓
Retry / Refusal
```

The purpose is to determine whether the selected context actually
contains enough evidence to support the expected answer.

A possible future optimization is:

``` text
Top 3 evidence insufficient
        ↓
Selectively add relevant 4th/5th chunk
        ↓
Generate
        ↓
Validate
```

This should be driven by evaluation rather than blindly increasing the
context size.

------------------------------------------------------------------------

# 23. What Recruiters Should Notice

The strongest recruiter-facing aspects of this project are not the UI or
the fact that an LLM was connected.

The important engineering points are:

### 1. End-to-end RAG implementation

The project demonstrates the full pipeline:

``` text
Ingestion
→ Chunking
→ Embeddings
→ Vector Retrieval
→ BM25
→ Hybrid Ranking
→ Reranking
→ Relevance Gating
→ LLM Generation
→ Answer Validation
```

### 2. Local AI infrastructure

The project runs embeddings and inference locally using Hugging Face and
Ollama.

This demonstrates understanding of AI infrastructure beyond simply
calling an API.

### 3. Hybrid retrieval

Using both vector retrieval and BM25 demonstrates knowledge of the
strengths and weaknesses of different search methods.

### 4. Reranking

A dedicated cross-encoder reranker shows understanding of multi-stage
information retrieval.

### 5. Hallucination control

The system does not blindly trust the LLM.

It validates generated claims and refuses unsupported answers.

### 6. Evaluation-driven development

The project has a dedicated benchmark and quantitative metrics.

This is much stronger than saying:

> "I built a RAG chatbot."

### 7. Failure handling

The system handles failure explicitly:

``` text
Bad retrieval
→ Relevance refusal

Bad generation
→ Grounding rejection

Retry failure
→ Controlled refusal
```

### 8. Measurable results

Current benchmark:

``` text
Recall@5:           100%
MRR:                1.000
Reranker survival: 100%
Refusal accuracy:   100%
Unsupported claims: 0%
```

These metrics provide evidence that the system works on its current
evaluation dataset.

------------------------------------------------------------------------

# 24. Resume Version

A concise resume description could be:

**Grounded AI --- Local RAG Document Intelligence System**

-   Built a TypeScript/Node.js RAG pipeline using local Hugging Face
    embeddings, BM25 + vector hybrid retrieval, cross-encoder reranking,
    Ollama inference, relevance gating, and answer-level grounding
    validation.
-   Implemented hallucination control using claim-level evidence
    validation, automatic retry, and controlled refusal when generated
    content cannot be supported by retrieved documents.
-   Built an evaluation framework covering Recall@5, MRR, reranker
    survival, refusal accuracy, answer grounding, and unsupported-claim
    rate; achieved 100% Recall@5, 1.000 MRR, 100% reranker survival,
    100% refusal accuracy, and 0% unsupported final claims on a
    20-question benchmark.
-   Designed the system as a local/free AI stack, eliminating dependency
    on paid inference and embedding APIs while keeping document
    processing local.

------------------------------------------------------------------------

# 25. Interview Explanation

If asked:

**"Tell me about your Grounded AI project."**

A strong explanation is:

> I built a local document intelligence system using RAG. The
> interesting part is that I didn't treat the LLM as the source of
> truth. Documents are ingested and chunked, then embedded locally using
> MiniLM. For retrieval I combine vector similarity with BM25, then
> rerank the top candidates using a cross-encoder. Before generation I
> apply a relevance gate. After the LLM generates an answer, I validate
> its claims against the retrieved evidence. If the answer is
> unsupported, I retry with a stricter prompt, and if it still fails,
> the system refuses instead of hallucinating. I also built an
> evaluation pipeline to measure retrieval quality, reranking, refusal
> behavior, and answer grounding.

------------------------------------------------------------------------

# 26. Key Technical Concepts Demonstrated

This project demonstrates practical understanding of:

-   RAG architecture
-   embeddings
-   semantic search
-   vector similarity
-   BM25
-   hybrid retrieval
-   cross-encoder reranking
-   relevance thresholds
-   prompt engineering
-   hallucination mitigation
-   claim-level validation
-   local LLM inference
-   document ingestion
-   chunking
-   metadata tracking
-   evaluation datasets
-   Recall@K
-   MRR
-   precision-oriented reranking
-   failure handling
-   TypeScript
-   Node.js
-   modular backend architecture
-   asynchronous processing

------------------------------------------------------------------------

# 27. Project Maturity

The project should be presented as:

**An engineered RAG system with evaluation and hallucination controls**

rather than simply:

**An AI chatbot.**

That distinction matters.

The strongest story is:

``` text
I built it
    ↓
I measured it
    ↓
I found failure cases
    ↓
I analyzed why they failed
    ↓
I added validation and refusal behavior
    ↓
I measured the improved behavior again
```

That demonstrates engineering thinking, not just feature implementation.

------------------------------------------------------------------------

# 28. Current Status

## Completed

-   Local document ingestion
-   PDF / Markdown processing
-   Chunking
-   Local embeddings
-   Vector retrieval
-   BM25 retrieval
-   Hybrid retrieval
-   Query normalization
-   Cross-encoder reranking
-   Relevance gate
-   Local Ollama generation
-   Strict grounding prompt
-   Answer grounding validator
-   Retry mechanism
-   Controlled refusal
-   Evaluation dataset
-   Retrieval metrics
-   Reranker metrics
-   Refusal metrics
-   Answer grounding metrics
-   Unsupported claim tracking

## Next

-   Evidence Coverage metric
-   Better context selection
-   Selective context expansion
-   Larger and more diverse evaluation dataset
-   Further threshold calibration
-   Production-oriented API/UI improvements

------------------------------------------------------------------------

# 29. Final Recruiter Takeaway

Grounded AI demonstrates more than the ability to connect an LLM to a
database.

It demonstrates the ability to build and evaluate an AI system as a
software engineer:

``` text
Data
 ↓
Retrieval
 ↓
Ranking
 ↓
Inference
 ↓
Validation
 ↓
Failure Handling
 ↓
Evaluation
```

The core project philosophy is:

> **Retrieve evidence first, generate from evidence, verify the answer,
> and refuse when the evidence is insufficient.**

That is the central engineering value of Grounded AI.
