
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

const SUPPORT_THRESHOLD = 0.65;

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
    .filter((claim) => claim.length > 0)
    .map((claim) =>
      claim
        // Remove common answer-introduction/meta language.
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
    .filter((claim) => claim.length > 0);
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

  const words = normalizedClaim
    .split(" ")
    .filter((word) => word.length >= 3);

  // Very short claims are not enough evidence.
  // Example: "Components." should not pass
  // just because "components" exists in the context.
  if (words.length < 3) {
    return false;
  }

  // Exact phrase match.
  if (normalizedContext.includes(normalizedClaim)) {
    return true;
  }

  // Count meaningful words appearing in the context.
  const matchedWords = words.filter((word) =>
    normalizedContext.includes(word)
  );

  const coverage =
    matchedWords.length / words.length;

  // Strong lexical overlap.
  if (coverage >= 0.8) {
    return true;
  }

  // Important semantic keyword groups.
  //
  // These handle common wording differences such as:
  // "communicate" ↔ "communication"
  // "pass" ↔ "passed"
  // "properties" ↔ "props"
  const keywordGroups = [
    ["communicat", "communication"],
    ["pass", "passed", "passing"],
    ["parent", "child"],
    ["component", "components"],
    ["prop", "props", "properties"],
    ["reus", "reusable", "reuse"],
    ["jsx"],
  ];

  let groupMatches = 0;
  let relevantGroups = 0;

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
      groupMatches++;
    }
  }

  // Require:
  // 1. At least two relevant keyword groups.
  // 2. Every relevant group appears in the context.
  // 3. At least 50% lexical coverage.
  //
  // This prevents overly broad matches such as:
  // "Components are reusable throughout an application."
  // from passing just because "components" and "reusable"
  // appear somewhere in the context.
  if (
    relevantGroups >= 2 &&
    groupMatches === relevantGroups &&
    coverage >= 0.5
  ) {
    return true;
  }

  return false;
}

function relationshipSupport(
  claim: string,
  context: string
): boolean {
  const normalizedClaim = normalizeText(claim);
  const normalizedContext = normalizeText(context);

  const relationshipPatterns = [
    {
      claim: ["communicat", "component", "prop"],
      context: ["communicat", "component", "prop"],
    },
    {
      claim: ["pass", "parent", "child", "prop"],
      context: ["pass", "parent", "child", "prop"],
    },
    {
      claim: ["data", "parent", "child", "prop"],
      context: ["data", "parent", "child", "prop"],
    },
  ];

  for (const pattern of relationshipPatterns) {
    const claimMatches = pattern.claim.filter((keyword) =>
      normalizedClaim.includes(keyword)
    ).length;

    const contextMatches = pattern.context.filter((keyword) =>
      normalizedContext.includes(keyword)
    ).length;

    if (
      claimMatches >= 3 &&
      contextMatches >= 3
    ) {
      return true;
    }
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

  // A controlled refusal is not a hallucinated claim.
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
    .filter((context) => context.length > 0);

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

  // Embed each retrieved context once.
  const contextEmbeddings = await Promise.all(
    validContexts.map((context) => embedText(context))
  );

  const results: GroundingClaim[] = [];

  for (const claim of claims) {
    const claimEmbedding = await embedText(claim);

    let bestSimilarity = -1;
    let bestContext: string | null = null;
    let bestLexicalSupport = false;

    for (let i = 0; i < contextEmbeddings.length; i++) {
      const context = validContexts[i]!;

      const similarity = cosineSimilarity(
        claimEmbedding,
        contextEmbeddings[i]!
      );

      const lexical =
        lexicalSupport(claim, context) ||
        relationshipSupport(claim, context);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestContext = context;
      }

      // If any context provides lexical or relationship
      // support, preserve that support even if another
      // context has a higher semantic similarity.
      if (lexical) {
        bestLexicalSupport = true;

        // Prefer the context that actually supports
        // the claim.
        if (bestContext === null) {
          bestContext = context;
        }
      }
    }

    const supported =
      bestLexicalSupport ||
      bestSimilarity >= SUPPORT_THRESHOLD;

    console.log("\nGROUNDING DEBUG");
    console.log("Claim:", claim);
    console.log("Similarity:", bestSimilarity);
    console.log(
      "Lexical support:",
      bestLexicalSupport
    );
    console.log("Supported:", supported);

    results.push({
      claim,
      supported,
      similarity: bestSimilarity,
      supportingContext: supported
        ? bestContext
        : null,
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

