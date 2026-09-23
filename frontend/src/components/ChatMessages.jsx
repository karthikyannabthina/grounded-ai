import ChatMessage from "./ChatMessage";
import LoadingIndicator from "./LoadingIndicator";

function ChatMessages({
  messages,
  streamingMessageId,
  loading,
  expandedRetrieval,
  setExpandedRetrieval,
}) {
  return (
    <div className="messages">

      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          expandedRetrieval={expandedRetrieval}
          setExpandedRetrieval={
            setExpandedRetrieval
          }
        />
      ))}

      {loading &&
        streamingMessageId &&
        messages.some(
          (message) =>
            message.id === streamingMessageId &&
            message.content.length === 0
        ) && <LoadingIndicator />}

    </div>
  );
}

export default ChatMessages;