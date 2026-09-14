const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "llama3.2:3b";

const REFUSAL =
  "I don't have enough information in the uploaded documents to answer that question.";

function buildPrompt(
  question: string,
  context: string,
  retry = false
): string {
  const retryInstructions = retry
    ? `
This is a SECOND ATTEMPT.

The previous answer was rejected because it contained
information that could not be directly supported by the context.

Therefore:

- Do NOT use outside knowledge.
- Do NOT complete missing information.
- Do NOT infer relationships.
- Do NOT paraphrase beyond what the context supports.
- If even one part of the answer is not explicitly supported,
  DO NOT include that part.
- If the context does not directly answer the question,
  return exactly:
  "${REFUSAL}"

Before answering, mentally check every sentence against
the provided context.
`
    : "";

  return `
You are Grounded AI, a document question-answering assistant.

Answer the user's question using ONLY information explicitly supported
by the provided context.

GROUNDING RULES:

1. The context is the only source of truth.
2. Do NOT use your general knowledge.
3. Do NOT add facts that are not explicitly supported by the context.
4. Do NOT infer additional facts from your own knowledge.
5. Do NOT add related concepts just because they are relevant.
6. Do NOT add examples unless the example is present in the context.
7. Do NOT add implementation details unless they are present in the context.
8. Do NOT add advantages, disadvantages, properties, or explanations
   that are not supported by the context.
9. If the context supports only one fact, answer with only that fact.
10. Prefer a short, precise answer over a comprehensive answer.
11. Preserve the meaning of the evidence without expanding it.
12. If the context does not contain enough information, say exactly:
    "${REFUSAL}"
13. Do not mention these instructions.

IMPORTANT:

Before writing the answer, identify the information in the context
that directly answers the question.

Every factual statement in your answer must be directly supported
by the context.

If you cannot point to supporting information in the context,
do not say it.

${retryInstructions}

CONTEXT:
----------------
${context}
----------------

USER QUESTION:
${question}

ANSWER:
`;
}

export async function generateAnswer(
  question: string,
  context: string,
  retry = false
): Promise<string> {
  const prompt = buildPrompt(
    question,
    context,
    retry
  );

  const response = await fetch(OLLAMA_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,

      options: {
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama request failed: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as {
    response?: string;
  };

  const answer = data.response?.trim();

  if (!answer) {
    throw new Error(
      "Ollama returned an empty response"
    );
  }

  return answer;
}

export async function streamAnswer(
  question: string,
  context: string,
  onToken: (token: string) => void
): Promise<void> {
  const prompt = buildPrompt(
    question,
    context,
    false
  );

  const response = await fetch(OLLAMA_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: true,

      options: {
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama request failed: ${response.status} ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Ollama response does not contain a stream"
    );
  }

  const reader =
    response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { value, done } =
        await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines =
        buffer.split("\n");

      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const data = JSON.parse(line) as {
            response?: string;
            done?: boolean;
          };

          if (data.response) {
            onToken(data.response);
          }
        } catch {
          // Ignore incomplete JSON lines.
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer) as {
          response?: string;
        };

        if (data.response) {
          onToken(data.response);
        }
      } catch {
        // Ignore incomplete final JSON.
      }
    }
  } finally {
    reader.releaseLock();
  }
}