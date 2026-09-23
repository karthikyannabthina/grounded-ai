import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import GroundingStatus from "./GroundingStatus";
import RetrievalDetails from "./RetrievalDetails";
import SourcesList from "./SourcesList";

function ChatMessage({
  message,
  expandedRetrieval,
  setExpandedRetrieval,
}) {
  return (
    <div
      className={`message-row message-${message.role}`}
    >
      <div className="message-avatar">
        {message.role === "user" ? "U" : "G"}
      </div>

      <div className="message-content">
        <div className="message-bubble">

          {message.role === "assistant" ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({
                  className,
                  children,
                  ...props
                }) {
                  const codeText =
                    String(children).replace(/\n$/, "");

                  const isCodeBlock =
                    Boolean(className) ||
                    String(children).includes("\n");

                  if (!isCodeBlock) {
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
                          Code
                        </span>

                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(
                              codeText
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <pre>
                        <code
                          className={className}
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

        {message.role === "assistant" &&
          message.grounded !== undefined && (
            <>
              <GroundingStatus
                grounded={message.grounded}
              />

              {message.retrieval && (
                <div className="retrieval-summary">
                  <span>
                    {message.retrieval.length} retrieved
                  </span>

                  <button
                    onClick={() =>
                      setExpandedRetrieval(
                        expandedRetrieval === message.id
                          ? null
                          : message.id
                      )
                    }
                  >
                    {expandedRetrieval === message.id
                      ? "Hide details"
                      : "View details"}
                    <span>
                      {expandedRetrieval === message.id
                        ? "↑"
                        : "↓"}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

        {expandedRetrieval === message.id &&
          message.retrieval && (
            <RetrievalDetails
              retrieval={message.retrieval}
            />
          )}

        <SourcesList
          sources={message.sources}
          messageId={message.id}
        />

      </div>
    </div>
  );
}

export default ChatMessage;