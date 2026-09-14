import { Router } from "express";
import { readFile, writeFile } from "fs/promises";
import { reloadVectorStore } from "../retrieval/vectorStoreManager.js";
import type { VectorDocument } from "../retrieval/vectorStore.js";

const router = Router();

const INDEX_PATH = "data/vector-index.json";

function normalizePdfName(name: string): string {
  const fileName = name.split(/[\\/]/).pop() ?? name;
  return fileName.replace(/(\.pdf)+$/i, ".pdf").toLowerCase();
}

router.get("/", async (_req, res) => {
  try {
    const indexData = await readFile(INDEX_PATH, "utf-8");

    const index = JSON.parse(indexData) as {
      model: string;
      dimensions: number;
      documents: VectorDocument[];
    };

    const documentMap = new Map<
      string,
      {
        name: string;
        chunks: number;
      }
    >();

    for (const document of index.documents) {
      const source = document.metadata?.source;

      if (typeof source !== "string") {
        continue;
      }

      const existing = documentMap.get(normalizePdfName(source));

      if (existing) {
        existing.chunks += 1;
      } else {
        documentMap.set(normalizePdfName(source), {
          name: source,
          chunks: 1,
        });
      }
    }

    return res.json({
      success: true,
      documents: Array.from(documentMap.values()),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to load documents",
    });
  }
});

router.delete("/:name", async (req, res) => {
  try {
    const documentName = decodeURIComponent(req.params.name);

    const indexData = await readFile(INDEX_PATH, "utf-8");

    const index = JSON.parse(indexData) as {
      model: string;
      dimensions: number;
      documents: VectorDocument[];
    };

    const targetName = normalizePdfName(documentName);

    const remainingDocuments = index.documents.filter((document) => {
      const source = document.metadata?.source;

      if (typeof source !== "string") {
        return true;
      }

      return normalizePdfName(source) !== targetName;
    });

    if (remainingDocuments.length === index.documents.length) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const deletedChunks =
      index.documents.length - remainingDocuments.length;

    const updatedIndex = {
      model: index.model,
      dimensions: remainingDocuments[0]?.embedding.length ?? 0,
      documents: remainingDocuments,
    };

    await writeFile(
      INDEX_PATH,
      JSON.stringify(updatedIndex, null, 2),
      "utf-8"
    );

    await reloadVectorStore();

    return res.json({
      success: true,
      message: "Document deleted successfully",
      document: documentName,
      deletedChunks,
      remainingChunks: remainingDocuments.length,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
    });
  }
});

export default router;