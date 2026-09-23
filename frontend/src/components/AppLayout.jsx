import Header from "./Header";
import KnowledgeBase from "./KnowledgeBase";
import WelcomeState from "./WelcomeState";
import ChatArea from "./ChatArea";

function AppLayout({
  startNewChat,
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
  messages,
  useExample,
  streamingMessageId,
  loading,
  expandedRetrieval,
  setExpandedRetrieval,
  question,
  setQuestion,
  askQuestion,
}) {
  return (
    <div className="app-shell">

      <Header
        onNewChat={startNewChat}
      />

      <main className="main-content">

        <KnowledgeBase
          documents={documents}
          totalChunks={totalChunks}
          dragActive={dragActive}
          uploading={uploading}
          fileInputRef={fileInputRef}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          handleFileChange={handleFileChange}
          deleteDocument={deleteDocument}
        />

        <section className="chat-section">

          {messages.length === 0 && (
            <WelcomeState
              onExample={useExample}
            />
          )}

          <ChatArea
            messages={messages}
            streamingMessageId={
              streamingMessageId
            }
            loading={loading}
            expandedRetrieval={
              expandedRetrieval
            }
            setExpandedRetrieval={
              setExpandedRetrieval
            }
            question={question}
            setQuestion={setQuestion}
            askQuestion={askQuestion}
          />

        </section>

      </main>

    </div>
  );
}

export default AppLayout;