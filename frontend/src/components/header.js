import React, { useEffect, useState } from "react";
import { Navbar, Container, Dropdown } from "react-bootstrap";
import { FaUser, FaSignOutAlt, FaCog, FaLock, FaUsersCog } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Header = ({ onLogout }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;
    
                const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
    
                console.log("User Info:", response.data); 
    
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
                {/* Tiêu đề ở giữa */}
                <div className="header-title">Hệ Thống Quản Lý PDF</div>

                {/* Cục người dùng ở tận cùng bên phải */}
                <Dropdown className="header-user">
                    <Dropdown.Toggle variant="light" id="user-dropdown">
                        <FaUser /> {user ? user.fullname : "Người dùng"}
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item onClick={() => navigate("/profile")}>
                            <FaCog /> Đổi thông tin cá nhân
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => navigate("/change-password")}>
                            <FaLock /> Đổi mật khẩu
                        </Dropdown.Item>
                        {user?.role === "admin" && (
                            <Dropdown.Item onClick={() => navigate("/manage-users")}>
                                <FaUsersCog /> Quản lý tài khoản
                            </Dropdown.Item>
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
