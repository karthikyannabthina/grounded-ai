import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] =
    useState(null);

  const [documents, setDocuments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [expandedRetrieval, setExpandedRetrieval] =
    useState(null);

  const fileInputRef = useRef(null);

  /* ---------------------------------------
     Load indexed documents
  --------------------------------------- */

  async function loadDocuments() {
    try {
      const response = await fetch(
        `${API_URL}/api/documents`
      );

      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error(
        "Failed to load documents:",
        error
      );
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  /* ---------------------------------------
     New chat
  --------------------------------------- */

  function startNewChat() {
    setMessages([]);
    setQuestion("");
    setExpandedRetrieval(null);
    setStreamingMessageId(null);
  }

  /* ---------------------------------------
     Ask question - STREAMING
  --------------------------------------- */

  async function askQuestion(event) {
    event?.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) {
      return;
    }

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

    // Add both messages immediately.
    setMessages((previous) => [
      ...previous,
      userMessage,
      assistantMessage,
    ]);

    setQuestion("");
    setLoading(true);
    setStreamingMessageId(assistantId);

    try {
      const response = await fetch(
        `${API_URL}/api/chat/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: trimmedQuestion,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      /*
        ---------------------------------------
        Fallback for normal JSON responses.

        Your backend can return JSON for an
        early refusal/error before streaming.
        ---------------------------------------
      */

      const contentType =
        response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content:
                    data.answer ||
                    "No answer was generated.",
                  grounded:
                    data.grounded ?? false,
                  observability:
                    data.observability || null,
                  sources:
                    data.sources || [],
                }
              : message
          )
        );

        return;
      }

      /*
        ---------------------------------------
        SSE streaming response
        ---------------------------------------
      */

      if (!response.body) {
        throw new Error(
          "Streaming is not supported by this browser."
        );
      }

      const reader = response.body.getReader();
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

        // Keep incomplete event for next chunk.
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

          /*
            Metadata event
          */

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

          /*
            Token event
          */

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

          /*
            Error event
          */

          if (payload.type === "error") {
            throw new Error(
              payload.message ||
                "Streaming failed."
            );
          }

          /*
            Done event

            Nothing needs to happen here.
            The finally block handles loading state.
          */

          if (payload.type === "done") {
            // Stream completed.
          }
        }
      }

      /*
        ---------------------------------------
        Handle a final incomplete SSE event.
        ---------------------------------------
      */

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
        }
      }
    } catch (error) {
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
      setLoading(false);
      setStreamingMessageId(null);
    }
  }

  /* ---------------------------------------
     Upload document
  --------------------------------------- */

  async function uploadDocument(file) {
    if (!file || uploading) {
      return;
    }

    const fileName = file.name.toLowerCase();

    const supported =
      fileName.endsWith(".pdf") ||
      fileName.endsWith(".md");

    if (!supported) {
      alert(
        "Only PDF and Markdown (.md) files are supported."
      );
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/api/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Upload failed"
        );
      }

      await loadDocuments();
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Failed to upload document."
      );
    } finally {
      setUploading(false);
    }
  }

  /* ---------------------------------------
     File input
  --------------------------------------- */

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      uploadDocument(file);
    }

    event.target.value = "";
  }

  /* ---------------------------------------
     Drag and drop
  --------------------------------------- */

  function handleDragOver(event) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();

    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      uploadDocument(file);
    }
  }

  /* ---------------------------------------
     Delete document
  --------------------------------------- */

  async function deleteDocument(name) {
    const confirmed = window.confirm(
      `Delete "${name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/documents/${encodeURIComponent(
          name
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Delete failed"
        );
      }

      await loadDocuments();
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Failed to delete document."
      );
    }
  }

  /* ---------------------------------------
     Example question
  --------------------------------------- */

  function useExample(example) {
    setQuestion(example);
  }

  /* ---------------------------------------
     Stats
  --------------------------------------- */

  const totalChunks = documents.reduce(
    (total, document) =>
      total + (document.chunks || 0),
    0
  );

  return (
    <div className="app-shell">

      {/* -----------------------------------
          Header
      ----------------------------------- */}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            G
          </div>

          <div>
            <div className="brand-name">
              Grounded AI
            </div>

            <div className="brand-subtitle">
              Document Intelligence
            </div>
          </div>
        </div>

        <button
          className="new-chat-button"
          onClick={startNewChat}
        >
          + New chat
        </button>
      </header>

      {/* -----------------------------------
          Main
      ----------------------------------- */}

      <main className="main-content">

        {/* ---------------------------------
            Knowledge base
        --------------------------------- */}

        <section className="knowledge-section">

          <div className="section-heading">
            <div>
              <span className="eyebrow">
                Knowledge base
              </span>

              <h1>
                Your documents,
                <br />
                grounded answers.
              </h1>

              <p>
                Upload documents and ask questions
                using local AI retrieval.
              </p>
            </div>

            <div className="stats-grid">

              <div className="stat-card">
                <span>Documents</span>
                <strong>
                  {documents.length}
                </strong>
              </div>

              <div className="stat-card">
                <span>Indexed chunks</span>
                <strong>
                  {totalChunks}
                </strong>
              </div>

              <div className="stat-card">
                <span>Inference</span>
                <strong>Local</strong>
              </div>

            </div>
          </div>

          {/* ---------------------------------
              Upload
          --------------------------------- */}

          <div
            className={`upload-zone ${
              dragActive
                ? "upload-zone-active"
                : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md"
              hidden
              onChange={handleFileChange}
            />

            <div className="upload-icon">
              ↑
            </div>

            <div className="upload-content">
              <strong>
                {uploading
                  ? "Processing document..."
                  : "Drop a document here"}
              </strong>

              <span>
                or click to browse
              </span>

              <small>
                PDF or Markdown · Max 50 MB
              </small>
            </div>
          </div>

          {/* ---------------------------------
              Documents
          --------------------------------- */}

          {documents.length > 0 && (
            <div className="documents-section">

              <div className="documents-heading">
                <div>
                  <h2>
                    Indexed documents
                  </h2>

                  <span>
                    {documents.length} sources
                  </span>
                </div>
              </div>

              <div className="documents-grid">

                {documents.map((document) => {
                  const isWeb =
                    document.name.startsWith(
                      "http"
                    );

                  const isPdf =
                    document.name
                      .toLowerCase()
                      .endsWith(".pdf");

                  return (
                    <div
                      className="document-card"
                      key={document.name}
                    >
                      <div className="document-icon">
                        {isWeb
                          ? "WEB"
                          : isPdf
                          ? "PDF"
                          : "MD"}
                      </div>

                      <div className="document-info">
                        <strong
                          title={document.name}
                        >
                          {document.name}
                        </strong>

                        <span>
                          {document.chunks || 0}{" "}
                          chunks
                        </span>
                      </div>

                      {!isWeb && (
                        <button
                          className="delete-document"
                          onClick={(event) => {
                            event.stopPropagation();

                            deleteDocument(
                              document.name
                            );
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>
          )}
        </section>

        {/* ---------------------------------
            Chat
        --------------------------------- */}

        <section className="chat-section">

          {messages.length === 0 ? (
            <div className="welcome-state">

              <div className="welcome-orb">
                ✦
              </div>

              <h2>
                Ask your knowledge base
              </h2>

              <p>
                Grounded AI retrieves relevant
                information from your documents
                before generating an answer.
              </p>

              <div className="examples">

                <button
                  onClick={() =>
                    useExample(
                      "What are React props?"
                    )
                  }
                >
                  What are React props?
                </button>

                <button
                  onClick={() =>
                    useExample(
                      "Explain React components"
                    )
                  }
                >
                  Explain React components
                </button>

                <button
                  onClick={() =>
                    useExample(
                      "How does JavaScript work?"
                    )
                  }
                >
                  How does JavaScript work?
                </button>

              </div>
            </div>
          ) : (
            <div className="messages">

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message-row ${
                    message.role === "user"
                      ? "message-user"
                      : "message-assistant"
                  }`}
                >

                  <div className="message-bubble">

                    <div className="message-content">

                      {message.role ===
                      "assistant" ? (
                        <ReactMarkdown
                          remarkPlugins={[
                            remarkGfm,
                          ]}
                          components={{
                            code({
                              inline,
                              className,
                              children,
                              ...props
                            }) {
                              const match =
                                /language-(\w+)/.exec(
                                  className || ""
                                );

                              if (inline) {
                                return (
                                  <code
                                    className="inline-code"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              }

                              return (
                                <div className="code-block">
                                  <div className="code-header">
                                    <span>
                                      {match
                                        ? match[1]
                                        : "code"}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigator.clipboard.writeText(
                                          String(
                                            children
                                          ).replace(
                                            /\n$/,
                                            ""
                                          )
                                        )
                                      }
                                    >
                                      Copy
                                    </button>
                                  </div>

                                  <pre>
                                    <code
                                      className={
                                        className
                                      }
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  </pre>
                                </div>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        message.content
                      )}

                    </div>

                    {/* --------------------------------
                        Grounding status
                    -------------------------------- */}

                    {message.role ===
                      "assistant" &&
                      !message.error &&
                      message.observability && (
                        <>

                          <div
                            className={`grounding-status ${
                              message.grounded
                                ? "grounded"
                                : "not-grounded"
                            }`}
                          >
                            <span className="status-dot">
                              {message.grounded
                                ? "✓"
                                : "!"}
                            </span>

                            <span>
                              {message.grounded
                                ? "Grounded in your documents"
                                : "Not grounded"}
                            </span>

                            <span className="status-score">
                              {message.observability
                                .relevanceScore !==
                              null
                                ? `Score ${message.observability.relevanceScore}`
                                : "No score"}
                            </span>
                          </div>

                          {/* --------------------------------
                              Retrieval summary
                          -------------------------------- */}

                          <div className="retrieval-summary">

                            <span>
                              {
                                message
                                  .observability
                                  .retrievedCount
                              }{" "}
                              retrieved
                            </span>

                            <span>•</span>

                            <span>
                              {
                                message
                                  .observability
                                  .rerankedCount
                              }{" "}
                              reranked
                            </span>

                            <button
                              onClick={() =>
                                setExpandedRetrieval(
                                  expandedRetrieval ===
                                    message.id
                                    ? null
                                    : message.id
                                )
                              }
                            >
                              {expandedRetrieval ===
                              message.id
                                ? "Hide details"
                                : "Retrieval details"}

                              <span>
                                {expandedRetrieval ===
                                message.id
                                  ? "↑"
                                  : "↓"}
                              </span>
                            </button>

                          </div>

                          {/* --------------------------------
                              Retrieval details
                          -------------------------------- */}

                          {expandedRetrieval ===
                            message.id && (
                            <div className="retrieval-details">

                              <div className="detail-row">
                                <span>
                                  Normalized query
                                </span>

                                <strong>
                                  {
                                    message
                                      .observability
                                      .normalizedQuery
                                  }
                                </strong>
                              </div>

                              <div className="detail-row">
                                <span>
                                  Vector search
                                </span>

                                <strong>
                                  {Math.round(
                                    message
                                      .observability
                                      .vectorWeight *
                                      100
                                  )}
                                  %
                                </strong>
                              </div>

                              <div className="detail-row">
                                <span>
                                  BM25 search
                                </span>

                                <strong>
                                  {Math.round(
                                    message
                                      .observability
                                      .bm25Weight *
                                      100
                                  )}
                                  %
                                </strong>
                              </div>

                              <div className="detail-row">
                                <span>
                                  Relevance score
                                </span>

                                <strong>
                                  {
                                    message
                                      .observability
                                      .relevanceScore
                                  }
                                </strong>
                              </div>

                              <div className="detail-row">
                                <span>
                                  Required threshold
                                </span>

                                <strong>
                                  {
                                    message
                                      .observability
                                      .relevanceThreshold
                                  }
                                </strong>
                              </div>

                            </div>
                          )}

                          {/* --------------------------------
                              Sources
                          -------------------------------- */}

                          {message.sources.length >
                            0 && (
                            <div className="sources-section">

                              <div className="sources-title">
                                Sources
                              </div>

                              <div className="sources-list">

                                {message.sources.map(
                                  (source) => (
                                    <div
                                      className="source-card"
                                      key={`${message.id}-${source.rank}`}
                                    >
                                      <div className="source-rank">
                                        {source.rank}
                                      </div>

                                      <div className="source-info">
                                        <strong>
                                          {
                                            source.source
                                          }
                                        </strong>

                                        <span>
                                          Page{" "}
                                          {
                                            source.page
                                          }{" "}
                                          · Score{" "}
                                          {
                                            source.score
                                          }
                                        </span>
                                      </div>
                                    </div>
                                  )
                                )}

                              </div>
                            </div>
                          )}

                        </>
                      )}

                  </div>
                </div>
              ))}

              {/* ---------------------------------
                  Loading indicator

                  Show it only before the first
                  streamed token arrives.
              --------------------------------- */}

              {loading &&
                streamingMessageId &&
                messages.some(
                  (message) =>
                    message.id ===
                      streamingMessageId &&
                    message.content.length === 0
                ) && (
                  <div className="message-row message-assistant">

                    <div className="message-bubble loading-bubble">

                      <div className="loading-dots">
                        <span />
                        <span />
                        <span />
                      </div>

                      <span>
                        Searching your knowledge base...
                      </span>

                    </div>

                  </div>
                )}

            </div>
          )}

          {/* ---------------------------------
              Chat input
          --------------------------------- */}

          <form
            className="chat-input-wrapper"
            onSubmit={askQuestion}
          >
            <input
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              placeholder="Ask something about your documents..."
              disabled={loading}
            />

            <button
              type="submit"
              disabled={
                loading ||
                !question.trim()
              }
            >
              {loading ? "..." : "↑"}
            </button>
          </form>

        </section>

      </main>
    </div>
  );
}

export default App;