
import DocumentCard from "./DocumentCard";
import UploadZone from "./UploadZone";
import StatsCards from "./StatsCards";
import KnowledgeBaseHeader from "./KnowledgeBaseHeader";
import DocumentsHeader from "./DocumentsHeader";

function KnowledgeBase({
  documents,
  totalChunks,
  dragActive,
  uploading,
  fileInputRef,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileChange,
  deleteDocument,
}) {
  return (
    <section className="knowledge-section">

      <div className="section-heading">

        <KnowledgeBaseHeader />

        <StatsCards
          documents={documents}
          totalChunks={totalChunks}
        />

      </div>

      <UploadZone
        dragActive={dragActive}
        uploading={uploading}
        fileInputRef={fileInputRef}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        handleFileChange={handleFileChange}
      />

      {documents.length > 0 && (
        <div className="documents-section">

          <DocumentsHeader
            documentCount={documents.length}
          />

          <div className="documents-grid">

            {documents.map((document) => (
              <DocumentCard
                key={document.name}
                document={document}
                deleteDocument={deleteDocument}
              />
            ))}

          </div>

        </div>
      )}

    </section>
  );
}

export default KnowledgeBase;

