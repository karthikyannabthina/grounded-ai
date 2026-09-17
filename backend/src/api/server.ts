import express from "express";
import cors from "cors";

import {
  getVectorStore,
  getHybridRetriever,
} from "../retrieval/vectorStoreManager.js";

import {
  generateAnswer,
  streamAnswer,
} from "../generation/llm.js";
import { rerank } from "../retrieval/reranker.js";
import { checkRelevance } from "../retrieval/relevanceGate.js";

import uploadRouter from "./upload.js";
import documentsRouter from "./documents.js";
import webRouter from "./web.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const VECTOR_WEIGHT = 0.6;
const BM25_WEIGHT = 0.4;

const REFUSAL_MESSAGE =
  "I don't have enough information in the uploaded documents to answer that question.";

app.use(cors());
app.use(express.json());

/* ---------------------------------------
   Document APIs
--------------------------------------- */

app.use("/api/upload", uploadRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/web", webRouter);

/* ---------------------------------------
   Health Check
--------------------------------------- */

app.get("/health", async (_req, res) => {
  try {
    const vectorStore = await getVectorStore();

    res.json({
      success: true,
      message: "Grounded AI API is running",
      documents: vectorStore.size,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load vector store",
    });
  }
});

/* ---------------------------------------
   Chat / RAG Pipeline
--------------------------------------- */

app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;

    /* ---------------------------------------
       Validate question
    --------------------------------------- */

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    /* ---------------------------------------
       Normalize technical abbreviations

       Important:
       - Retrieval uses normalized query
       - Ollama receives original question
    --------------------------------------- */

    const normalizedQuestion = question
      .replace(/\bjs\b/gi, "JavaScript")
      .replace(/\bnodejs\b/gi, "Node.js")
      .replace(/\bnode\b/gi, "Node.js")
      .replace(/\bts\b/gi, "TypeScript")
      .replace(/\bmongo\b/gi, "MongoDB")
      .trim();

    /* ---------------------------------------
       Get hybrid retriever
    --------------------------------------- */

    const retriever = await getHybridRetriever();

    /* ---------------------------------------
       Hybrid Retrieval

       Vector Search = 60%
       BM25 = 40%

       Retrieve top 5 candidates
    --------------------------------------- */

    const hybridResults = await retriever.search(
      normalizedQuestion,
      5,
      VECTOR_WEIGHT,
      BM25_WEIGHT
    );

    /* ---------------------------------------
       No retrieval results
    --------------------------------------- */

    if (hybridResults.length === 0) {
      return res.json({
        success: true,

        answer: REFUSAL_MESSAGE,

        grounded: false,

        observability: {
          normalizedQuery: normalizedQuestion,
          retrievedCount: 0,
          rerankedCount: 0,
          relevanceScore: null,
          relevanceThreshold: null,
          vectorWeight: VECTOR_WEIGHT,
          bm25Weight: BM25_WEIGHT,
        },

        sources: [],
      });
    }

    /* ---------------------------------------
       Reranking

       Take retrieved documents and let the
       cross-encoder determine relevance.

       Top 3 are kept.
    --------------------------------------- */

    const rerankedResults = await rerank(
      normalizedQuestion,
      hybridResults.map(
        (result) => result.document.text
      ),
      3
    );

    /* ---------------------------------------
       No reranking results
    --------------------------------------- */

    if (rerankedResults.length === 0) {
      return res.json({
        success: true,

        answer: REFUSAL_MESSAGE,

        grounded: false,

        observability: {
          normalizedQuery: normalizedQuestion,
          retrievedCount: hybridResults.length,
          rerankedCount: 0,
          relevanceScore: null,
          relevanceThreshold: null,
          vectorWeight: VECTOR_WEIGHT,
          bm25Weight: BM25_WEIGHT,
        },

        sources: [],
      });
    }

    /* ---------------------------------------
       Top reranked result
    --------------------------------------- */

    const topResult = rerankedResults[0];

    if (!topResult) {
      return res.json({
        success: true,

        answer: REFUSAL_MESSAGE,

        grounded: false,

        observability: {
          normalizedQuery: normalizedQuestion,
          retrievedCount: hybridResults.length,
          rerankedCount: rerankedResults.length,
          relevanceScore: null,
          relevanceThreshold: null,
          vectorWeight: VECTOR_WEIGHT,
          bm25Weight: BM25_WEIGHT,
        },

        sources: [],
      });
    }

    /* ---------------------------------------
       Relevance Gate

       Prevent the LLM from answering when
       retrieved context is not relevant.
    --------------------------------------- */

    const relevance = checkRelevance(
      topResult.score
    );

    /* ---------------------------------------
       Refuse unsupported questions
    --------------------------------------- */

    if (!relevance.relevant) {
      return res.json({
        success: true,

        answer: REFUSAL_MESSAGE,

        grounded: false,

        observability: {
          normalizedQuery: normalizedQuestion,
          retrievedCount: hybridResults.length,
          rerankedCount: rerankedResults.length,

          relevanceScore: Number(
            relevance.score.toFixed(3)
          ),

          relevanceThreshold:
            relevance.threshold,

          vectorWeight: VECTOR_WEIGHT,
          bm25Weight: BM25_WEIGHT,
        },

        sources: [],
      });
    }

    /* ---------------------------------------
       Build context for Ollama
    --------------------------------------- */

    const context = rerankedResults
      .map((result) => result.document)
      .join("\n\n");

    /* ---------------------------------------
       Generate answer

       IMPORTANT:
       Original user question is sent to the
       LLM, not the normalized query.
    --------------------------------------- */

    const answer = await generateAnswer(
      question,
      context
    );

    /* ---------------------------------------
       Build source metadata
    --------------------------------------- */

    const sources = rerankedResults.map(
      (result, index) => {
        const originalResult =
          hybridResults.find(
            (hybridResult) =>
              hybridResult.document.text ===
              result.document
          );

        const source =
          originalResult?.document.metadata?.source ??
          "Unknown source";

        let page: string | number =
          "Unknown page";

        const location =
          originalResult?.document.metadata?.loc;

        if (
          location &&
          typeof location === "object" &&
          location !== null &&
          "pageNumber" in location
        ) {
          page =
            location.pageNumber as
              | string
              | number;
        }

        return {
          rank: index + 1,
          source,
          page,

          score: Number(
            result.score.toFixed(3)
          ),

          text: result.document,
        };
      }
    );

    /* ---------------------------------------
       Successful grounded response
    --------------------------------------- */

    return res.json({
      success: true,

      answer,

      grounded: true,

      observability: {
        normalizedQuery: normalizedQuestion,

        retrievedCount:
          hybridResults.length,

        rerankedCount:
          rerankedResults.length,

        relevanceScore: Number(
          relevance.score.toFixed(3)
        ),

        relevanceThreshold:
          relevance.threshold,

        vectorWeight: VECTOR_WEIGHT,

        bm25Weight: BM25_WEIGHT,
      },

      sources,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to process question",
    });
  }
});

