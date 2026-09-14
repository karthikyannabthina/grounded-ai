import { pipeline } from "@huggingface/transformers";
import { loadPdf } from "../ingestion/pdfLoader.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { VectorStore } from "../retrieval/vectorStore.js";
import { mkdir, writeFile } from "fs/promises";

async function createEmbeddings() {
  // 1. Load PDF
  const documents = await loadPdf("documents/sample.pdf");

  console.log("Documents loaded:", documents.length);

  // 2. Split PDF into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const chunks = await splitter.splitDocuments(documents);

  console.log("Chunks created:", chunks.length);

  // 3. Load local embedding model
  console.log("Loading embedding model...");

  const extractor = await pipeline(
    "feature-extraction",
    "onnx-community/all-MiniLM-L6-v2-ONNX"
  );

  console.log("Embedding model loaded.");

  // 4. Convert chunks into vectors
  const vectors: number[][] = [];

  for (const chunk of chunks) {
    const output = await extractor(chunk.pageContent, {
      pooling: "mean",
      normalize: true,
    });

    vectors.push(Array.from(output.data));
  }

  console.log("Vectors created:", vectors.length);

  // 5. Inspect first vector
  console.log(
    "First vector length:",
    vectors[0]?.length
  );

  // 6. Create vector store
  const vectorStore = new VectorStore();

  // 7. Combine chunks + vectors
  const vectorDocuments = chunks.map(
    (chunk, index) => ({
      text: chunk.pageContent,
      embedding: vectors[index]!,
      metadata: chunk.metadata,
    })
  );

  // 8. Store all vectors in memory
  vectorStore.addMany(vectorDocuments);

  console.log(
    "Vector store size:",
    vectorStore.size
  );

  // 9. Persist vector index to disk
  const indexPath = "data/vector-index.json";

  await mkdir("data", {
    recursive: true,
  });

  const index = {
    model: "onnx-community/all-MiniLM-L6-v2-ONNX",
    dimensions: vectors[0]?.length ?? 384,
    documents: vectorDocuments,
  };

  await writeFile(
    indexPath,
    JSON.stringify(index, null, 2),
    "utf-8"
  );

  console.log(
    `Vector index saved: ${indexPath}`
  );

  // 10. Test similarity search
  // We use the first vector as the query just to verify
  // that our similarity-search algorithm works.
  const results = vectorStore.search(
    vectors[0]!,
    3
  );

  console.log("\nTop 3 results:");

  results.forEach((result, index) => {
    console.log(
      `\n--- Result ${index + 1} ---`
    );

    console.log(result.document.text);

    console.log(
      "Metadata:",
      result.document.metadata
    );
  });
}

createEmbeddings();