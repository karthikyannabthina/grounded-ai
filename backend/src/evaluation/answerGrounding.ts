import { embedText } from "../embeddings/embeddingModel.js";

export interface GroundingClaim {
  claim: string;
  supported: boolean;
  similarity: number;
  supportingContext: string | null;
}

export interface AnswerGroundingResult {
  grounded: boolean;
  claims: GroundingClaim[];
  unsupportedClaims: string[];
}

const SUPPORT_THRESHOLD = 0.55;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRefusalAnswer(text: string): boolean {
  const normalized = normalizeText(text);

  return (
    normalized.includes(
      "i don t have enough information in the uploaded documents"
    ) ||
    normalized.includes(
      "the context does not explicitly state"
    ) ||
    normalized.includes(
      "the uploaded documents do not contain enough information"
    ) ||
    normalized.includes(
      "cannot answer from the provided context"
    )
  );
}

function splitIntoClaims(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((claim) => claim.trim())
    .filter(Boolean)
    .map((claim) =>
      claim
        .replace(
          /^the context explicitly supports the fact that\s+/i,
          ""
        )
        .replace(
          /^the context explicitly states that\s+/i,
          ""
        )
        .replace(
          /^according to the context[,:]?\s*/i,
          ""
        )
        .replace(
          /^the provided context shows that\s+/i,
          ""
        )
        .trim()
    )
    .filter(Boolean);
}

function lexicalSupport(
  claim: string,
  context: string
): boolean {
  const normalizedClaim = normalizeText(claim);
  const normalizedContext = normalizeText(context);

  if (!normalizedClaim || !normalizedContext) {
    return false;
  }

  // Exact phrase is definitive evidence.
  if (normalizedContext.includes(normalizedClaim)) {
    return true;
  }

  const words = normalizedClaim
    .split(" ")
    .filter((word) => word.length >= 2);

  if (words.length === 0) {
    return false;
  }

  const matchedWords = words.filter((word) =>
    normalizedContext.includes(word)
  );

  const coverage =
    matchedWords.length / words.length;

  /*
   * Short factual answers need special treatment.
   *
   * Example:
   *   Answer: "Components."
   *   Context: "... React components are reusable ..."
   *
   * This should be considered grounded.
   */
  if (words.length <= 2 && coverage === 1) {
    return true;
  }

  /*
   * For longer answers require strong lexical overlap.
   */
  if (coverage >= 0.75) {
    return true;
  }

  /*
   * Handle common morphological / terminology differences.
   */
  const keywordGroups = [
    ["communicat", "communication"],
    ["pass", "passed", "passing"],
    ["parent", "child"],
    ["component", "components"],
    ["prop", "props", "properties"],
    ["reus", "reusable", "reuse"],
    ["render", "renders", "rendering"],
    ["state", "states"],
    ["function", "functions"],
    ["jsx"],
  ];

  let relevantGroups = 0;
  let matchedGroups = 0;

  for (const group of keywordGroups) {
    const claimHasGroup = group.some((keyword) =>
      normalizedClaim.includes(keyword)
    );

    if (!claimHasGroup) {
      continue;
    }

    relevantGroups++;

    const contextHasGroup = group.some((keyword) =>
      normalizedContext.includes(keyword)
    );

    if (contextHasGroup) {
      matchedGroups++;
    }
  }

  if (
    relevantGroups > 0 &&
    matchedGroups === relevantGroups &&
    coverage >= 0.5
  ) {
    return true;
  }

  return false;
}

function cosineSimilarity(
  a: number[],
  b: number[]
): number {
  if (a.length !== b.length) {
    throw new Error(
      "Embedding dimensions do not match: " +
        a.length +
        " vs " +
        b.length
    );
  }

  let score = 0;

  for (let i = 0; i < a.length; i++) {
    score += a[i]! * b[i]!;
  }

  return score;
}

export async function evaluateAnswerGrounding(
  answer: string,
  contexts: string[]
): Promise<AnswerGroundingResult> {

  if (isRefusalAnswer(answer)) {
    return {
      grounded: true,
      claims: [],
      unsupportedClaims: [],
    };
  }

  const claims = splitIntoClaims(answer);

  const validContexts = contexts
    .map((context) =>
      context.replace(/\s+/g, " ").trim()
    )
    .filter(Boolean);

  if (claims.length === 0) {
    return {
      grounded: true,
      claims: [],
      unsupportedClaims: [],
    };
  }

  if (validContexts.length === 0) {
    return {
      grounded: false,
      claims: claims.map((claim) => ({
        claim,
        supported: false,
        similarity: 0,
        supportingContext: null,
      })),
      unsupportedClaims: claims,
    };
  }

  /*
   * Embed each context once.
   */
  const contextEmbeddings = await Promise.all(
    validContexts.map((context) =>
      embedText(context)
    )
  );

  const results: GroundingClaim[] = [];

  for (const claim of claims) {
    const claimEmbedding = await embedText(claim);

    let bestSimilarity = -1;
    let bestContext: string | null = null;
    let bestLexicalContext: string | null = null;

    for (
      let i = 0;
      i < validContexts.length;
      i++
    ) {
      const context = validContexts[i]!;

      const similarity = cosineSimilarity(
        claimEmbedding,
        contextEmbeddings[i]!
      );

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestContext = context;
      }

      if (
        lexicalSupport(claim, context) &&
        bestLexicalContext === null
      ) {
        bestLexicalContext = context;
      }
    }

    const supported =
      bestLexicalContext !== null ||
      bestSimilarity >= SUPPORT_THRESHOLD;

    const supportingContext =
      bestLexicalContext ??
      (supported ? bestContext : null);

    console.log("\nGROUNDING DEBUG");
    console.log("Claim:", claim);
    console.log("Similarity:", bestSimilarity);
    console.log(
      "Lexical support:",
      bestLexicalContext !== null
    );
    console.log("Supported:", supported);

    results.push({
      claim,
      supported,
      similarity: bestSimilarity,
      supportingContext,
    });
  }

  const unsupportedClaims = results
    .filter((result) => !result.supported)
    .map((result) => result.claim);

  return {
    grounded: unsupportedClaims.length === 0,
    claims: results,
    unsupportedClaims,
  };
}