import { useEffect, useRef, useState } from "react";

import {
  getDocuments,
  uploadDocument as uploadDocumentApi,
  removeDocument,
} from "../services/api";

function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  async function loadDocuments() {
    try {
      const data = await getDocuments();

      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error(
        "Failed to load documents:",
        error
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialDocuments() {
      try {
        const data = await getDocuments();

        if (!cancelled && data.success) {
          setDocuments(data.documents || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load documents:",
            error
          );
        }
      }
    }

    loadInitialDocuments();

    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadDocument(file) {
    if (!file || uploading) {
      return;
    }

    const fileName =
      file.name.toLowerCase();

    const supported =
      fileName.endsWith(".pdf") ||
      fileName.endsWith(".md");

    if (!supported) {
      alert(
        "Only PDF and Markdown (.md) files are supported."
      );

      return;
    }

    setUploading(true);

    try {
      await uploadDocumentApi(file);

      await loadDocuments();
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Failed to upload document."
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event) {
    const file =
      event.target.files?.[0];

    if (file) {
      uploadDocument(file);
    }

    event.target.value = "";
  }

  function handleDragOver(event) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();

    setDragActive(false);

    const file =
      event.dataTransfer.files?.[0];

    if (file) {
      uploadDocument(file);
    }
  }

  async function deleteDocument(name) {
    const confirmed =
      window.confirm(
        `Delete "${name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await removeDocument(name);

      await loadDocuments();
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Failed to delete document."
      );
    }
  }

  const totalChunks =
    documents.reduce(
      (total, document) =>
        total +
        (document.chunks || 0),
      0
    );

  return {
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
  };
}

export default useDocuments;