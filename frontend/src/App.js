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
import ManageCategories from "./pages/manageCategory";
import "./css/App.css";
import axios from "axios";
import BlogList from './pages/BlogList';
import PrivateRoute from './components/PrivateRoute';
import BlogDetail from './pages/BlogDetail';
import CategoryDetail from './pages/CategoryDetail';
import SheetDashboard from './pages/SheetDashboard';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 

const App = () => {
    const [showChatbot, setShowChatbot] = useState(false);
    const [refreshFiles, setRefreshFiles] = useState(0);
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                setIsLoading(false);
                return;
            }
    
            try {
                const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                
                const userData = response.data;
                userData.roles = Array.isArray(userData.roles) ? userData.roles : [userData.role];
                
                setUser(userData);
                setIsAuthenticated(true);
            } catch {
                setIsAuthenticated(false);
                localStorage.removeItem("token");
            } finally {
                setIsLoading(false);
            }
        };
    
        fetchUser();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setUser(null);
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <Router>
            {isAuthenticated && <Header user={user} onLogout={handleLogout} />}

            <div className="app-container">
                <Routes>
                    {isAuthenticated ? (
                        <>
                            <Route
                                path="/"
                                element={
                                    <div>
                                        <Button className="toggle-upload-btn" onClick={() => setShowUploadModal(true)}>
                                            <FaUpload size={20} /> Tải lên PDF
                                        </Button>

                                        <FileList refresh={refreshFiles} />

                                        <button className="chatbot-toggle-btn" onClick={() => setShowChatbot(!showChatbot)}>
                                            <FaRobot size={24} />
                                        </button>

                                        {showChatbot && (
                                            <div className="chatbot-container">
                                                <button className="close-btn" onClick={() => setShowChatbot(false)}>✖</button>
                                                <SearchPDF />
                                            </div>
                                        )}
                                    </div>
                                }
                            />

                            <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
                            <Route path="/change-password" element={<ChangePassword user={user} />} />
                            {user?.roles?.includes("admin") && (
                                <>
                                    <Route path="/manage-users" element={<ManageUsers user={user} />} />
                                    <Route path="/manage-categories" element={<ManageCategories />} />
                                </>
                            )}
                            <Route path="/blog" element={<BlogList />} />
                            <Route path="/blog/category/:category" element={<CategoryDetail />} />
                            <Route path="/blog/:id" element={<BlogDetail />} />
                            <Route path="/sheets" element={<PrivateRoute><SheetDashboard /></PrivateRoute>} />
                            <Route path="*" element={<Navigate to="/" />} />
                        </>
                    ) : (
                        <>
                            <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />} />
                            <Route path="*" element={<Navigate to="/login" />} />
                        </>
                    )}
                </Routes>
            </div>

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