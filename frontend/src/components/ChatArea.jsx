import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";

function ChatArea({
  messages,
  streamingMessageId,
  loading,
  expandedRetrieval,
  setExpandedRetrieval,
  question,
  setQuestion,
  askQuestion,
}) {
  return (
    <>
      {messages.length > 0 && (
        <ChatMessages
          messages={messages}
          streamingMessageId={
            streamingMessageId
          }
          loading={loading}
          expandedRetrieval={
            expandedRetrieval
          }
          setExpandedRetrieval={
            setExpandedRetrieval
          }
        />
      )}

      <ChatInput
        question={question}
        setQuestion={setQuestion}
        loading={loading}
        askQuestion={askQuestion}
      />
    </>
  );
}

export default ChatArea;