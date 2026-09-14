import { readFile } from "fs/promises";
import readline from "readline";

import type { VectorDocument } from "./vectorStore.js";
import { HybridRetriever } from "./hybridRetriever.js";
import { rerank } from "./reranker.js";
import { checkRelevance } from "./relevanceGate.js";
import { generateAnswer } from "../generation/llm.js";

const INDEX_PATH = "data/vector-index.json";

async function loadDocuments(): Promise<VectorDocument[]> {
  const indexData = await readFile(INDEX_PATH, "utf-8");

  const index = JSON.parse(indexData) as {
    model: string;
    dimensions: number;
    documents: VectorDocument[];
  };

  return index.documents;
}

/**
 * Normalize common technical abbreviations before retrieval.
 *
 * This improves retrieval without changing
 * the original question sent to the LLM.
 */
function normalizeQuery(question: string): string {
  return question
    .replace(/\bjs\b/gi, "JavaScript")
    .replace(/\bnodejs\b/gi, "Node.js")
    .replace(/\bnode\b/gi, "Node.js")
    .replace(/\bts\b/gi, "TypeScript")
    .replace(/\bmongo\b/gi, "MongoDB")
    .trim();
}

async function askQuestion(
  retriever: HybridRetriever,
  question: string
): Promise<void> {
  // Keep original question for Ollama.
  const normalizedQuestion = normalizeQuery(question);

  console.log("\nSearching documents...");

  // --------------------------------------------------
  // 1. HYBRID RETRIEVAL
  // --------------------------------------------------

  const hybridResults = await retriever.search(
    normalizedQuestion,
    5
  );

  if (hybridResults.length === 0) {
    console.log("\nAI:");
    console.log(
      "I don't have enough information in the uploaded documents to answer that question."
    );
    return;
  }

  // --------------------------------------------------
  // 2. RERANK TOP 5 HYBRID RESULTS
  // --------------------------------------------------

  const rerankedResults = await rerank(
    normalizedQuestion,
    hybridResults.map((result) => result.document.text),
    3
  );

  if (rerankedResults.length === 0) {
    console.log("\nAI:");
    console.log(
      "I don't have enough information in the uploaded documents to answer that question."
    );
    return;
  }

  // --------------------------------------------------
  // 3. RELEVANCE GATE
  // --------------------------------------------------

  const topResult = rerankedResults[0];

  if (!topResult) {
    console.log("\nAI:");
    console.log(
      "I don't have enough information in the uploaded documents to answer that question."
    );
    return;
  }

  const relevance = checkRelevance(topResult.score);

  console.log(
    `Top reranker score: ${relevance.score.toFixed(3)}`
  );

  console.log(
    relevance.relevant
      ? "RELEVANT"
      : "IRRELEVANT"
  );

  // Do NOT call Ollama when evidence is irrelevant.
  if (!relevance.relevant) {
    console.log("\nAI:");
    console.log(
      "I don't have enough information in the uploaded documents to answer that question."
    );
    return;
  }

  // --------------------------------------------------
  // 4. BUILD GROUNDED CONTEXT
  // --------------------------------------------------

  const context = rerankedResults
    .map((result) => result.document)
    .join("\n\n");

  // IMPORTANT:
  // Original question → Ollama
  // Normalized question → retrieval/reranker
  const answer = await generateAnswer(
    question,
    context
  );

  console.log("\nAI:");
  console.log(answer);

  // --------------------------------------------------
  // 5. SOURCES
  // --------------------------------------------------

  console.log("\nSources:");

  rerankedResults.forEach((result, index) => {
    // Find the original VectorDocument so that
    // we can recover source/page metadata.
    const originalResult = hybridResults.find(
      (hybridResult) =>
        hybridResult.document.text === result.document
    );

    const source =
      originalResult?.document.metadata?.source ??
      "Unknown source";

    const page =
      originalResult?.document.metadata?.loc &&
      typeof originalResult.document.metadata.loc === "object" &&
      originalResult.document.metadata.loc !== null &&
      "pageNumber" in originalResult.document.metadata.loc
        ? originalResult.document.metadata.loc.pageNumber
        : "Unknown page";

    console.log(
      `[${index + 1}] ${source} — Page ${page} — Reranker Score: ${result.score.toFixed(3)}`
    );
  });
}

async function main() {
  // Load persisted documents.
  const documents = await loadDocuments();

  // HybridRetriever expects VectorDocument[].
  const retriever = new HybridRetriever(documents);

  console.log("Grounded AI");
  console.log(`Loaded ${documents.length} vector documents`);
  console.log("Hybrid retrieval + reranker + relevance gate");
  console.log("Type 'exit' to quit");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = () => {
    rl.question("\nYou: ", async (question) => {
      const trimmedQuestion = question.trim();

      if (!trimmedQuestion) {
        ask();
        return;
      }

      if (trimmedQuestion.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      try {
        await askQuestion(
          retriever,
          trimmedQuestion
        );
      } catch (error) {
        console.error("\nError:", error);
      }

      ask();
    });
  };

  ask();
}

main();