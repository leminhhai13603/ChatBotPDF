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
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("all");
  const filesPerPage = 5; 
  const [showDeleteModal, setShowDeleteModal] = useState(false); 

  useEffect(() => {
    fetchRoles();
    fetchFiles();
  }, [refresh]);

  // 🏷️ Lấy danh sách roles
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

      console.log("🏷️ Raw roles response:", response.data); // Log raw response

      // Kiểm tra và format dữ liệu roles
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

      console.log("🏷️ Formatted roles:", formattedRoles); // Log formatted roles
      setRoles(formattedRoles);
    } catch (error) {
      console.error("❌ Lỗi khi tải danh mục:", error);
    }
  };

  // Thêm useEffect để log thông tin user khi component mount
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");
    console.log("📱 User Info:", { userId, token }); // Debug log
  }, []);

  // 📂 Lấy danh sách file
  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/pdf/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("📂 Files from API:", response.data.files); // Debug log
      setFiles(response.data.files);
      setFilteredFiles(response.data.files);
    } catch (error) {
      console.error("❌ Lỗi khi tải danh sách file:", error);
    }
  };

  // 🔍 Tìm kiếm và lọc file
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

    // Nếu không phải admin và đã chọn danh mục cụ thể
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
    
    // Lọc theo từ khóa tìm kiếm
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

  // 🔄 Chạy filter mỗi khi selectedRole hoặc searchQuery thay đổi
  useEffect(() => {
    filterFiles();
  }, [selectedRole, searchQuery, files]); // Thêm files vào dependencies

  // 🔍 Xử lý tìm kiếm
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    filterFiles();
  };

  // 📑 Xử lý chọn danh mục
  const handleCategoryChange = (e) => {
    const newRole = e.target.value;
    console.log("🔄 Selected role changed:", newRole); // Debug log
    setSelectedRole(newRole);
  };

  // Hàm cắt ngắn tên file
  const truncateFileName = (fileName, maxLength = 30) => {
    if (fileName.length <= maxLength) return fileName;
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.slice(0, -(extension.length + 1));
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${extension}`;
  };

  // 🗑️ Xóa file
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

      // Cập nhật danh sách file
      setFiles(files.filter(file => file.id !== fileToDelete.id));
      setFilteredFiles(filteredFiles.filter(file => file.id !== fileToDelete.id));
      
      // Reset states
      setFileToDelete(null);
      setShowDeleteModal(false);
      setSelectedFile(null);

      // Thông báo thành công
      console.log("✅ Xóa file thành công");
    } catch (error) {
      console.error("❌ Lỗi khi xóa file:", error);
    }
  };

  // 🗑️ Mở modal xác nhận xóa
  const confirmDelete = (file) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  // 🚫 Đóng modal xóa
  const closeDeleteModal = () => {
    setFileToDelete(null);
    setShowDeleteModal(false);
  };

  // 📌 Phân trang
  const totalPages = Math.ceil(filteredFiles.length / filesPerPage);
  const indexOfLastFile = currentPage * filesPerPage;
  const indexOfFirstFile = indexOfLastFile - filesPerPage;
  const currentFiles = filteredFiles.slice(indexOfFirstFile, indexOfLastFile);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // 📖 Chọn file để xem trước
  const handleFileClick = (file) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
    }
  };

  // Hàm định dạng lại text để hiển thị
  const formatText = (text) => {
    if (!text) return '';
    
    // Thay thế các ký tự xuống dòng liên tiếp bằng một thẻ <br>
    return text
      .replace(/\n\s*\n/g, '<br/><br/>') // Thay 2+ dòng trống bằng 2 <br>
      .replace(/\n/g, '<br/>'); // Thay các dòng đơn bằng 1 <br>
  };

  // Component hiển thị nội dung file
  const FileContent = ({ content }) => {
    if (!content) return <div className="file-content">Không có nội dung</div>;
    
    return (
      <pre className="file-content">
        {content}
      </pre>
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

  return (
    <div className="file-list-page">
      <div className="file-layout">
        <div className="file-preview">
          {selectedFile && (
            <>
              <h3>{selectedFile.pdf_name}</h3>
              <div className="file-info">
                <p><strong>Người tải lên:</strong> {selectedFile.uploader_name || 'Không xác định'}</p>
                <p><strong>Thời gian:</strong> {new Date(selectedFile.uploaded_at).toLocaleString('vi-VN')}</p>
              </div>
              <FileContent content={selectedFile.full_text} />
            </>
          )}
        </div>

        <div className="file-list-container">
          <div className="filters">
            {/* 🔽 Chọn danh mục */}
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

            {/* 🔍 Tìm kiếm */}
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
                <th>Người upload</th>
                <th>Ngày upload</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currentFiles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center">Không có file nào</td>
                </tr>
              ) : (
                currentFiles.map((file) => {
                  const uploadDate = new Date(file.uploaded_at).toLocaleDateString('vi-VN');
                  
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
                      <td>{file.uploader_name}</td>
                      <td>{uploadDate}</td>
                      <td className="action-column">
                        <button 
                          className="btn-delete" 
                          onClick={() => confirmDelete(file)}
                          title="Xóa file"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* 🔄 Phân trang */}
          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                ⬅ Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i + 1} className={currentPage === i + 1 ? "active" : ""} onClick={() => paginate(i + 1)}>
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

      {/* 🗑️ Modal Xóa File */}
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
