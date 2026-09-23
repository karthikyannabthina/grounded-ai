function RetrievalDetails({
  retrieval,
}) {
  return (
    <div className="retrieval-details">
      {retrieval.map((item, index) => (
        <div
          className="detail-row"
          key={index}
        >
          <span>
            {item.source ||
              item.document ||
              "Source"}
          </span>

          {item.score !== undefined && (
            <strong>
              Score:{" "}
              {Number(item.score).toFixed(3)}
            </strong>
          )}
        </div>
      ))}
    </div>
  );
}

export default RetrievalDetails;