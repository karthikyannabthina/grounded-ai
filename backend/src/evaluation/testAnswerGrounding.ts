import { evaluateAnswerGrounding } from './answerGrounding.js';

const contexts = [
  'Props are inputs passed from a parent component to a child component.',
  'React components are reusable pieces of UI.',
];

const tests = [
  {
    name: 'Supported',
    answer:
      'Props are inputs passed from a parent component to a child component.',
  },
  {
    name: 'Paraphrased',
    answer:
      'A parent component can pass data to a child component through props.',
  },
  {
    name: 'Unsupported',
    answer:
      'Props are inputs passed from a parent component to a child component. React uses the virtual DOM to improve performance.',
  },
];

for (const test of tests) {
  const result = await evaluateAnswerGrounding(
    test.answer,
    contexts
  );

  console.log(`\n${test.name}`);
  console.log('Grounded:', result.grounded);

  for (const claim of result.claims) {
    console.log(
      `Claim: ${claim.claim}`
    );
    console.log(
      `Supported: ${claim.supported}`
    );
    console.log(
      `Similarity: ${claim.similarity}`
    );
  }

  console.log(
    'Unsupported claims:',
    result.unsupportedClaims
  );
}
