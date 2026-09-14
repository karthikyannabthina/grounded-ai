import { readFile } from "fs/promises";
import { HybridRetriever } from "./hybridRetriever.js";
import type { VectorDocument } from "./vectorStore.js";

const indexData = await readFile("data/vector-index.json", "utf-8");

const index = JSON.parse(indexData) as {
  documents: VectorDocument[];
};

const retriever = new HybridRetriever(index.documents);

const queries = [
  "What is React?",
  "What are React props?",
  "What is useState?",
  "How does data move from parent to child?",
  "JavaScript promises",
  "components",
];

for (const query of queries) {
  console.log(`\n================================`);
  console.log(`Query: ${query}`);
  console.log(`================================`);

  const results = await retriever.search(query, 3);

  if (results.length === 0) {
    console.log("No results");
    continue;
  }

  results.forEach((result, index) => {
    console.log(
      `[${index + 1}] Hybrid: ${result.hybridScore.toFixed(3)} | Vector: ${result.vectorScore.toFixed(3)} | BM25: ${result.bm25Score.toFixed(3)} | ${result.document.metadata?.source}`
    );

    console.log(
      result.document.text
        .slice(0, 180)
        .replace(/\n/g, " ")
    );
  });
}