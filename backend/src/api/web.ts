import { Router } from "express";
import { readFile, writeFile } from "fs/promises";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { loadWebPage } from "../ingestion/webLoader.js";
import { embedText } from "../embeddings/embeddingModel.js";
import { VectorStore } from "../retrieval/vectorStore.js";
import type { VectorDocument } from "../retrieval/vectorStore.js";
import { reloadVectorStore } from "../retrieval/vectorStoreManager.js";

const router = Router();

const INDEX_PATH = "data/vector-index.json";

router.post("/", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid URL",
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        success: false,
        message: "Only HTTP and HTTPS URLs are allowed",
      });
    }

    const indexData = await readFile(INDEX_PATH, "utf-8");

    const existingIndex = JSON.parse(indexData) as {
      model: string;
      dimensions: number;
      documents: VectorDocument[];
    };

    const alreadyExists = existingIndex.documents.some(
      (document) => document.metadata?.source === url
    );

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "Web page is already indexed",
      });
    }

    const documents = await loadWebPage(url);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
    });

    const chunks = await splitter.splitDocuments(documents);

    if (chunks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No content could be extracted from the web page",
      });
    }

    const vectorStore = new VectorStore();

    vectorStore.addMany(existingIndex.documents);

    for (const chunk of chunks) {
      const embedding = await embedText(chunk.pageContent);

      vectorStore.add({
        text: chunk.pageContent,
        embedding,
        metadata: {
          ...chunk.metadata,
          source: url,
          type: "web",
        },
      });
    }

    const index = {
      model: existingIndex.model,
      dimensions: vectorStore.getDocuments()[0]?.embedding.length ?? 0,
      documents: vectorStore.getDocuments(),
    };

    await writeFile(
      INDEX_PATH,
      JSON.stringify(index, null, 2),
      "utf-8"
    );

    await reloadVectorStore();

    return res.json({
      success: true,
      message: "Web page indexed successfully",
      url,
      title: documents[0]?.metadata.title ?? "Untitled",
      chunks: chunks.length,
      totalDocuments: vectorStore.size,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to index web page",
    });
  }
});

export default router;