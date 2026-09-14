import { pipeline } from "@huggingface/transformers";

async function main() {
  const model = await pipeline(
    "text-classification",
    "Xenova/ms-marco-MiniLM-L-6-v2"
  );

  const output = await model(
    ["What are React props?", "React props are values passed from a parent component to a child component"],
    {
      top_k: 1,
    }
  );

  console.dir(output, { depth: null });
}

main().catch(console.error);