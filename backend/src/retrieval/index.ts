import { mkdir, writeFile } from "fs/promises";
import { loadPdf } from "../ingestion/pdfLoader.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embedText } from "../embeddings/embeddingModel.js";
import { VectorStore } from "./vectorStore.js";

const INDEX_PATH = "data/vector-index.json";
const EMBEDDING_MODEL = "onnx-community/all-MiniLM-L6-v2-ONNX";

async function main() {
  const documents = await loadPdf("documents/sample.pdf");

  console.log("Documents loaded:", documents.length);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const chunks = await splitter.splitDocuments(documents);

  console.log("Chunks created:", chunks.length);
  console.log("Creating embeddings...");

  const vectorStore = new VectorStore();

  for (const chunk of chunks) {
    const embedding = await embedText(chunk.pageContent);

    vectorStore.add({
      text: chunk.pageContent,
      embedding,
      metadata: chunk.metadata,
    });
  }

  await mkdir("data", { recursive: true });

  const index = {
    model: EMBEDDING_MODEL,
    dimensions: vectorStore.getDocuments()[0]?.embedding.length ?? 0,
    documents: vectorStore.getDocuments(),
  };

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");

  console.log("Embeddings created:", vectorStore.size);
  console.log("Vector dimensions:", index.dimensions);
  console.log("Index saved:", INDEX_PATH);
}

main();