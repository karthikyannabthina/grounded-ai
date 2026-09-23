function SourcesList({
  sources,
  messageId,
}) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="sources-section">

      <div className="sources-title">
        Sources
      </div>

      <div className="sources-list">

        {sources.map((source) => (
          <div
            className="source-card"
            key={`${messageId}-${source.rank}`}
          >
            <div className="source-rank">
              {source.rank}
            </div>

            <div className="source-info">
              <strong>
                {source.source}
              </strong>

              <span>
                Page {source.page} · Score{" "}
                {source.score}
              </span>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}

export default SourcesList;