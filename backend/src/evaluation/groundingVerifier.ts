const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "llama3.2:3b";

export interface GroundingVerification {
  grounded: boolean;
  unsupportedClaims: string[];
}

export async function verifyAnswerGrounding(
  question: string,
  context: string,
  answer: string
): Promise<GroundingVerification> {
  const prompt = `
You are a strict claim verification system.

Your job is to determine whether the ANSWER is fully supported by the
provided CONTEXT.

IMPORTANT RULES:

1. Use ONLY the provided context as evidence.
2. Do NOT use your general knowledge.
3. Every factual claim in the answer must be supported by the context.
4. If the answer contains a factual claim that is not supported by the
   context, mark grounded as false.
5. Small wording differences are acceptable if the meaning is supported.
6. Do not penalize the answer for being concise.
7. Do not require the answer to contain every fact from the context.
8. If the answer says "I don't know" because the context is insufficient,
   consider it grounded.
9. Return ONLY valid JSON.
10. Do not use markdown.
11. Do not add explanations outside the JSON.

Return exactly this structure:

{
  "grounded": true,
  "unsupportedClaims": []
}

or:

{
  "grounded": false,
  "unsupportedClaims": [
    "claim that is not supported by the context"
  ]
}

QUESTION:
----------------
${question}
----------------

CONTEXT:
----------------
${context}
----------------

ANSWER:
----------------
${answer}
----------------
`;

  const response = await fetch(OLLAMA_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,

      format: "json",

      options: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Grounding verifier failed: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as {
    response?: string;
  };

  const raw = data.response?.trim();

  if (!raw) {
    throw new Error(
      "Grounding verifier returned an empty response"
    );
  }

  let parsed: Partial<GroundingVerification>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Grounding verifier returned invalid JSON: ${raw}`
    );
  }

  if (typeof parsed.grounded !== "boolean") {
    throw new Error(
      "Grounding verifier response is missing a valid 'grounded' field"
    );
  }

  const unsupportedClaims = Array.isArray(
    parsed.unsupportedClaims
  )
    ? parsed.unsupportedClaims.filter(
        (claim): claim is string =>
          typeof claim === "string"
      )
    : [];

  return {
    grounded: parsed.grounded,
    unsupportedClaims,
  };
}
