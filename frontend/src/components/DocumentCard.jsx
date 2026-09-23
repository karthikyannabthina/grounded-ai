function DocumentCard({
  document,
  deleteDocument,
}) {
  const isWeb =
    document.name.startsWith("http");

  const isPdf =
    document.name
      .toLowerCase()
      .endsWith(".pdf");

  return (
    <div
      className="document-card"
      key={document.name}
    >
      <div className="document-icon">
        {isWeb
          ? "WEB"
          : isPdf
          ? "PDF"
          : "MD"}
      </div>

      <div className="document-info">
        <strong title={document.name}>
          {document.name}
        </strong>

        <span>
          {document.chunks || 0} chunks
        </span>
      </div>

      {!isWeb && (
        <button
          className="delete-document"
          onClick={(event) => {
            event.stopPropagation();

            deleteDocument(
              document.name
            );
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default DocumentCard;