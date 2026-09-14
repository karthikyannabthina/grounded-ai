import * as cheerio from "cheerio";

export async function loadWebPage(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch webpage: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, noscript").remove();

  const title = $("title").first().text().trim();
  const content = $("main").text() || $("body").text();

  const cleanContent = content
    .replace(/\s+/g, " ")
    .trim();

  return [
    {
      pageContent: cleanContent,
      metadata: {
        source: url,
        type: "web",
        title,
      },
    },
  ];
}

const documents = await loadWebPage("https://react.dev/");

console.log("Title:", documents[0]?.metadata.title);
console.log("Source:", documents[0]?.metadata.source);
console.log("Content preview:", documents[0]?.pageContent.slice(0, 500));