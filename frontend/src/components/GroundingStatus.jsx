function GroundingStatus({ grounded }) {
  return (
    <div
      className={`grounding-status ${
        grounded
          ? "grounded"
          : "not-grounded"
      }`}
    >
      <span className="status-dot">
        {grounded ? "✓" : "!"}
      </span>

      <span>
        {grounded
          ? "Grounded"
          : "Not grounded"}
      </span>
    </div>
  );
}

export default GroundingStatus;