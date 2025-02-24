import { useState, useEffect } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";
import axios from "axios";
import "../css/profile.css";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 

const Profile = () => {
    const [fullname, setFullname] = useState("");
    const [message, setMessage] = useState(null);
    

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFullname(response.data.fullname);
            } catch (error) {
                console.error("Lỗi khi lấy thông tin user:", error);
            }
        };

        fetchUserInfo();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            await axios.put(`${API_BASE_URL}/auth/update-profile`, { fullname }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage("Cập nhật thông tin thành công!");
        } catch (error) {
            setMessage("Lỗi khi cập nhật thông tin.");
        }
    };

    return (
        <div className="profile-page">
            <Container className="d-flex justify-content-center align-items-center min-vh-100">
                <div className="profile-card">
                    <h2 className="profile-title">⚡ Đổi Thông Tin Cá Nhân</h2>
                    {message && <Alert className="profile-alert" variant="success">{message}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Họ và tên</Form.Label>
                            <Form.Control
                                type="text"
                                value={fullname}
                                onChange={(e) => setFullname(e.target.value)}
                                required
                            />
                        </Form.Group>
                        <Button type="submit" className="profile-btn">
                            Lưu Thay Đổi
                        </Button>
                    </Form>
                </div>
            </Container>
        </div>
    );
};

export default Profile;
