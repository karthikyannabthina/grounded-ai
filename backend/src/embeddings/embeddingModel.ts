import { pipeline } from "@huggingface/transformers";

let extractor: any;

export async function getEmbeddingModel() {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "onnx-community/all-MiniLM-L6-v2-ONNX"
    );
  }

  return extractor;
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbeddingModel();

  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}