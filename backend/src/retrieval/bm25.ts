import winkBM25 from "wink-bm25-text-search";
import winkTokenizer from "wink-tokenizer";
import type { VectorDocument } from "./vectorStore.js";

export interface BM25SearchResult {
  document: VectorDocument;
  score: number;
}

const tokenizer = winkTokenizer();

function tokenize(text: string): string[] {
  return tokenizer
    .tokenize(text.toLowerCase())
    .filter((token: any) => token.tag === "word")
    .map((token: any) => token.value);
}

export class BM25Store {
  private documents: VectorDocument[] = [];
  private engine = winkBM25();

  addMany(documents: VectorDocument[]): void {
    this.documents = documents;

    this.engine.defineConfig({
      fldWeights: {
        text: 1,
      },
    });

    this.engine.definePrepTasks([
      (text: string) => tokenize(text),
    ]);

    documents.forEach((document, index) => {
      this.engine.addDoc(
        {
          text: document.text,
        },
        index
      );
    });

    this.engine.consolidate();
  }

  search(query: string, topK = 3): BM25SearchResult[] {
    if (!query.trim() || this.documents.length === 0) {
      return [];
    }

    const results = this.engine.search(query);

    return results.slice(0, topK).map((result: any) => ({
      document: this.documents[result[0]],
      score: result[1],
    }));
  }
}