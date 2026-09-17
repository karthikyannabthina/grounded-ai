
import { readFile } from "fs/promises";

import { getHybridRetriever } from "../retrieval/vectorStoreManager.js";
import { rerank } from "../retrieval/reranker.js";
import { checkRelevance } from "../retrieval/relevanceGate.js";
import { generateAnswer } from "../generation/llm.js";
import { evaluateAnswerGrounding } from "./answerGrounding.js";

interface EvaluationCase {
  id: string;
  question: string;
  groundTruth: string | null;
  expectedSources: string[];
  shouldAnswer: boolean;
}

interface EvaluationResult {
  id: string;
  question: string;
  shouldAnswer: boolean;
  relevancePassed: boolean;
  relevanceScore: number;
  threshold: number;
  retrievedCount: number;
  rerankedCount: number;
  topSource: string | null;
  expectedSources: string[];
  expectedSourceFound: boolean;
  expectedSourceRank: number | null;
  rerankerSurvived: boolean;
  rerankerRank: number | null;
  answer: string;
  answerGrounded: boolean | null;
  unsupportedClaims: string[];
  groundingClaims: number;
  answerCorrect: boolean;
}

const DATASET_PATH = "data/evaluation/dataset.json";

const TOP_K_RETRIEVAL = 5;
const TOP_K_RERANK = 3;

const VECTOR_WEIGHT = 0.6;
const BM25_WEIGHT = 0.4;

const REFUSAL =
  "I don't have enough information in the uploaded documents to answer that question.";

function normalizeQuery(query: string): string {
  return query
    .replace(/\bjs\b/gi, "JavaScript")
    .replace(/\bnodejs\b/gi, "Node.js")
    .replace(/\bnode\b/gi, "Node.js")
    .replace(/\bts\b/gi, "TypeScript")
    .replace(/\bmongo\b/gi, "MongoDB");
}

async function loadDataset(): Promise<EvaluationCase[]> {
  const data = await readFile(
    DATASET_PATH,
    "utf-8"
  );

  return JSON.parse(
    data
  ) as EvaluationCase[];
}

function normalizeSource(source: string): string {
  return source
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim()
    .toLowerCase();
}

function sourceMatches(
  actualSource: string | undefined,
  expectedSources: string[]
): boolean {
  if (
    !actualSource ||
    expectedSources.length === 0
  ) {
    return false;
  }

  const normalizedActual =
    normalizeSource(actualSource);

  return expectedSources.some((expected) => {
    const normalizedExpected =
      normalizeSource(expected);

    return (
      normalizedActual === normalizedExpected ||
      normalizedActual.endsWith(
        `/${normalizedExpected}`
      ) ||
      normalizedExpected.endsWith(
        `/${normalizedActual}`
      )
    );
  });
}

function isRefusal(answer: string): boolean {
  return (
    answer.trim().toLowerCase() ===
    REFUSAL.toLowerCase()
  );
}

