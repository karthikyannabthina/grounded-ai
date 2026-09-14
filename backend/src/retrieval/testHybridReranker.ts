import { readFile } from "fs/promises";
import { HybridRetriever } from "./hybridRetriever.js";
import type { VectorDocument } from "./vectorStore.js";
import { rerank } from "./reranker.js";

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

async function main() {
  const documents = await loadDocuments();

  console.log("Documents loaded:", documents.length);

  const retriever = new HybridRetriever(documents);

  const queries = [
  "What are React props?",
  "How does data move from parent to child?",
  "What is useState?",
  "What are React components?",
  "What is useEffect?",
  "How do React components receive data?",
  "How do you update state in React?",

  "What are JavaScript promises?",
  "What is Docker?",
  "What is PostgreSQL?",
  "What is Kubernetes?",
  "How does JWT authentication work?",
];

  for (const query of queries) {
    console.log("\n================================");
    console.log(`Query: ${query}`);
    console.log("================================");

    // Stage 1:
    // Hybrid retrieval gets a larger candidate pool.
    const candidates = await retriever.search(
      query,
      5,
      0.6,
      0.4
    );

    console.log("\nHybrid candidates:");

    candidates.forEach((result, index) => {
      console.log(
        `[${index + 1}] Hybrid: ${result.hybridScore.toFixed(3)} ` +
        `(vector: ${result.vectorScore.toFixed(3)}, ` +
        `bm25: ${result.bm25Score.toFixed(3)})`
      );

      console.log(
        result.document.text
          .slice(0, 180)
          .replace(/\n/g, " ")
      );
    });

    // Stage 2:
    // Cross-encoder reranks only the candidates.
    const reranked = await rerank(
      query,
      candidates.map((result) => result.document.text),
      3
    );

    console.log("\nReranked:");

    reranked.forEach((result, index) => {
      console.log(
        `[${index + 1}] Reranker: ${result.score.toFixed(3)}`
      );

      console.log(
        result.document
          .slice(0, 250)
          .replace(/\n/g, " ")
      );
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});