import { checkRelevance } from "./relevanceGate.js";

const scores = [
  8.288,
  -0.047,
  2.488,
  8.436,
  3.056,
  7.905,
  3.974,
  -5.785,
  -8.428,
  -10.608,
  -11.209,
  -10.414,
];

for (const score of scores) {
  const result = checkRelevance(score);

  console.log(
    `Score: ${score.toFixed(3)} → ${
      result.relevant ? "RELEVANT" : "IRRELEVANT"
    }`
  );
}