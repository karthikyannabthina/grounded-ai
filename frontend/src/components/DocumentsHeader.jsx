function DocumentsHeader({
  documentCount,
}) {
  return (
    <div className="documents-heading">
      <div>
        <h2>
          Indexed documents
        </h2>

        <span>
          {documentCount} sources
        </span>
      </div>
    </div>
  );
}

export default DocumentsHeader;