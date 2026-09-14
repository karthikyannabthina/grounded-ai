import { readFile } from "fs/promises";

import { VectorStore } from "./vectorStore.js";
import type { VectorDocument } from "./vectorStore.js";
import { HybridRetriever } from "./hybridRetriever.js";

const INDEX_PATH = "data/vector-index.json";

let vectorStore: VectorStore | null = null;
let hybridRetriever: HybridRetriever | null = null;

async function readDocuments(): Promise<VectorDocument[]> {
  const indexData = await readFile(INDEX_PATH, "utf-8");

  const index = JSON.parse(indexData) as {
    model: string;
    dimensions: number;
    documents: VectorDocument[];
  };

  return index.documents;
}

/**
 * Load the persisted vector index and rebuild
 * both VectorStore and BM25Store.
 */
export async function loadVectorStore(): Promise<VectorStore> {
  const documents = await readDocuments();

  const store = new VectorStore();
  store.addMany(documents);

  vectorStore = store;

  // Rebuild hybrid retrieval indexes too.
  hybridRetriever = new HybridRetriever(documents);

  return store;
}

/**
 * Get the currently loaded VectorStore.
 */
export async function getVectorStore(): Promise<VectorStore> {
  if (!vectorStore) {
    await loadVectorStore();
  }

  return vectorStore!;
}

/**
 * Get the currently loaded HybridRetriever.
 */
export async function getHybridRetriever(): Promise<HybridRetriever> {
  if (!hybridRetriever) {
    await loadVectorStore();
  }

  return hybridRetriever!;
}

/**
 * Reload both vector and hybrid indexes from disk.
 *
 * Call this after vector-index.json changes.
 */
export async function reloadVectorStore(): Promise<VectorStore> {
  return loadVectorStore();
}