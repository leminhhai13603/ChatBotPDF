import React, { useState } from "react";
import axios from "axios";

const UploadPDF = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("⚠ Vui lòng chọn tệp PDF");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file);
    setUploading(true);
    setMessage("⏳ Đang tải lên...");

    try {
      const response = await axios.post("http://localhost:5000/api/pdf/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage(`✅ Tải lên thành công!`);
      setFile(null);
      onUploadSuccess(); // Cập nhật danh sách file mà không cần reload
    } catch (error) {
      setMessage("❌ Có lỗi xảy ra khi tải lên.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card p-4">
      <h2 className="text-center mb-3">📤 Upload PDF</h2>
      <div className="input-group mb-3">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="form-control"
          disabled={uploading}
        />
      </div>
      <button onClick={handleUpload} className="btn btn-success w-100" disabled={uploading}>
        {uploading ? "Đang tải lên..." : "Tải lên"}
      </button>
      <p className="text-muted mt-2">{message}</p>
    </div>
  );
};

export default UploadPDF;
