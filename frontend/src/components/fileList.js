import React, { useEffect, useState } from "react";
import axios from "axios";
import "../css/fileList.css"; 
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const FileList = ({ refresh }) => {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const filesPerPage = 5; 
  const [showDeleteModal, setShowDeleteModal] = useState(false); 

  useEffect(() => {
    fetchFiles();
  }, [refresh]);

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/pdf/list`);
      setFiles(response.data.files);
      setFilteredFiles(response.data.files);
    } catch (error) {
      console.error("❌ Lỗi khi tải danh sách file:", error);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    const filtered = files.filter(
      (file) =>
        file.pdf_name.toLowerCase().includes(query) ||
        (file.full_text && file.full_text.toLowerCase().includes(query))
    );
    setFilteredFiles(filtered);
    setCurrentPage(1); 
  };

  const confirmDelete = (file) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setFileToDelete(null);
    setShowDeleteModal(false);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    try {
      await axios.delete(`${API_BASE_URL}/pdf/delete/${fileToDelete.id}`);
      const updatedFiles = files.filter((file) => file.id !== fileToDelete.id);
      setFiles(updatedFiles);
      setFilteredFiles(updatedFiles);
      setFileToDelete(null);
      setShowDeleteModal(false);
      if (selectedFile?.id === fileToDelete.id) {
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("❌ Lỗi khi xóa file:", error);
    }
  };

  const totalPages = Math.ceil(filteredFiles.length / filesPerPage);
  const indexOfLastFile = currentPage * filesPerPage;
  const indexOfFirstFile = indexOfLastFile - filesPerPage;
  const currentFiles = filteredFiles.slice(indexOfFirstFile, indexOfLastFile);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleFileClick = (file) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null); 
    } else {
      setSelectedFile(file); 
    }
  };

  return (
    <div className="file-list-page">
      <div className="file-layout">
        <div className="file-preview">
          {selectedFile ? (
            <>
              <h3>📖 Nội dung file: {selectedFile.pdf_name}</h3>
              <p className="file-content" style={{ whiteSpace: "pre-wrap" }}>
                {selectedFile.full_text || "Không có nội dung để hiển thị."}
              </p>
            </>
          ) : (
            <p className="no-preview">Chọn một file để xem nội dung!</p>
          )}
        </div>

        <div className="file-list-container">
          <input
            type="text"
            className="search-bar"
            placeholder="🔍 Tìm kiếm theo tên hoặc nội dung..."
            value={searchQuery}
            onChange={handleSearch}
          />

          <table className="file-list-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tên file</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {currentFiles.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center">Không có file nào</td>
                </tr>
              ) : (
                currentFiles.map((file, index) => (
                  <tr key={file.id} className={selectedFile?.id === file.id ? "selected-row" : ""}>
                    <td>{indexOfFirstFile + index + 1}</td>
                    <td>
                      <span
                        className={`file-name clickable ${selectedFile?.id === file.id ? "selected" : ""}`}
                        onClick={() => handleFileClick(file)}
                      >
                        {file.pdf_name}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm mx-2" onClick={() => confirmDelete(file)}>
                        🗑 Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                ⬅ Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={currentPage === i + 1 ? "active" : ""}
                  onClick={() => paginate(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                Tiếp ➡
              </button>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="delete-modal">
          <div className="modal-content">
            <p>Bạn có chắc chắn muốn xóa file?</p>
            <button className="btn btn-danger mx-2" onClick={handleDelete}>Xác nhận Xóa</button>
            <button className="btn btn-secondary" onClick={closeDeleteModal}>Hủy</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList;
