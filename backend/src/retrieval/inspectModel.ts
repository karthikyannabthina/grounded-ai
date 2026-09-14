import { AutoConfig } from "@huggingface/transformers";

async function main() {
  const config = await AutoConfig.from_pretrained(
    "Xenova/ms-marco-MiniLM-L-6-v2"
  );

  console.dir(config, { depth: null });
}

main().catch(console.error);