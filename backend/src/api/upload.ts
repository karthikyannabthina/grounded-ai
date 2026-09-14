import { Router } from "express";
import multer from "multer";
import { mkdir, readFile, writeFile } from "fs/promises";
import { loadPdf } from "../ingestion/pdfLoader.js";
import { loadMarkdown } from "../ingestion/markdownLoader.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embedText } from "../embeddings/embeddingModel.js";
import { VectorStore } from "../retrieval/vectorStore.js";
import type { VectorDocument } from "../retrieval/vectorStore.js";
import { reloadVectorStore } from "../retrieval/vectorStoreManager.js";

const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const INDEX_PATH = "data/vector-index.json";

function normalizeFileName(name: string): string {
  const fileName = name.split(/[\\/]/).pop() ?? name;
  return fileName.replace(/(\.(pdf|md))+$/i, (match) => {
    const extension = match.toLowerCase().includes(".md") ? ".md" : ".pdf";
    return extension;
  }).toLowerCase();
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "PDF or Markdown file is required",
      });
    }

    const fileName = req.file.originalname.toLowerCase();
    const isPdf = fileName.endsWith(".pdf");
    const isMarkdown = fileName.endsWith(".md");

    if (!isPdf && !isMarkdown) {
      return res.status(400).json({
        success: false,
        message: "Only PDF and Markdown files are allowed",
      });
    }

    const indexData = await readFile(INDEX_PATH, "utf-8");

    const existingIndex = JSON.parse(indexData) as {
      model: string;
      dimensions: number;
      documents: VectorDocument[];
    };

    const uploadedName = normalizeFileName(req.file.originalname);

    const alreadyExists = existingIndex.documents.some((document) => {
      const source = document.metadata?.source;

      if (typeof source !== "string") {
        return false;
      }

      return normalizeFileName(source) === uploadedName;
    });

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: `${req.file.originalname} is already indexed`,
      });
    }

    const documents = isPdf
      ? await loadPdf(req.file.path)
      : await loadMarkdown(req.file.path);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
    });

    const chunks = await splitter.splitDocuments(documents);

    const vectorStore = new VectorStore();

    vectorStore.addMany(existingIndex.documents);

    for (const chunk of chunks) {
      const embedding = await embedText(chunk.pageContent);

      vectorStore.add({
        text: chunk.pageContent,
        embedding,
        metadata: {
          ...chunk.metadata,
          source: req.file.originalname,
          type: isPdf ? "pdf" : "markdown",
        },
      });
    }

    await mkdir("data", { recursive: true });

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
      message: `${isPdf ? "PDF" : "Markdown"} uploaded and indexed successfully`,
      file: req.file.originalname,
      type: isPdf ? "pdf" : "markdown",
      chunks: chunks.length,
      totalDocuments: vectorStore.size,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to process file",
    });
  }
});

export default router;