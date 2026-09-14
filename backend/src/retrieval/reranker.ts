import {
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@huggingface/transformers";

let tokenizer: any;
let model: any;

async function getReranker() {
  if (!tokenizer || !model) {
    tokenizer = await AutoTokenizer.from_pretrained(
      "Xenova/ms-marco-MiniLM-L-6-v2"
    );

    model = await AutoModelForSequenceClassification.from_pretrained(
      "Xenova/ms-marco-MiniLM-L-6-v2"
    );
  }

  return { tokenizer, model };
}

export async function rerank(
  query: string,
  documents: string[],
  topK = 3
) {
  const { tokenizer, model } = await getReranker();

  const results = [];

  for (const document of documents) {
    const inputs = await tokenizer(
      query,
      {
        text_pair: document,
        padding: true,
        truncation: true,
      }
    );

    const output = await model(inputs);

    const logit = output.logits.data[0];

    results.push({
      document,
      score: Number(logit),
    });
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}