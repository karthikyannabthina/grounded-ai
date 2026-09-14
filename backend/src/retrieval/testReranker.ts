import { readFile } from "fs/promises";
import { rerank } from "./reranker.js";
import type { VectorDocument } from "./vectorStore.js";

const indexData = await readFile("data/vector-index.json", "utf-8");

const index = JSON.parse(indexData) as {
  documents: VectorDocument[];
};

const queries = [
  "What are React props?",
  "How does data move from parent to child?",
  "What is useState?",
  "JavaScript promises",
];

for (const query of queries) {
  console.log(`\n================================`);
  console.log(`Query: ${query}`);
  console.log(`================================`);

  const documents = index.documents.map((document) => document.text);

  const results = await rerank(query, documents, 3);

  results.forEach((result, index) => {
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