import { verifyAnswerGrounding } from './groundingVerifier.js';

const question = 'What are React props?';

const context =
  'Props are inputs passed from a parent component to a child component.';

const supportedAnswer =
  'Props are inputs passed from a parent component to a child component.';

const unsupportedAnswer =
  'Props are inputs passed from a parent component to a child component. ' +
  'They can also be used to manage global application state.';

console.log('\n=== SUPPORTED ANSWER ===\n');

const supportedResult = await verifyAnswerGrounding(
  question,
  context,
  supportedAnswer
);

console.log(JSON.stringify(supportedResult, null, 2));

console.log('\n=== UNSUPPORTED ANSWER ===\n');

const unsupportedResult = await verifyAnswerGrounding(
  question,
  context,
  unsupportedAnswer
);

console.log(JSON.stringify(unsupportedResult, null, 2));