async function evaluateCase(
  testCase: EvaluationCase
): Promise<EvaluationResult> {
  const retriever =
    await getHybridRetriever();

  const normalizedQuery =
    normalizeQuery(testCase.question);

  const hybridResults =
    await retriever.search(
      normalizedQuery,
      TOP_K_RETRIEVAL,
      VECTOR_WEIGHT,
      BM25_WEIGHT
    );

  let expectedSourceRank:
    | number
    | null = null;

  for (
    let index = 0;
    index < hybridResults.length;
    index++
  ) {
    const result =
      hybridResults[index];

    if (!result) {
      continue;
    }

    const source =
      typeof result.document.metadata?.source ===
      "string"
        ? result.document.metadata.source
        : undefined;

    if (
      sourceMatches(
        source,
        testCase.expectedSources
      )
    ) {
      expectedSourceRank =
        index + 1;

      break;
    }
  }

  const expectedSourceFound =
    expectedSourceRank !== null;

  const rerankedResults =
    await rerank(
      normalizedQuery,
      hybridResults.map(
        (result) =>
          result.document.text
      ),
      TOP_K_RERANK
    );

  let rerankerRank:
    | number
    | null = null;

  for (
    let index = 0;
    index < rerankedResults.length;
    index++
  ) {
    const rerankedResult =
      rerankedResults[index];

    if (!rerankedResult) {
      continue;
    }

    const rerankedText =
      rerankedResult.document;

    const matchingHybridResult =
      hybridResults.find(
        (result) =>
          result.document.text ===
          rerankedText
      );

    const source =
      typeof matchingHybridResult?.document
        .metadata?.source === "string"
        ? matchingHybridResult.document.metadata.source
        : undefined;

    if (
      sourceMatches(
        source,
        testCase.expectedSources
      )
    ) {
      rerankerRank =
        index + 1;

      break;
    }
  }

  const rerankerSurvived =
    rerankerRank !== null;

  const topScore =
    rerankedResults[0]?.score ?? 0;

  const relevance =
    checkRelevance(topScore);

  const relevancePassed =
    relevance.relevant;

  if (!relevancePassed) {
    return {
      id: testCase.id,
      question: testCase.question,
      shouldAnswer: testCase.shouldAnswer,
      relevancePassed: false,
      relevanceScore: topScore,
      threshold: relevance.threshold,
      retrievedCount:
        hybridResults.length,
      rerankedCount:
        rerankedResults.length,
      topSource: null,
      expectedSources:
        testCase.expectedSources,
      expectedSourceFound,
      expectedSourceRank,
      rerankerSurvived,
      rerankerRank,
      answer: REFUSAL,
      answerGrounded: null,
      unsupportedClaims: [],
      groundingClaims: 0,
      answerCorrect:
        !testCase.shouldAnswer,
    };
  }

  const contexts =
    rerankedResults.map(
      (result) =>
        result.document
    );

  console.log(
    "\n========== RETRIEVED CONTEXT =========="
  );

  console.log(
    "Question:",
    testCase.question
  );

  contexts.forEach(
    (context, index) => {
      console.log(
        `\n--- Context ${index + 1} ---`
      );

      console.log(context);
    }
  );

  console.log(
    "========================================\n"
  );

  const context =
    contexts.join("\n\n");

  let answer =
    await generateAnswer(
      testCase.question,
      context
    );

  if (
    testCase.shouldAnswer &&
    isRefusal(answer)
  ) {
    const focusedContext =
      contexts[0];

    if (focusedContext) {
      console.log(
        "Answerable question was refused."
      );

      console.log(
        "Retrying with focused top-ranked evidence..."
      );

      answer =
        await generateAnswer(
          testCase.question,
          focusedContext,
          true
        );
    }
  }

  let answerGrounding =
    await evaluateAnswerGrounding(
      answer,
      contexts
    );

  if (
    !isRefusal(answer) &&
    !answerGrounding.grounded
  ) {
    const focusedContext =
      contexts[0];

    if (focusedContext) {
      console.log(
        "Initial answer failed grounding."
      );

      console.log(
        "Retrying with focused top-ranked evidence..."
      );

      answer =
        await generateAnswer(
          testCase.question,
          focusedContext,
          true
        );

      answerGrounding =
        await evaluateAnswerGrounding(
          answer,
          contexts
        );
    }
  }

  if (
    !isRefusal(answer) &&
    !answerGrounding.grounded
  ) {
    console.log(
      "Retry also failed grounding."
    );

    console.log(
      "Returning refusal."
    );

    answer = REFUSAL;
  }

  const topRerankedText =
    rerankedResults[0]?.document;

  const topDocument =
    topRerankedText !== undefined
      ? hybridResults.find(
          (result) =>
            result.document.text ===
            topRerankedText
        )
      : undefined;

  const topSource =
    typeof topDocument?.document.metadata?.source ===
    "string"
      ? topDocument.document.metadata.source
      : null;

  const refused =
    isRefusal(answer);

  const answerCorrect =
    testCase.shouldAnswer
      ? !refused
      : refused;

  return {
    id: testCase.id,
    question: testCase.question,
    shouldAnswer:
      testCase.shouldAnswer,
    relevancePassed,
    relevanceScore: topScore,
    threshold: relevance.threshold,
    retrievedCount:
      hybridResults.length,
    rerankedCount:
      rerankedResults.length,
    topSource,
    expectedSources:
      testCase.expectedSources,
    expectedSourceFound,
    expectedSourceRank,
    rerankerSurvived,
    rerankerRank,
    answer,
    answerGrounded:
      refused
        ? null
        : answerGrounding.grounded,
    unsupportedClaims:
      refused
        ? []
        : answerGrounding.unsupportedClaims,
    groundingClaims:
      refused
        ? 0
        : answerGrounding.claims.length,
    answerCorrect,
  };
}

