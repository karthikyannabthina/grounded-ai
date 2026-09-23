function ChatInput({
  question,
  setQuestion,
  loading,
  askQuestion,
}) {
  return (
    <form
      className="chat-input-wrapper"
      onSubmit={askQuestion}
    >
      <input
        value={question}
        onChange={(event) =>
          setQuestion(event.target.value)
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
  );
}

export default ChatInput;