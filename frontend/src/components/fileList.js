import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import axios from "axios";
import { Modal } from "antd";
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
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showChatbot, setShowChatbot] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Thêm useEffect để xử lý responsive
  useEffect(() => {
    const handleResize = debounce(() => {
      setIsMobile(window.innerWidth <= 768);
    }, 250);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch roles khi component mount
  useEffect(() => {
    fetchRoles();
  }, []);

  // Fetch files khi page, role, search term hoặc refresh thay đổi
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        
        console.log("🔍 Đang fetch với category:", selectedRole);
        
        const params = {
          page: currentPage,
          ...(selectedRole !== "all" && { category: selectedRole }),
          ...(searchTerm && { search: searchTerm })
        };

        console.log("📝 Params gửi đi:", params);

        const response = await axios.get(`${API_BASE_URL}/pdf/list`, {
          params,
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          console.log("✅ Dữ liệu nhận về:", response.data);
          setFiles(response.data.files);
          setTotalPages(response.data.totalPages);
        }
      } catch (error) {
        console.error("❌ Lỗi khi tải danh sách:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, selectedRole, searchTerm]);

  // Thêm useEffect để theo dõi trạng thái chatbot từ localStorage
  useEffect(() => {
    const handleChatbotVisibility = () => {
      const chatbotVisible = localStorage.getItem('showChatbot') === 'true';
      setShowChatbot(chatbotVisible);
    };
    
    // Kiểm tra ban đầu
    handleChatbotVisibility();
    
    // Thiết lập event listener cho storage changes
    window.addEventListener('storage', handleChatbotVisibility);
    
    // Custom event từ App.js
    const handleChatbotToggle = (e) => {
      setShowChatbot(e.detail.visible);
    };
    window.addEventListener('chatbotToggle', handleChatbotToggle);
    
    return () => {
      window.removeEventListener('storage', handleChatbotVisibility);
      window.removeEventListener('chatbotToggle', handleChatbotToggle);
    };
  }, []);

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

  const handleCategoryChange = (e) => {
    console.log("🔄 Thay đổi category:", e.target.value);
    setSelectedRole(e.target.value);
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    console.log("🔍 Tìm kiếm:", value);
    setSearchTerm(value);
    setCurrentPage(1);
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
      
      // Fetch lại data sau khi xóa
      setCurrentPage(1); // Reset về trang 1
      setSelectedRole(selectedRole); // Trigger useEffect fetch data
    } catch (error) {
      console.error("❌ Lỗi khi xóa file:", error);
    }
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    setShowPreviewModal(true);
  };

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = isMobile ? 3 : 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
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
    } else {
      buttons.push(
        <button 
          key={1} 
          className={currentPage === 1 ? "active" : ""} 
          onClick={() => paginate(1)}
        >
          1
        </button>
      );

      if (currentPage > 2) {
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

      if (currentPage < totalPages - 1) {
        buttons.push(<span key="right-dots">...</span>);
      }

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
    <div className={`file-list-page ${showChatbot ? 'chatbot-open' : ''}`}>
      <div className="file-layout">
        <div className="file-list-container">
          <div className="filters">
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Tìm kiếm theo tên file..."
                onChange={handleSearchChange}
              />
            </div>
            
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
                          {truncateFileName(file.pdf_name, isMobile ? 20 : 30)}
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
                {isMobile ? '⬅' : '⬅ Trước'}
              </button>
              {renderPaginationButtons()}
              <button 
                className="pagination-arrow"
                onClick={() => paginate(currentPage + 1)} 
                disabled={currentPage === totalPages}
              >
                {isMobile ? '➡' : 'Tiếp ➡'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showPreviewModal && selectedFile && (
        <Modal
          visible={showPreviewModal}
          onCancel={() => setShowPreviewModal(false)}
          footer={null}
          width={isMobile ? "95%" : "90%"}
          style={{ top: isMobile ? 10 : 20 }}
        >
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
        </Modal>
      )}

      {showDeleteModal && (
        <Modal
          visible={showDeleteModal}
          onCancel={() => setShowDeleteModal(false)}
          title="Xác nhận xóa"
          okText="Xóa"
          cancelText="Hủy"
          onOk={handleDelete}
          width={isMobile ? "90%" : "400px"}
          centered
        >
          <p>Bạn có chắc chắn muốn xóa file "{fileToDelete?.pdf_name}"?</p>
        </Modal>
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

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();

    const content = contentRef.current;
    const x = e.pageX - content.offsetLeft;
    const y = e.pageY - content.offsetTop;
    
    const walkX = (x - startX) * 2;
    const walkY = (y - startY) * 2;
    
    content.scrollLeft = scrollLeft - walkX;
    content.scrollTop = scrollTop - walkY;
  }, [isDragging, startX, startY, scrollLeft, scrollTop]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (contentRef.current) {
      contentRef.current.style.cursor = 'grab';
    }
  }, []);

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
  }, [handleMouseMove, handleMouseUp]);

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
