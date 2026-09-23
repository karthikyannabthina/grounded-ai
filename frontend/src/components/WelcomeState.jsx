function WelcomeState({ onExample }) {
  return (
    <div className="welcome-state">
      <div className="welcome-orb">✦</div>

      <h2>Ask your knowledge base</h2>

      <p>
        Grounded AI retrieves relevant information from your documents
        before generating an answer.
      </p>

      <div className="examples">
        <button
          onClick={() => onExample("What are React props?")}
        >
          What are React props?
        </button>

        <button
          onClick={() => onExample("Explain React components")}
        >
          Explain React components
        </button>

        <button
          onClick={() => onExample("How does JavaScript work?")}
        >
          How does JavaScript work?
        </button>
      </div>
    </div>
  );
}

export default WelcomeState;