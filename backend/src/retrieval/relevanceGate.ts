export interface RelevanceDecision {
  relevant: boolean;
  score: number;
  threshold: number;
}

const RERANKER_THRESHOLD = -3.5;

export function checkRelevance(
  score: number
): RelevanceDecision {
  return {
    relevant: score >= RERANKER_THRESHOLD,
    score,
    threshold: RERANKER_THRESHOLD,
  };
}