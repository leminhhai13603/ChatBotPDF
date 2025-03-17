import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import axios from "axios";
import "../css/fileList.css"; 
import { debounce } from "lodash";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const FileList = ({ refresh }) => {
  const [files, setFiles] = useState([]);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false); 
  const previewRef = useRef(null);

  // Fetch roles khi component mount
  useEffect(() => {
    fetchRoles();
  }, []);

  // Fetch files khi page hoặc role thay đổi
  useEffect(() => {
    fetchFiles();
  }, [currentPage, selectedRole, refresh]);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");

      if (!userId) return;

      const response = await axios.get(`${API_BASE_URL}/auth/user-roles/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let formattedRoles = [];
      if (Array.isArray(response.data)) {
        formattedRoles = response.data.map(role => ({
          id: role.role_id || role.id,
          name: role.role_name || role.name
        }));
      } else if (response.data && Array.isArray(response.data.roles)) {
        formattedRoles = response.data.roles.map(role => ({
          id: role.role_id || role.id,
          name: role.role_name || role.name
        }));
      }

      setRoles(formattedRoles);
    } catch (error) {
      console.error("❌ Lỗi khi tải danh mục:", error);
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      const response = await axios.get(`${API_BASE_URL}/pdf/list`, {
        params: {
          page: currentPage,
          category: selectedRole !== "all" ? selectedRole : undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setFiles(response.data.files);
        setTotalPages(response.data.totalPages);
        
        // Log để debug
        console.log("Total pages:", response.data.totalPages);
        console.log("Current page:", response.data.currentPage);
        console.log("Files count:", response.data.files.length);
      }
    } catch (error) {
      console.error("❌ Lỗi khi tải danh sách file:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (e) => {
    setSelectedRole(e.target.value);
    setCurrentPage(1); // Reset về trang 1 khi đổi category
  };

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      
      if (!token || !fileToDelete) return;

      await axios.delete(`${API_BASE_URL}/pdf/delete/${fileToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFileToDelete(null);
      setShowDeleteModal(false);
      setSelectedFile(null);
      fetchFiles(); // Refresh list after delete

    } catch (error) {
      console.error("❌ Lỗi khi xóa file:", error);
    }
  };

  const handleFileClick = (file) => {
    console.log("Selected file content:", file.full_text);
    setSelectedFile(selectedFile?.id === file.id ? null : file);
  };

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;

    buttons.push(
      <button 
        key={1} 
        className={currentPage === 1 ? "active" : ""} 
        onClick={() => paginate(1)}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(<span key="left-dots">...</span>);
    }

    for (let i = Math.max(2, currentPage - 1); 
         i <= Math.min(totalPages - 1, currentPage + 1); 
         i++) {
      buttons.push(
        <button
          key={i}
          className={currentPage === i ? "active" : ""}
          onClick={() => paginate(i)}
        >
          {i}
        </button>
      );
    }

    if (currentPage < totalPages - 2) {
      buttons.push(<span key="right-dots">...</span>);
    }

    if (totalPages > 1) {
      buttons.push(
        <button
          key={totalPages}
          className={currentPage === totalPages ? "active" : ""}
          onClick={() => paginate(totalPages)}
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  };

  const isAnonymousCategory = (groupName) => {
    return groupName?.toLowerCase().includes('hộp thư góp ý');
  };

  const truncateFileName = (fileName, maxLength = 30) => {
    if (fileName.length <= maxLength) return fileName;
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.slice(0, -(extension.length + 1));
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${extension}`;
  };

  return (
    <div className="file-list-page">
      <div className="file-layout">
        <div ref={previewRef} className="file-preview">
          {selectedFile && (
            <>
              <h3>{selectedFile.pdf_name}</h3>
              <div className="file-info">
                {!isAnonymousCategory(selectedFile.group_name) && (
                  <p><strong>Người tải lên:</strong> {selectedFile.uploader_name || 'Không xác định'}</p>
                )}
                <p><strong>Thời gian:</strong> {new Date(selectedFile.uploaded_at).toLocaleString('vi-VN')}</p>
                <p><strong>Loại file:</strong> {selectedFile.file_type?.toUpperCase() || 'PDF'}</p>
              </div>
              <FileContent 
                content={selectedFile.full_text}
                fileType={selectedFile.file_type} 
              />
            </>
          )}
        </div>

        <div className="file-list-container">
          <div className="filters">
            <select 
              className="form-select category-select" 
              value={selectedRole} 
              onChange={handleCategoryChange}
            >
              <option value="all">🏷️ Tất cả</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="table-container">
            <table className="file-list-table">
              <thead>
                <tr>
                  <th>Tên file</th>
                  <th>Loại</th>
                  <th>Người upload</th>
                  <th>Ngày upload</th>
                  <th>Nhóm</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="loading-cell">
                      <div className="loading-spinner">Đang tải...</div>
                    </td>
                  </tr>
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">Không có file nào</td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.id} className={selectedFile?.id === file.id ? "selected-row" : ""}>
                      <td>
                        <span
                          className={`file-name clickable ${selectedFile?.id === file.id ? "selected" : ""}`}
                          onClick={() => handleFileClick(file)}
                          title={file.pdf_name}
                        >
                          {truncateFileName(file.pdf_name)}
                        </span>
                      </td>
                      <td>{file.file_type?.toUpperCase() || 'PDF'}</td>
                      <td>
                        {isAnonymousCategory(file.group_name) ? 'Ẩn danh' : (file.uploader_name || 'Không xác định')}
                      </td>
                      <td>{new Date(file.uploaded_at).toLocaleDateString('vi-VN')}</td>
                      <td>{file.group_name}</td>
                      <td>
                        <button 
                          className="btn-delete" 
                          onClick={() => {
                            setFileToDelete(file);
                            setShowDeleteModal(true);
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-arrow"
                onClick={() => paginate(currentPage - 1)} 
                disabled={currentPage === 1}
              >
                ⬅ Trước
              </button>
              {renderPaginationButtons()}
              <button 
                className="pagination-arrow"
                onClick={() => paginate(currentPage + 1)} 
                disabled={currentPage === totalPages}
              >
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
            <button onClick={handleDelete}>Xác nhận</button>
            <button onClick={() => setShowDeleteModal(false)}>Hủy</button>
          </div>
        </div>
      )}
    </div>
  );
};

const FileContent = ({ content, fileType }) => {
  const contentRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  
  const handleMouseDown = (e) => {
    if (window.getSelection().toString()) return;

    const content = contentRef.current;
    if (!content) return;
    
    setIsDragging(true);
    setStartX(e.pageX - content.offsetLeft);
    setStartY(e.pageY - content.offsetTop);
    setScrollLeft(content.scrollLeft);
    setScrollTop(content.scrollTop);
    content.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const content = contentRef.current;
    const x = e.pageX - content.offsetLeft;
    const y = e.pageY - content.offsetTop;
    
    const walkX = (x - startX) * 2;
    const walkY = (y - startY) * 2;
    
    content.scrollLeft = scrollLeft - walkX;
    content.scrollTop = scrollTop - walkY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (contentRef.current) {
      contentRef.current.style.cursor = 'grab';
    }
  };

  useEffect(() => {
    const content = contentRef.current;
    if (content) {
      content.addEventListener('mousemove', handleMouseMove);
      content.addEventListener('mouseup', handleMouseUp);
      content.addEventListener('mouseleave', handleMouseUp);

      return () => {
        content.removeEventListener('mousemove', handleMouseMove);
        content.removeEventListener('mouseup', handleMouseUp);
        content.removeEventListener('mouseleave', handleMouseUp);
      };
    }
  }, [isDragging, startX, startY, scrollLeft, scrollTop]);

  const displayContent = content || 'Không có nội dung';

  return (
    <div 
      ref={contentRef}
      className={`file-content ${fileType === 'csv' ? 'ascii-table' : ''}`}
      onMouseDown={handleMouseDown}
    >
      <pre>{displayContent}</pre>
    </div>
  );
};

export default memo(FileList);
