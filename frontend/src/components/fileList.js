import React, { useEffect, useState, useRef } from "react";
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
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("all");
  const filesPerPage = 5; 
  const [showDeleteModal, setShowDeleteModal] = useState(false); 
  const previewRef = useRef(null);

  useEffect(() => {
    fetchRoles();
    fetchFiles();
  }, [refresh]);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");

      if (!userId) {
        console.error("❌ Không tìm thấy userId trong localStorage");
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/auth/user-roles/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("🏷️ Raw roles response:", response.data);

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

      console.log("🏷️ Formatted roles:", formattedRoles);
      setRoles(formattedRoles);
    } catch (error) {
      console.error("❌ Lỗi khi tải danh mục:", error);
    }
  };

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");
    console.log("📱 User Info:", { userId, token }); 
  }, []);

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/pdf/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        console.log("📂 Files từ API:", response.data.files);
        setFiles(response.data.files);
        setFilteredFiles(response.data.files);
      } else {
        console.error("❌ Lỗi:", response.data.error);
      }
    } catch (error) {
      console.error("❌ Lỗi khi tải danh sách file:", error.response?.data || error.message);
    }
  };

  const filterFiles = () => {
    let filtered = [...files];
    const userRole = localStorage.getItem("userRole");
    
    console.log("🔍 Start filtering:", {
      selectedRole,
      userRole,
      totalFiles: files.length,
      fileDetails: files.map(f => ({
        name: f.pdf_name,
        group_id: f.group_id
      }))
    });

    if (userRole !== 'admin' && selectedRole !== "all") {
      filtered = filtered.filter(file => {
        const fileGroupId = Number(file.group_id || 0);
        const selectedRoleId = Number(selectedRole);
        
        console.log(`📑 Comparing:`, {
          fileName: file.pdf_name,
          fileGroupId,
          selectedRoleId,
          isMatch: fileGroupId === selectedRoleId
        });
        
        return fileGroupId === selectedRoleId;
      });
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        file =>
          file.pdf_name.toLowerCase().includes(query) ||
          (file.full_text && file.full_text.toLowerCase().includes(query))
      );
    }
    
    console.log("✅ Filtered results:", {
      totalFiltered: filtered.length,
      files: filtered.map(f => f.pdf_name)
    });
    
    setFilteredFiles(filtered);
    setCurrentPage(1);
  };

  useEffect(() => {
    filterFiles();
  }, [selectedRole, searchQuery, files]); 

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    filterFiles();
  };

  const handleCategoryChange = (e) => {
    const newRole = e.target.value;
    console.log("🔄 Selected role changed:", newRole); 
    setSelectedRole(newRole);
  };

  const truncateFileName = (fileName, maxLength = 30) => {
    if (fileName.length <= maxLength) return fileName;
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.slice(0, -(extension.length + 1));
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${extension}`;
  };

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error("❌ Không tìm thấy token");
        return;
      }

      await axios.delete(`${API_BASE_URL}/pdf/delete/${fileToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFiles(files.filter(file => file.id !== fileToDelete.id));
      setFilteredFiles(filteredFiles.filter(file => file.id !== fileToDelete.id));
      
      setFileToDelete(null);
      setShowDeleteModal(false);
      setSelectedFile(null);

      console.log("✅ Xóa file thành công");
    } catch (error) {
      console.error("❌ Lỗi khi xóa file:", error);
    }
  };

  const confirmDelete = (file) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setFileToDelete(null);
    setShowDeleteModal(false);
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

  const formatText = (text) => {
    if (!text) return '';
    
    return text
      .replace(/\n\s*\n/g, '<br/><br/>') 
      .replace(/\n/g, '<br/>'); 
  };

  const FileContent = ({ content, fileType }) => {
    const contentRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    
    const handleMouseDown = (e) => {
        // Nếu đang chọn text thì không xử lý kéo
        if (window.getSelection().toString()) {
            return;
        }

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
        
        // Tính khoảng cách di chuyển
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

    if (!content) {
        return <div className="file-content">Không có nội dung</div>;
    }

    return (
        <div 
            ref={contentRef}
            className={`file-content ${fileType === 'csv' ? 'ascii-table' : ''}`}
            onMouseDown={handleMouseDown}
        >
            <pre>{content}</pre>
        </div>
    );
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedRole, files]);

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5; // Số trang hiển thị tối đa

    // Luôn hiển thị trang đầu
    buttons.push(
      <button 
        key={1} 
        className={currentPage === 1 ? "active" : ""} 
        onClick={() => paginate(1)}
      >
        1
      </button>
    );

    // Thêm dấu ... bên trái
    if (currentPage > maxVisiblePages - 2) {
      buttons.push(<span key="left-dots">...</span>);
    }

    // Các trang ở giữa
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i <= currentPage + 1 && i >= currentPage - 1) {
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
    }

    // Thêm dấu ... bên phải
    if (currentPage < totalPages - (maxVisiblePages - 3)) {
      buttons.push(<span key="right-dots">...</span>);
    }

    // Luôn hiển thị trang cuối nếu có nhiều hơn 1 trang
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

  return (
    <div className="file-list-page">
      <div className="file-layout">
        <div 
          ref={previewRef}
          className="file-preview"
        >
          {selectedFile && (
            <>
              <h3>{selectedFile.pdf_name}</h3>
              <div className="file-info">
                <p><strong>Người tải lên:</strong> {selectedFile.uploader_name || 'Không xác định'}</p>
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
              {Array.isArray(roles) && roles.map((role) => (
                <option 
                  key={role.id} 
                  value={role.id}
                  title={role.name}
                >
                  {role.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              className="form-control search-bar"
              placeholder="🔍 Tìm kiếm theo tên hoặc nội dung..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>

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
              {currentFiles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center">Không có file nào</td>
                </tr>
              ) : (
                currentFiles.map((file) => {
                  const uploadDate = new Date(file.uploaded_at).toLocaleDateString('vi-VN');
                  const fileType = file.file_type?.toUpperCase() || 'PDF';
                  
                  return (
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
                      <td>{fileType}</td>
                      <td>{file.uploader_name}</td>
                      <td>{uploadDate}</td>
                      <td>{file.group_name}</td>
                      <td className="action-column">
                        <button 
                          className="btn-delete" 
                          onClick={() => confirmDelete(file)}
                          title="Xóa file"
                        >
                          🗑️ Xoá
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

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
            <button className="btn btn-danger mx-2" onClick={handleDelete}>Xác nhận Xóa</button>
            <button className="btn btn-secondary" onClick={closeDeleteModal}>Hủy</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList;
