import React, { useEffect, useState } from "react";
import { Navbar, Container, Dropdown, Button } from "react-bootstrap";
import { FaUser, FaSignOutAlt, FaCog, FaLock, FaUsersCog, FaHome, FaFolder, FaBook } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaUserCog, FaList, FaBlog } from "react-icons/fa";
import { TableOutlined } from '@ant-design/icons';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Header = ({ onLogout }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    // const location = useLocation();

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;
    
                const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUser(response.data);
            } catch (error) {
                console.error("Lỗi khi lấy thông tin user:", error);
            }
        };
    
        fetchUserInfo();
    }, []);    

    return (
        <Navbar expand="lg" fixed="top" className="header-navbar">
            <Container className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                    {(
                        <Button 
                            variant="light" 
                            className="me-3 home-button" 
                            onClick={() => navigate("/")}
                            title="Về trang chủ"
                        >
                            <FaHome /> <span className="ms-1">Trang chủ</span>
                        </Button>
                    )}
                    <Button 
                        variant="light" 
                        className="me-3" 
                        onClick={() => navigate("/blog")}
                        title="Xem tài liệu"
                    >
                        <FaBook /> <span className="ms-1">Không gian chung</span>
                    </Button>
                    <Button 
                        variant="light" 
                        className="me-3" 
                        onClick={() => navigate("/sheets")}
                        title="Google Sheets"
                    >
                        <TableOutlined /> <span className="ms-1">Google Sheets</span>
                    </Button>
                    <div className="header-title">Hệ Thống Quản Lý PDF</div>
                </div>

                <Dropdown className="header-user">
                    <Dropdown.Toggle variant="light" id="user-dropdown">
                        <FaUser /> {user ? user.fullname : "Người dùng"}
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item onClick={() => navigate("/profile")}>
                            <FaUserCog /> Đổi thông tin cá nhân
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => navigate("/change-password")}>
                            <FaLock /> Đổi mật khẩu
                        </Dropdown.Item>
                        {user?.roles?.includes("admin") && (
                            <>
                                <Dropdown.Item onClick={() => navigate("/manage-users")}>
                                    <FaUsersCog /> Quản lý tài khoản
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => navigate("/manage-categories")}>
                                    <FaFolder /> Quản lý danh mục
                                </Dropdown.Item>
                            </>
                        )}
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={onLogout} className="text-danger">
                            <FaSignOutAlt /> Đăng Xuất
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </Container>
        </Navbar>
    );
};

export default Header;
