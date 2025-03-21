import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { FaRobot, FaUpload } from "react-icons/fa";
import { Button } from "react-bootstrap";
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

    const toggleChatbot = () => {
        setShowChatbot(!showChatbot);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setUser(null);
    };

    useEffect(() => {
        if (showChatbot) {
            const fixHTMLDisplay = () => {
                const botMessages = document.querySelectorAll('.react-chatbot-kit-chat-bot-message');
                
                botMessages.forEach(message => {
                    if (message.innerHTML.includes('&lt;') || message.innerHTML.includes('&gt;')) {
                        const decodedHTML = message.innerHTML
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&amp;/g, '&');
                        
                        message.innerHTML = decodedHTML;
                    }
                });
            };
            
            setTimeout(fixHTMLDisplay, 500);
            
            const observer = new MutationObserver(fixHTMLDisplay);
            const container = document.querySelector('.react-chatbot-kit-chat-message-container');
            
            if (container) {
                observer.observe(container, {
                    childList: true,
                    subtree: true
                });
                
                return () => observer.disconnect();
            }
        }
    }, [showChatbot]);

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

                                        <button 
                                            className="chatbot-toggle-btn" 
                                            onClick={toggleChatbot}
                                            style={{ zIndex: showChatbot ? 10000 : 9998 }}
                                        >
                                            <FaRobot size={24} />
                                        </button>

                                        {showChatbot && (
                                            <div className="chatbot-container">
                                                <SearchPDF />
                                            </div>
                                        )}
                                        
                                        {showUploadModal && (
                                            <UploadPDF 
                                                user={user}  
                                                onUploadSuccess={() => {
                                                    setRefreshFiles((prev) => prev + 1);
                                                    setShowUploadModal(false);
                                                }} 
                                                onClose={() => setShowUploadModal(false)}
                                            />
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
        </Router>
    );
};

export default App;