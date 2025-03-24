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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [userToChangePassword, setUserToChangePassword] = useState(null);
    const [newPassword, setNewPassword] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [roles, setRoles] = useState([]); 
    const [userForm, setUserForm] = useState({ id: null, username: "", fullname: "", roles: [] });

    useEffect(() => {
        fetchUsers();
        fetchRoles();
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

    const fetchRoles = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/auth/roles`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("Roles API response:", response.data);
            if (response.data && response.data.roles) {
                setRoles(response.data.roles);
            } else {
                console.error("Dữ liệu roles không đúng định dạng:", response.data);
                setRoles([]);
            }
        } catch (error) {
            console.error("Lỗi khi tải danh sách roles:", error);
        }
    };
    
    const getRoleNames = (userRoles) => {
        if (!Array.isArray(userRoles) || userRoles.length === 0) return "";
        if (typeof userRoles[0] === "object") {
            return userRoles.map(r => r.name).join(", ");
        }
        if (typeof userRoles[0] === "string") {
            return userRoles.join(", ");
        }
        if (typeof userRoles[0] === "number") {
            return roles
                .filter(role => userRoles.includes(role.id))
                .map(role => role.name)
                .join(", ");
        }
        return "";
    };

    const handleSearch = (e) => {
        const keyword = e.target.value.toLowerCase();
        setSearch(keyword);
        setFilteredUsers(users.filter(user => 
            user.username.toLowerCase().includes(keyword) || 
            user.fullname.toLowerCase().includes(keyword) ||
            getRoleNames(user.roles).toLowerCase().includes(keyword)
        ));
    };

    const handleConfirmDelete = (id) => {
        setUserToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/auth/users/${userToDelete}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchUsers();
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Lỗi khi xóa tài khoản:", error);
            setShowDeleteModal(false);
        }
    };
    
    const handleShowModal = (user = null) => {
        setEditMode(!!user);
        let rolesArray = [];
        if (user) {
            rolesArray = user.roles.map(r => {
                if (typeof r === "object") {
                    return r.id;
                } else if (typeof r === "string") {
                    const foundRole = roles.find(role => role.name === r);
                    return foundRole ? foundRole.id : r;
                } else if (typeof r === "number") {
                    return r;
                }
                return r;
            });
        }
        setUserForm(
            user 
            ? { ...user, roles: rolesArray } 
            : { id: null, username: "", fullname: "", roles: [] }
        );
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setUserForm({ id: null, username: "", fullname: "", roles: [] });
    };

    const handleSaveUser = async () => {
        try {
            const token = localStorage.getItem("token");
            let payload;
    
            if (!editMode) {
                payload = { ...userForm, password: "1" };
                delete payload.id;
            } else {
                payload = { ...userForm };
            }
            
            console.log("Payload gửi lên server:", payload);
            
            if (!editMode) {
                await axios.post(`${API_BASE_URL}/auth/users`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } else {
                await axios.put(`${API_BASE_URL}/auth/users/${userForm.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
        
            fetchUsers();
            handleCloseModal();
            alert(editMode ? "Cập nhật tài khoản thành công!" : "Tạo tài khoản thành công! Mật khẩu mặc định: 1");
        } catch (error) {
            console.error("Lỗi khi lưu tài khoản:", error.response ? error.response.data : error);
        }
    };    
    
    const handleShowPasswordModal = (id) => {
        setUserToChangePassword(id);
        setNewPassword("");
        setShowPasswordModal(true);
    };

    const handleResetPassword = async () => {
        if (!newPassword) {
            alert("Vui lòng nhập mật khẩu mới!");
            return;
        }
        
        try {
            const token = localStorage.getItem("token");
            await axios.put(`${API_BASE_URL}/auth/users/${userToChangePassword}/change-password`, 
                { password: newPassword }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowPasswordModal(false);
            alert("Mật khẩu đã được đặt lại thành công!");
        } catch (error) {
            console.error("Lỗi khi đặt lại mật khẩu:", error);
            setShowPasswordModal(false);
            alert("Lỗi khi đặt lại mật khẩu!");
        }
    };

    return (
        <div className="manage-users-page">
            <Container className="manage-users-container">
                <h2 className="text-center manage-title">
                    <FaUsersCog className="title-icon" /> Quản Lý Tài Khoản
                </h2>

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
                                    <td>{ getRoleNames(user.roles) || "Chưa có quyền" }</td>
                                    <td>
                                        <Button variant="warning" className="action-btn me-2" onClick={() => handleShowModal(user)}>
                                            <FaEdit /> Sửa
                                        </Button>
                                        <Button variant="info" className="action-btn me-2" onClick={() => handleShowPasswordModal(user.id)}>
                                            <FaKey /> Mật khẩu
                                        </Button>
                                        <Button variant="danger" className="action-btn" onClick={() => handleConfirmDelete(user.id)}>
                                            <FaTrash /> Xóa
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Container>

            {/* Modal Thêm/Sửa Tài Khoản */}
            <Modal 
                show={showModal} 
                onHide={handleCloseModal}
                centered
                className="user-modal"
                backdrop="static"
                size="sm"
            >
                <Modal.Header closeButton>
                    <Modal.Title>{editMode ? "Sửa tài khoản" : "Thêm tài khoản"}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-2">
                            <Form.Label>Tên đăng nhập</Form.Label>
                            <Form.Control 
                                type="text" 
                                placeholder="Nhập tên đăng nhập" 
                                value={userForm.username} 
                                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Họ và tên</Form.Label>
                            <Form.Control 
                                type="text" 
                                placeholder="Nhập họ và tên" 
                                value={userForm.fullname} 
                                onChange={(e) => setUserForm({ ...userForm, fullname: e.target.value })}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Quyền</Form.Label>
                            <div className="role-checkboxes">
                                {roles.length > 0 ? (
                                    roles.map((role) => (
                                        <div className="role-checkbox" key={role.id}>
                                            <input
                                                type="checkbox"
                                                id={`role-${role.id}`}
                                                value={role.id}
                                                checked={userForm.roles.includes(role.id)}
                                                onChange={(e) => {
                                                    const roleId = Number(e.target.value);
                                                    let updatedRoles = [];
                                                    if (e.target.checked) {
                                                        updatedRoles = [...userForm.roles, roleId];
                                                    } else {
                                                        updatedRoles = userForm.roles.filter((item) => item !== roleId);
                                                    }
                                                    setUserForm({ ...userForm, roles: updatedRoles });
                                                }}
                                            />
                                            <label htmlFor={`role-${role.id}`}>{role.name}</label>
                                        </div>
                                    ))
                                ) : (
                                    <p>Đang tải danh sách quyền...</p>
                                )}
                            </div>
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Hủy</Button>
                    <Button variant="primary" onClick={handleSaveUser}>Lưu</Button>
                </Modal.Footer>
            </Modal>

            {/* Modal Xác Nhận Xóa */}
            <Modal 
                show={showDeleteModal} 
                onHide={() => setShowDeleteModal(false)}
                centered
                backdrop="static"
                className="delete-modal"
            >
                <Modal.Header closeButton>
                    <Modal.Title>Xác nhận xóa</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Bạn có chắc chắn muốn xóa tài khoản này không?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Hủy</Button>
                    <Button variant="danger" onClick={handleDelete}>Xóa</Button>
                </Modal.Footer>
            </Modal>

            {/* Modal Đổi Mật Khẩu */}
            <Modal 
                show={showPasswordModal} 
                onHide={() => setShowPasswordModal(false)}
                centered
                backdrop="static"
                className="password-modal"
            >
                <Modal.Header closeButton>
                    <Modal.Title>Đặt lại mật khẩu</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Mật khẩu mới</Form.Label>
                            <Form.Control 
                                type="password" 
                                placeholder="Nhập mật khẩu mới" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>Hủy</Button>
                    <Button variant="primary" onClick={handleResetPassword}>Lưu mật khẩu</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ManageUsers;
