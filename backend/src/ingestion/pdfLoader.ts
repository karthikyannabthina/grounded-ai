import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

export async function loadPdf(filePath: string) {
  const loader = new PDFLoader(filePath);

  const documents = await loader.load();

  return documents;
}