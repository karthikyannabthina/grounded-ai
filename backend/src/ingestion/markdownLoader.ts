import { readFile } from "fs/promises";

export async function loadMarkdown(filePath: string) {
  const content = await readFile(filePath, "utf-8");

  return [
    {
      pageContent: content,
      metadata: {
        source: filePath,
        type: "markdown",
      },
    },
  ];
}