/* ---------------------------------------
   Streaming Chat / RAG Pipeline
--------------------------------------- */

app.post("/api/chat/stream", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    const normalizedQuestion = question
      .replace(/\bjs\b/gi, "JavaScript")
      .replace(/\bnodejs\b/gi, "Node.js")
      .replace(/\bnode\b/gi, "Node.js")
      .replace(/\bts\b/gi, "TypeScript")
      .replace(/\bmongo\b/gi, "MongoDB")
      .trim();

    const retriever =
      await getHybridRetriever();

    const hybridResults =
      await retriever.search(
        normalizedQuestion,
        5,
        VECTOR_WEIGHT,
        BM25_WEIGHT
      );

    if (hybridResults.length === 0) {
      return res.json({
        success: true,
        grounded: false,
        answer: REFUSAL_MESSAGE,
        sources: [],
      });
    }

    const rerankedResults =
      await rerank(
        normalizedQuestion,
        hybridResults.map(
          (result) => result.document.text
        ),
        3
      );

    if (rerankedResults.length === 0) {
      return res.json({
        success: true,
        grounded: false,
        answer: REFUSAL_MESSAGE,
        sources: [],
      });
    }

    const topResult =
      rerankedResults[0];

    if (!topResult) {
      return res.json({
        success: true,
        grounded: false,
        answer: REFUSAL_MESSAGE,
        sources: [],
      });
    }

    const relevance =
      checkRelevance(
        topResult.score
      );

    if (!relevance.relevant) {
      return res.json({
        success: true,

        grounded: false,

        answer: REFUSAL_MESSAGE,

        observability: {
          normalizedQuery:
            normalizedQuestion,

          retrievedCount:
            hybridResults.length,

          rerankedCount:
            rerankedResults.length,

          relevanceScore: Number(
            relevance.score.toFixed(3)
          ),

          relevanceThreshold:
            relevance.threshold,

          vectorWeight:
            VECTOR_WEIGHT,

          bm25Weight:
            BM25_WEIGHT,
        },

        sources: [],
      });
    }

    const context =
      rerankedResults
        .map(
          (result) =>
            result.document
        )
        .join("\n\n");

    /* -----------------------------------
       Prepare metadata
    ----------------------------------- */

    const sources =
      rerankedResults.map(
        (result, index) => {
          const originalResult =
            hybridResults.find(
              (hybridResult) =>
                hybridResult.document.text ===
                result.document
            );

          const source =
            originalResult?.document.metadata
              ?.source ??
            "Unknown source";

          let page:
            | string
            | number =
            "Unknown page";

          const location =
            originalResult?.document.metadata
              ?.loc;

          if (
            location &&
            typeof location ===
              "object" &&
            location !== null &&
            "pageNumber" in location
          ) {
            page =
              location.pageNumber as
                | string
                | number;
          }

          return {
            rank: index + 1,
            source,
            page,

            score: Number(
              result.score.toFixed(3)
            ),

            text: result.document,
          };
        }
      );

    /* -----------------------------------
       Send streaming response
    ----------------------------------- */

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/event-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    res.flushHeaders();

    /* -----------------------------------
       Send metadata first
    ----------------------------------- */

    res.write(
      `data: ${JSON.stringify({
        type: "metadata",

        grounded: true,

        observability: {
          normalizedQuery:
            normalizedQuestion,

          retrievedCount:
            hybridResults.length,

          rerankedCount:
            rerankedResults.length,

          relevanceScore: Number(
            relevance.score.toFixed(3)
          ),

          relevanceThreshold:
            relevance.threshold,

          vectorWeight:
            VECTOR_WEIGHT,

          bm25Weight:
            BM25_WEIGHT,
        },

        sources,
      })}\n\n`
    );

    /* -----------------------------------
       Stream Ollama tokens
    ----------------------------------- */

    await streamAnswer(
      question,
      context,
      (token) => {
        res.write(
          `data: ${JSON.stringify({
            type: "token",
            token,
          })}\n\n`
        );
      }
    );

    /* -----------------------------------
       Stream complete
    ----------------------------------- */

    res.write(
      `data: ${JSON.stringify({
        type: "done",
      })}\n\n`
    );

    res.end();
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to process streaming question",
      });
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message:
          "Failed to generate answer",
      })}\n\n`
    );

    res.end();
  }
});

/* ---------------------------------------
   Start Server
--------------------------------------- */

app.listen(PORT, () => {
  console.log(
    `Grounded AI API running on port ${PORT}`
  );
});