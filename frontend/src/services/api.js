const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://grounded-ai-v4gn.onrender.com";

async function parseResponse(response, fallbackMessage) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || fallbackMessage
    );
  }

  return data;
}

export async function getDocuments() {
  const response = await fetch(
    `${API_URL}/api/documents`
  );

  return parseResponse(
    response,
    "Failed to load documents"
  );
}

export async function uploadDocument(file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    `${API_URL}/api/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  return parseResponse(
    response,
    "Upload failed"
  );
}

export async function removeDocument(name) {
  const response = await fetch(
    `${API_URL}/api/documents/${encodeURIComponent(
      name
    )}`,
    {
      method: "DELETE",
    }
  );

  return parseResponse(
    response,
    "Delete failed"
  );
}

export async function streamChat(
  question,
  signal
) {
  const response = await fetch(
    `${API_URL}/api/chat/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
      }),
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response;
}

export async function readChatStream(
  response,
  onEvent
) {
  if (!response.body) {
    throw new Error(
      "Streaming is not supported by this browser."
    );
  }

  const reader =
    response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    const events = buffer.split("\n\n");

    buffer = events.pop() || "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) =>
          line.startsWith("data: ")
        );

      if (!dataLine) {
        continue;
      }

      const payload = JSON.parse(
        dataLine.slice(6)
      );

      onEvent(payload);
    }
  }

  if (buffer.trim()) {
    const dataLine = buffer
      .split("\n")
      .find((line) =>
        line.startsWith("data: ")
      );

    if (dataLine) {
      const payload = JSON.parse(
        dataLine.slice(6)
      );

      onEvent(payload);
    }
  }
}

export { API_URL };