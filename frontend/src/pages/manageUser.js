import React, { useState, useEffect } from "react";
import { Table, Button, Container, Form, Modal } from "react-bootstrap";
import { FaEdit, FaTrash, FaKey, FaUserPlus, FaUsersCog } from "react-icons/fa";
import axios from "axios";
import "../css/manageUser.css"; 
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ManageUsers = () => {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState(""); 
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [userForm, setUserForm] = useState({ id: null, username: "", fullname: "", role: "user", password: "" });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/auth/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(response.data);
            setFilteredUsers(response.data);
        } catch (error) {
            console.error("Lỗi khi tải danh sách tài khoản:", error);
        }
    };

    const handleSearch = (e) => {
        const keyword = e.target.value.toLowerCase();
        setSearch(keyword);
        setFilteredUsers(users.filter(user => 
            user.username.toLowerCase().includes(keyword) || 
            user.fullname.toLowerCase().includes(keyword) ||
            user.role.toLowerCase().includes(keyword)
        ));
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản này không?")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/auth/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchUsers();
        } catch (error) {
            console.error("Lỗi khi xóa tài khoản:", error);
        }
    };

    const handleShowModal = (user = null) => {
        setEditMode(!!user);
        setUserForm(user ? { ...user, password: "" } : { id: null, username: "", fullname: "", role: "user", password: "" });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setUserForm({ id: null, username: "", fullname: "", role: "user", password: "" });
    };

    const handleSaveUser = async () => {
        try {
            const token = localStorage.getItem("token");
    
            if (!editMode) {
                userForm.password = "1";  
            }
    
            if (editMode) {
                await axios.put(`${API_BASE_URL}/auth/users/${userForm.id}`, userForm, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } else {
                await axios.post(`${API_BASE_URL}/auth/users`, userForm, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
    
            fetchUsers();
            handleCloseModal();
            alert(editMode ? "Cập nhật tài khoản thành công!" : "Tạo tài khoản thành công! Mật khẩu mặc định: 1");
        } catch (error) {
            console.error("Lỗi khi lưu tài khoản:", error);
        }
    };
    

    const handleResetPassword = async (id) => {
        const newPassword = prompt("Nhập mật khẩu mới cho tài khoản:");
        if (!newPassword) return;
        try {
            const token = localStorage.getItem("token");
            await axios.put(`${API_BASE_URL}/auth/users/${id}/change-password`, { password: newPassword }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            alert("Mật khẩu đã được đặt lại!");
        } catch (error) {
            console.error("Lỗi khi đặt lại mật khẩu:", error);
        }
    };

    return (
        <div className="manage-users-page">
            <Container className="manage-users-container">
                <h2 className="text-center manage-title">
                    <FaUsersCog className="title-icon" /> Quản Lý Tài Khoản
                </h2>

                {/* 🔎 Ô tìm kiếm */}
                <Form className="search-form">
                    <Form.Group className="search-group">
                        <Form.Control 
                            type="text" 
                            placeholder="Tìm kiếm tài khoản..."
                            value={search}
                            onChange={handleSearch}
                            className="search-input"
                        />
                    </Form.Group>
                </Form>

                <Button variant="success" className="add-user-btn" onClick={() => handleShowModal()}>
                    <FaUserPlus /> Thêm Tài Khoản
                </Button>

                <div className="user-table-container">
                    <Table bordered hover responsive className="user-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên Đăng Nhập</th>
                                <th>Họ và Tên</th>
                                <th>Quyền</th>
                                <th>Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td>{user.username}</td>
                                    <td>{user.fullname}</td>
                                    <td>
                                        <span className={`role-badge ${user.role}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>
                                        <Button variant="warning" className="action-btn" onClick={() => handleShowModal(user)}>
                                            <FaEdit /> Sửa
                                        </Button>
                                        <Button variant="info" className="action-btn" onClick={() => handleResetPassword(user.id)}>
                                            <FaKey /> Mật khẩu
                                        </Button>
                                        <Button variant="danger" className="action-btn" onClick={() => handleDelete(user.id)}>
                                            <FaTrash /> Xóa
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Container>

            {/* 🔹 Modal thêm/sửa tài khoản */}
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>{editMode ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Tên đăng nhập</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={userForm.username} 
                                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                                disabled={editMode} 
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Họ và Tên</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={userForm.fullname} 
                                onChange={(e) => setUserForm({ ...userForm, fullname: e.target.value })} 
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Quyền</Form.Label>
                            <Form.Select
                                value={userForm.role || "user"} 
                                onChange={(e) => {
                                    console.log("Role selected:", e.target.value); 
                                    setUserForm({ ...userForm, role: e.target.value });
                                }}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </Form.Select>
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Hủy</Button>
                    <Button variant="primary" onClick={handleSaveUser}>Lưu</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ManageUsers;
