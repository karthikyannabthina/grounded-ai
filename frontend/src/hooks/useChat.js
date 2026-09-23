import { useRef, useState } from "react";

import {
  streamChat,
  readChatStream,
} from "../services/api";

function useChat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] =
    useState(null);

  const [expandedRetrieval, setExpandedRetrieval] =
    useState(null);

  const abortControllerRef = useRef(null);

  function startNewChat() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setMessages([]);
    setQuestion("");
    setExpandedRetrieval(null);
    setStreamingMessageId(null);
    setLoading(false);
  }

  function handleChatEvent(
    payload,
    assistantId
  ) {
    if (payload.type === "metadata") {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                grounded:
                  payload.grounded ??
                  false,
                observability:
                  payload.observability ||
                  null,
                sources:
                  payload.sources || [],
              }
            : message
        )
      );
    }

    if (payload.type === "token") {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  message.content +
                  (payload.token || ""),
              }
            : message
        )
      );
    }

    if (payload.type === "error") {
      throw new Error(
        payload.message ||
          "Streaming failed."
      );
    }

    if (payload.type === "done") {
      // Stream completed.
    }
  }

  async function askQuestion(event) {
    event?.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) {
      return;
    }

    abortControllerRef.current?.abort();

    const controller =
  new AbortController();

abortControllerRef.current =
  controller;

const timeoutId = setTimeout(() => {
  controller.abort();
}, 120000);

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
    };

    const assistantId = crypto.randomUUID();

    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      grounded: null,
      observability: null,
      sources: [],
      error: false,
    };

    setMessages((previous) => [
      ...previous,
      userMessage,
      assistantMessage,
    ]);

    setQuestion("");
    setLoading(true);
    setStreamingMessageId(assistantId);

    try {
      const response = await streamChat(
        trimmedQuestion,
        controller.signal
      );

      if (!response.ok) {
        throw new Error(
          await response.text()
        );
      }

      const contentType =
        response.headers.get("content-type") || "";

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        const data =
          await response.json();

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content:
                    data.answer ||
                    "No answer was generated.",
                  grounded:
                    data.grounded ??
                    false,
                  observability:
                    data.observability ||
                    null,
                  sources:
                    data.sources || [],
                }
              : message
          )
        );

        return;
      }

      await readChatStream(
        response,
        (payload) =>
          handleChatEvent(
            payload,
            assistantId
          )
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "Streaming error:",
        error
      );

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  "Something went wrong while processing your question.",
                grounded: false,
                observability: null,
                sources: [],
                error: true,
              }
            : message
        )
      );
    } finally {
  clearTimeout(timeoutId);

  if (
    abortControllerRef.current ===
    controller
  ) {
    abortControllerRef.current =
      null;

    setLoading(false);
    setStreamingMessageId(null);
  }
}
  }

  function useExample(example) {
    setQuestion(example);
  }

  return {
    question,
    setQuestion,
    messages,
    loading,
    streamingMessageId,
    expandedRetrieval,
    setExpandedRetrieval,
    startNewChat,
    askQuestion,
    useExample,
  };
}

export default useChat;