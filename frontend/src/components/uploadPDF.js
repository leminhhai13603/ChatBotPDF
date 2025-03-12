import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/uploadPDF.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const UploadPDF = ({ user, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/auth/user-roles/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setUserRoles(response.data);
      if (response.data.length > 0) {
        setSelectedRole(response.data[0].role_id);
      }
    } catch (error) {
      console.error("❌ Lỗi khi tải danh mục:", error);
      setError("Không thể tải danh mục. Vui lòng thử lại sau.");
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setFile(null);
      setError("Vui lòng chọn file!");
      return;
    }

    const fileType = selectedFile.type;
    const fileName = selectedFile.name.toLowerCase();

    if (fileType === "application/pdf" || 
        fileType === "text/csv" || 
        fileName.endsWith('.csv')) {
      setFile(selectedFile);
      setError("");
    } else {
      setFile(null);
      setError("Vui lòng chọn file PDF hoặc CSV!");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Vui lòng chọn file!");
      return;
    }

    if (!selectedRole) {
      setError("Vui lòng chọn danh mục!");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("originalFileName", file.name);
      formData.append("groupId", selectedRole);

      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE_URL}/pdf/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("✅ Upload thành công:", response.data);
      onUploadSuccess();
      
      // Reset form
      setFile(null);
      e.target.reset();
    } catch (error) {
      console.error("❌ Lỗi khi upload file:", error);
      setError(
        error.response?.data?.error || "Lỗi khi upload file. Vui lòng thử lại!"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-container">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">📁 Chọn file PDF hoặc CSV:</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.csv"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">🏷️ Chọn danh mục:</label>
          <select
            className="form-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={uploading}
          >
            <option value="">-- Chọn danh mục --</option>
            {userRoles.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!file || uploading || !selectedRole}
        >
          {uploading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Đang upload...
            </>
          ) : (
            <>
              📤 Upload
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default UploadPDF;
