import AppLayout from "./components/AppLayout";
import useDocuments from "./hooks/useDocuments";
import useChat from "./hooks/useChat";

import "./App.css";

function App() {
  const {
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
  } = useDocuments();

  const {
    question,
    setQuestion,
    messages,
    loading,
    streamingMessageId,
    expandedRetrieval,
    setExpandedRetrieval,
    startNewChat,
    askQuestion,
    useExample,
  } = useChat();

  return (
    <AppLayout
      startNewChat={startNewChat}
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
      messages={messages}
      useExample={useExample}
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
  );
}

export default App;