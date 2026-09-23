function StatsCards({
  documents,
  totalChunks,
}) {
  return (
    <div className="stats-grid">

      <div className="stat-card">
        <span>
          Documents
        </span>

        <strong>
          {documents.length}
        </strong>
      </div>

      <div className="stat-card">
        <span>
          Indexed chunks
        </span>

        <strong>
          {totalChunks}
        </strong>
      </div>

      <div className="stat-card">
        <span>
          Inference
        </span>

        <strong>
          Local
        </strong>
      </div>

    </div>
  );
}

export default StatsCards;