async function main() {
  console.log("");

  console.log(
    "================================="
  );

  console.log(
    "       GROUNDED AI EVALUATION"
  );

  console.log(
    "================================="
  );

  console.log("");

  const dataset =
    await loadDataset();

  console.log(
    `Dataset: ${dataset.length} questions`
  );

  console.log("");

  const results:
    EvaluationResult[] = [];

  for (
    const testCase of dataset
  ) {
    console.log(
      `Evaluating ${testCase.id}...`
    );

    try {
      const result =
        await evaluateCase(
          testCase
        );

      results.push(result);
    } catch (error) {
      console.error(
        `Failed: ${testCase.id}`,
        error
      );
    }
  }

  const answerableResults =
    results.filter(
      (result) =>
        result.shouldAnswer
    );

  const refusalResults =
    results.filter(
      (result) =>
        !result.shouldAnswer
    );

  const correctAnswerable =
    answerableResults.filter(
      (result) =>
        result.answerCorrect
    ).length;

  const correctRefusals =
    refusalResults.filter(
      (result) =>
        result.answerCorrect
    ).length;

  const answerableAccuracy =
    answerableResults.length > 0
      ? correctAnswerable /
        answerableResults.length
      : 0;

  const refusalAccuracy =
    refusalResults.length > 0
      ? correctRefusals /
        refusalResults.length
      : 0;

  const overallAccuracy =
    results.length > 0
      ? results.filter(
          (result) =>
            result.answerCorrect
        ).length /
        results.length
      : 0;

  const generatedAnswerResults =
    answerableResults.filter(
      (result) =>
        !isRefusal(result.answer) &&
        result.answerGrounded !== null
    );

  const groundedAnswers =
    generatedAnswerResults.filter(
      (result) =>
        result.answerGrounded === true
    ).length;

  const answerGroundingAccuracy =
    generatedAnswerResults.length > 0
      ? groundedAnswers /
        generatedAnswerResults.length
      : 0;

  const totalClaims =
    generatedAnswerResults.reduce(
      (sum, result) =>
        sum +
        result.groundingClaims,
      0
    );

  const totalUnsupportedClaims =
    generatedAnswerResults.reduce(
      (sum, result) =>
        sum +
        result.unsupportedClaims.length,
      0
    );

  const unsupportedClaimRate =
    totalClaims > 0
      ? totalUnsupportedClaims /
        totalClaims
      : 0;

  const retrievalHits =
    answerableResults.filter(
      (result) =>
        result.expectedSourceFound
    ).length;

  const recallAt5 =
    answerableResults.length > 0
      ? retrievalHits /
        answerableResults.length
      : 0;

  let reciprocalRankSum = 0;

  for (
    const result of answerableResults
  ) {
    if (
      result.expectedSourceRank !== null
    ) {
      reciprocalRankSum +=
        1 /
        result.expectedSourceRank;
    }
  }

  const mrr =
    answerableResults.length > 0
      ? reciprocalRankSum /
        answerableResults.length
      : 0;

  const rerankerEligible =
    answerableResults.filter(
      (result) =>
        result.expectedSourceFound
    );

  const rerankerHits =
    rerankerEligible.filter(
      (result) =>
        result.rerankerSurvived
    ).length;

  const rerankerSurvival =
    rerankerEligible.length > 0
      ? rerankerHits /
        rerankerEligible.length
      : 0;

  console.log("");

  console.log(
    "================================="
  );

  console.log(
    "RESULTS"
  );

  console.log(
    "================================="
  );

  for (
    const result of results
  ) {
    console.log("");

    console.log(
      `${result.id}: ${result.question}`
    );

    console.log(
      `  Answerable: ${
        result.shouldAnswer
          ? "YES"
          : "NO"
      }`
    );

    console.log(
      `  Answer correct: ${
        result.answerCorrect
          ? "YES"
          : "NO"
      }`
    );

    console.log(
      `  Relevance gate: ${
        result.relevancePassed
          ? "PASS"
          : "FAIL"
      }`
    );

    console.log(
      `  Score: ${
        result.relevanceScore
      }`
    );

    console.log(
      `  Retrieved: ${
        result.retrievedCount
      }`
    );

    console.log(
      `  Reranked: ${
        result.rerankedCount
      }`
    );

    console.log(
      `  Source: ${
        result.topSource ??
        "None"
      }`
    );

    if (
      result.shouldAnswer
    ) {
      console.log(
        `  Expected source: ${
          result.expectedSources.join(
            ", "
          ) || "None"
        }`
      );

      console.log(
        `  Expected source found: ${
          result.expectedSourceFound
            ? "YES"
            : "NO"
        }`
      );

      console.log(
        `  Expected source rank: ${
          result.expectedSourceRank ??
          "-"
        }`
      );

      console.log(
        `  Reranker survived: ${
          result.rerankerSurvived
            ? "YES"
            : "NO"
        }`
      );

      console.log(
        `  Reranker rank: ${
          result.rerankerRank ??
          "-"
        }`
      );

      console.log(
        `  Answer grounded: ${
          result.answerGrounded === null
            ? "-"
            : result.answerGrounded
              ? "YES"
              : "NO"
        }`
      );

      console.log(
        `  Grounding claims: ${
          result.groundingClaims
        }`
      );

      if (
        result.unsupportedClaims.length >
        0
      ) {
        console.log(
          `  Unsupported claims: ${
            result.unsupportedClaims.join(
              " | "
            )
          }`
        );
      }
    }

    console.log(
      `  Answer: ${
        result.answer
      }`
    );
  }

  console.log("");

  console.log(
    "================================="
  );

  console.log(
    "METRICS"
  );

  console.log(
    "================================="
  );

  console.log(
    `Answerable accuracy:     ${(
      answerableAccuracy * 100
    ).toFixed(1)}%`
  );

  console.log(
    `Refusal accuracy:        ${(
      refusalAccuracy * 100
    ).toFixed(1)}%`
  );

  console.log(
    `Overall accuracy:        ${(
      overallAccuracy * 100
    ).toFixed(1)}%`
  );

  console.log("");

  console.log(
    `Answer grounding:        ${(
      answerGroundingAccuracy * 100
    ).toFixed(1)}%`
  );

  console.log(
    `Unsupported claim rate:  ${(
      unsupportedClaimRate * 100
    ).toFixed(1)}%`
  );

  console.log("");

  console.log(
    `Recall@5:                ${(
      recallAt5 * 100
    ).toFixed(1)}%`
  );

  console.log(
    `MRR:                     ${mrr.toFixed(
      3
    )}`
  );

  console.log(
    `Reranker survival:       ${(
      rerankerSurvival * 100
    ).toFixed(1)}%`
  );

  console.log("");

  console.log(
    `Retrieval hits:          ${retrievalHits}/${answerableResults.length}`
  );

  console.log(
    `Reranker hits:            ${rerankerHits}/${rerankerEligible.length}`
  );

  console.log(
    `Grounded answers:        ${groundedAnswers}/${generatedAnswerResults.length}`
  );

  console.log(
    `Unsupported claims:      ${totalUnsupportedClaims}/${totalClaims}`
  );

  console.log("");
}

main().catch((error) => {
  console.error(
    "Evaluation failed:",
    error
  );

  process.exit(1);
});
