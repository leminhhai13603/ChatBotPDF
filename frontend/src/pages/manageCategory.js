import React, { useState, useEffect } from "react";
import { Table, Button, Container, Form, Modal } from "react-bootstrap";
import { FaEdit, FaTrash, FaFolderPlus, FaFolder } from "react-icons/fa";
import axios from "axios";
import "../css/manageCategory.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ManageCategories = () => {
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState("");
    const [filteredCategories, setFilteredCategories] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ id: null, name: "", description: "" });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/categories`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCategories(response.data);
            setFilteredCategories(response.data);
        } catch (error) {
            console.error("Lỗi khi tải danh sách danh mục:", error);
        }
    };

    const handleSearch = (e) => {
        const keyword = e.target.value.toLowerCase();
        setSearch(keyword);
        setFilteredCategories(categories.filter(category =>
            category.name.toLowerCase().includes(keyword) ||
            category.description.toLowerCase().includes(keyword)
        ));
    };

    const handleConfirmDelete = (id) => {
        setCategoryToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/categories/${categoryToDelete}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchCategories();
            setShowDeleteModal(false);
        } catch (error) {
            if (error.response?.status === 400) {
                alert("Không thể xóa danh mục đang chứa tài liệu!");
            } else {
                console.error("Lỗi khi xóa danh mục:", error);
            }
            setShowDeleteModal(false);
        }
    };

    const handleShowModal = (category = null) => {
        setEditMode(!!category);
        setCategoryForm(
            category
                ? { ...category }
                : { id: null, name: "", description: "" }
        );
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCategoryForm({ id: null, name: "", description: "" });
    };

    const handleSaveCategory = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!editMode) {
                await axios.post(`${API_BASE_URL}/categories`, categoryForm, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } else {
                await axios.put(`${API_BASE_URL}/categories/${categoryForm.id}`, categoryForm, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
            fetchCategories();
            handleCloseModal();
            alert(editMode ? "Cập nhật danh mục thành công!" : "Tạo danh mục thành công!");
        } catch (error) {
            console.error("Lỗi khi lưu danh mục:", error);
        }
    };

    return (
        <div className="manage-categories-page">
            <Container className="manage-categories-container">
                <h2 className="text-center manage-title">
                    <FaFolder className="title-icon" /> Quản Lý Danh Mục
                </h2>

                <Form className="search-form">
                    <Form.Group className="search-group">
                        <Form.Control
                            type="text"
                            placeholder="Tìm kiếm danh mục..."
                            value={search}
                            onChange={handleSearch}
                            className="search-input"
                        />
                    </Form.Group>
                </Form>

                <Button variant="success" className="add-category-btn" onClick={() => handleShowModal()}>
                    <FaFolderPlus /> Thêm Danh Mục
                </Button>

                <div className="category-table-container">
                    <Table bordered hover responsive className="category-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên Danh Mục</th>
                                <th>Số Lượng Tài Liệu</th>
                                <th>Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCategories.map((category) => (
                                <tr key={category.id}>
                                    <td>{category.id}</td>
                                    <td>{category.name}</td>
                                    <td>{category.file_count || 0}</td>
                                    <td>
                                        <Button variant="warning" className="action-btn me-2" onClick={() => handleShowModal(category)}>
                                            <FaEdit /> Sửa
                                        </Button>
                                        <Button variant="danger" className="action-btn" onClick={() => handleConfirmDelete(category.id)}>
                                            <FaTrash /> Xóa
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Container>

            {/* Modal Thêm/Sửa Danh Mục */}
            <Modal 
                show={showModal} 
                onHide={handleCloseModal}
                centered
                backdrop="static"
                className="category-modal"
            >
                <Modal.Header closeButton>
                    <Modal.Title>{editMode ? "Chỉnh sửa danh mục" : "Thêm danh mục"}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Tên danh mục</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Nhập tên danh mục"
                                value={categoryForm.name}
                                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Mô tả</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Nhập mô tả"
                                value={categoryForm.description}
                                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Hủy</Button>
                    <Button variant="primary" onClick={handleSaveCategory}>Lưu</Button>
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
                    <p>Bạn có chắc chắn muốn xóa danh mục này không?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Hủy</Button>
                    <Button variant="danger" onClick={handleDelete}>Xóa</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ManageCategories; 