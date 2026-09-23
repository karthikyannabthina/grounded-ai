function LoadingIndicator() {
  return (
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
  );
}

export default LoadingIndicator;