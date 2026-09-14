import { embedText } from "../embeddings/embeddingModel.js";
import { VectorStore } from "./vectorStore.js";
import type { VectorDocument } from "./vectorStore.js";
import { BM25Store } from "./bm25.js";

export interface HybridSearchResult {
  document: VectorDocument;
  vectorScore: number;
  bm25Score: number;
  hybridScore: number;
}

export class HybridRetriever {
  private vectorStore: VectorStore;
  private bm25Store: BM25Store;

  constructor(documents: VectorDocument[]) {
    this.vectorStore = new VectorStore();
    this.vectorStore.addMany(documents);

    this.bm25Store = new BM25Store();
    this.bm25Store.addMany(documents);
  }

  async search(
    query: string,
    topK = 3,
    vectorWeight = 0.6,
    bm25Weight = 0.4
  ): Promise<HybridSearchResult[]> {
    const queryVector = await embedText(query);

    const vectorResults = this.vectorStore.search(
      queryVector,
      this.vectorStore.size,
      0
    );

    const bm25Results = this.bm25Store.search(
      query,
      this.vectorStore.size
    );

    const vectorScores = new Map<string, number>();
    const bm25Scores = new Map<string, number>();

    vectorResults.forEach((result) => {
      vectorScores.set(getDocumentKey(result.document), result.score);
    });

    const maxBM25Score = Math.max(
      ...bm25Results.map((result) => result.score),
      0
    );

    bm25Results.forEach((result) => {
      const normalizedScore =
        maxBM25Score > 0 ? result.score / maxBM25Score : 0;

      bm25Scores.set(
        getDocumentKey(result.document),
        normalizedScore
      );
    });

    const documents = new Map<string, VectorDocument>();

    for (const document of this.vectorStore.getDocuments()) {
      documents.set(getDocumentKey(document), document);
    }

    const results: HybridSearchResult[] = [];

    for (const document of documents.values()) {
      const key = getDocumentKey(document);

      const vectorScore = vectorScores.get(key) ?? 0;
      const bm25Score = bm25Scores.get(key) ?? 0;

      const hybridScore =
        vectorScore * vectorWeight +
        bm25Score * bm25Weight;

      results.push({
        document,
        vectorScore,
        bm25Score,
        hybridScore,
      });
    }

    results.sort((a, b) => b.hybridScore - a.hybridScore);

    return results.slice(0, topK);
  }
}

function getDocumentKey(document: VectorDocument): string {
  return JSON.stringify({
    source: document.metadata?.source ?? "",
    page: document.metadata?.page ?? "",
    text: document.text,
  });
}