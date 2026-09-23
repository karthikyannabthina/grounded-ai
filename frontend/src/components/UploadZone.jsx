function UploadZone({
  dragActive,
  uploading,
  fileInputRef,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileChange,
}) {
  return (
    <div
      className={`upload-zone ${
        dragActive
          ? "upload-zone-active"
          : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() =>
        fileInputRef.current?.click()
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md"
        hidden
        onChange={handleFileChange}
      />

      <div className="upload-icon">
        ↑
      </div>

      <div className="upload-content">
        <strong>
          {uploading
            ? "Processing document..."
            : "Drop a document here"}
        </strong>

        <span>
          or click to browse
        </span>

        <small>
          PDF or Markdown · Max 50 MB
        </small>
      </div>
    </div>
  );
}

export default UploadZone;