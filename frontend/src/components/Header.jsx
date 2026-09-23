function Header({ onNewChat }) {
  return (
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
        onClick={onNewChat}
      >
        + New chat
      </button>
    </header>
  );
}

export default Header;