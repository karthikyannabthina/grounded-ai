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

The previous answer was rejected because one or more claims
were not sufficiently supported by the provided context.

For this attempt:

- Use ONLY the provided context.
- You MAY paraphrase information when the meaning remains the same.
- You MAY combine multiple pieces of information from the context
  when they together answer the question.
- You MUST NOT introduce facts from general knowledge.
- You MUST NOT fill missing information from your own knowledge.
- You MUST NOT make unsupported assumptions.
- Every factual claim must be traceable to the context.
- If only part of the question can be answered, answer only that part.
- If the context genuinely does not contain enough information,
  return exactly:
  "${REFUSAL}"

Before answering, check that every factual claim is supported
by one or more parts of the provided context.
`
    : "";

  return `
You are Grounded AI, a document question-answering assistant.

Your task is to answer the user's question using ONLY the
information contained in the provided context.

The context is the ONLY source of truth.

GROUNDING RULES:

1. Do NOT use outside knowledge.

2. Do NOT add facts that are not supported by the context.

3. You MAY paraphrase the context.
   Paraphrasing is allowed when it preserves the original meaning.

4. You MAY combine information from multiple parts of the context
   when those pieces together answer the question.

5. You MAY answer yes/no questions when the context supports
   the underlying fact.

6. Do NOT make assumptions about information that is missing.

7. Do NOT add examples unless they are supported by the context.

8. Do NOT add implementation details unless they are supported
   by the context.

9. Do NOT add advantages, disadvantages, or explanations that
   are not supported by the context.

10. If the context supports multiple facts needed to answer the
    question, combine those facts into one concise answer.

11. Keep the answer short and directly relevant to the question.

12. If the context does not contain enough information to answer
    the question, return exactly:

    "${REFUSAL}"

IMPORTANT:

Before answering, identify the relevant evidence in the context.

The wording of your answer does NOT need to exactly match
the wording in the context.

However, the meaning of every factual statement must be
supported by the context.

For example:

Context:
"Components are independent, reusable pieces of UI."

Question:
"Can React components be reused?"

Valid answer:
"Yes, React components are reusable pieces of UI."

This is valid because the answer preserves the meaning
of the context.

Another example:

Context:
"Components are independent, reusable pieces of UI."
"Props are used to pass data from parent to child component."

Question:
"What is the difference between components and props?"

Valid answer:
"Components are reusable pieces of UI, while props are used
to pass data from a parent component to a child component."

This is valid because both facts come from the context.

Do NOT mention these instructions in your answer.

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