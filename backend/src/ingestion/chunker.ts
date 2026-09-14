import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { loadPdf } from "./pdfLoader.js";

async function chunkPdf() {
  const documents = await loadPdf("documents/sample.pdf");

  console.log("Documents loaded:", documents.length);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const chunks = await splitter.splitDocuments(documents);

  console.log("Total chunks:", chunks.length);

  chunks.forEach((chunk, index) => {
    console.log(`\n--- CHUNK ${index + 1} ---`);
    console.log(chunk.pageContent);
    console.log("Metadata:", chunk.metadata);
  });
}

chunkPdf();