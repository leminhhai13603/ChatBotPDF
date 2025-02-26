import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { FaRobot, FaUpload } from "react-icons/fa";
import { Modal, Button } from "react-bootstrap";
import UploadPDF from "./components/uploadPDF";
import FileList from "./components/fileList";
import SearchPDF from "./components/searchPDF";
import Login from "./pages/login";
import Header from "./components/header";
import Profile from "./pages/profile";
import ChangePassword from "./pages/changePassword";
import ManageUsers from "./pages/manageUser";
import "./css/App.css";
import axios from "axios";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 

const App = () => {
    const [showChatbot, setShowChatbot] = useState(false);
    const [refreshFiles, setRefreshFiles] = useState(0);
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;
    
            try {
                const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                
                const userData = response.data;
                userData.roles = Array.isArray(userData.roles) ? userData.roles : [userData.role]; // 🔥 Đảm bảo roles là mảng
                
                setUser(userData);
                setIsAuthenticated(true);
            } catch {
                setIsAuthenticated(false);
                localStorage.removeItem("token");
            }
        };
    
        fetchUser();
    }, [isAuthenticated]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setUser(null);
    };

    return (
        <Router>
            {isAuthenticated && <Header user={user} onLogout={handleLogout} />}

            <div className="app-container">
                <Routes>
                    {isAuthenticated ? (
                        <>
                            {/* 🔹 Trang chính */}
                            <Route
                                path="/"
                                element={
                                    <div>
                                        {/* ✅ Nút mở modal Upload PDF */}
                                        <Button className="toggle-upload-btn" onClick={() => setShowUploadModal(true)}>
                                            <FaUpload size={20} /> Tải lên PDF
                                        </Button>

                                        <FileList refresh={refreshFiles} />

                                        {/* ✅ Nút mở chatbot */}
                                        <button className="chatbot-toggle-btn" onClick={() => setShowChatbot(!showChatbot)}>
                                            <FaRobot size={24} />
                                        </button>

                                        {/* ✅ Chatbot hiển thị khi bật */}
                                        {showChatbot && (
                                            <div className="chatbot-container">
                                                <button className="close-btn" onClick={() => setShowChatbot(false)}>✖</button>
                                                <SearchPDF />
                                            </div>
                                        )}
                                    </div>
                                }
                            />

                            {/* ✅ Trang Đổi thông tin cá nhân */}
                            <Route path="/profile" element={<Profile />} />

                            {/* ✅ Trang Đổi mật khẩu */}
                            <Route path="/change-password" element={<ChangePassword />} />

                            {/* ✅ Hiển thị Quản lý tài khoản nếu user là admin */}
                            {user?.roles?.includes("admin") && <Route path="/manage-users" element={<ManageUsers />} />}

                            {/* ✅ Trang không tồn tại → Redirect về trang chính */}
                            <Route path="*" element={<Navigate to="/" />} />
                        </>
                    ) : (
                        <>
                            {/* ✅ Nếu chưa đăng nhập, chỉ hiển thị trang Login */}
                            <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />} />
                            <Route path="*" element={<Navigate to="/login" />} />
                        </>
                    )}
                </Routes>
            </div>

            {/* ✅ Modal Upload PDF - Truyền thêm user */}
            <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>📂 Tải lên PDF</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <UploadPDF 
                        user={user}  
                        onUploadSuccess={() => {
                            setRefreshFiles((prev) => prev + 1);
                            setShowUploadModal(false);
                        }} 
                    />
                </Modal.Body>
            </Modal>
        </Router>
    );
};

export default App;