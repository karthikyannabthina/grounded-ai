import { readFile } from "fs/promises";
import { BM25Store } from "./bm25.js";
import type { VectorDocument } from "./vectorStore.js";

const indexData = await readFile("data/vector-index.json", "utf-8");

const index = JSON.parse(indexData) as {
  documents: VectorDocument[];
};

const store = new BM25Store();

store.addMany(index.documents);

const queries = [
  "What is React?",
  "What are React props?",
  "What is useState?",
  "JavaScript promises",
  "components",
];

for (const query of queries) {
  console.log(`\nQuery: ${query}`);

  const results = store.search(query, 3);

  if (results.length === 0) {
    console.log("No results");
    continue;
  }

  results.forEach((result, index) => {
    console.log(
      `[${index + 1}] Score: ${result.score.toFixed(3)} | ${result.document.metadata?.source}`
    );
    console.log(result.document.text.slice(0, 180).replace(/\n/g, " "));
  });
}