export interface VectorDocument {
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
}

export class VectorStore {
  private documents: VectorDocument[] = [];

  add(document: VectorDocument): void {
    this.documents.push(document);
  }

  addMany(documents: VectorDocument[]): void {
    this.documents.push(...documents);
  }

  get size(): number {
    return this.documents.length;
  }

  getDocuments(): VectorDocument[] {
    return this.documents;
  }

  search(queryVector: number[], topK = 3, minScore = 0.3): SearchResult[] {
    const results: SearchResult[] = this.documents
      .map((document) => ({
        document,
        score: cosineSimilarity(queryVector, document.embedding),
      }))
      .filter((result) => result.score >= minScore);

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimensions don't match: ${a.length} vs ${b.length}`
    );
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const valueA = a[i]!;
    const valueB = b[i]!;

    dotProduct += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}