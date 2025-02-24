import { useState } from "react";
import { Container, Form, Button, Alert, InputGroup } from "react-bootstrap";
import axios from "axios";
import { FaLock } from "react-icons/fa";
import "../css/changePassword.css"; 
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ChangePassword = () => {
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                setError("❌ Bạn chưa đăng nhập!");
                return;
            }

            await axios.put(
                `${API_BASE_URL}/auth/change-password`,
                { password }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMessage("✅ Mật khẩu đã được cập nhật!");
            setPassword("");
        } catch (err) {
            if (err.response) {
                if (err.response.status === 400) {
                    setError("❌ Lỗi mật khẩu, vui lòng thử lại!");
                } else if (err.response.status === 403) {
                    setError("❌ Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!");
                    localStorage.removeItem("token");
                } else {
                    setError("❌ Lỗi máy chủ, thử lại sau.");
                }
            } else {
                setError("❌ Không thể kết nối đến máy chủ!");
            }
        }
    };

    return (
        <div className="change-password-page">
            <Container className="d-flex justify-content-center align-items-center min-vh-100">
                <div className="change-password-card">
                    <h2 className="change-password-title">🔒 Đổi Mật Khẩu</h2>
                    
                    {error && <Alert className="change-password-alert" variant="danger">{error}</Alert>}
                    {message && <Alert className="change-password-alert" variant="success">{message}</Alert>}

                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Mật khẩu mới</Form.Label>
                            <InputGroup>
                                <InputGroup.Text><FaLock /></InputGroup.Text>
                                <Form.Control
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="rounded-end"
                                />
                            </InputGroup>
                        </Form.Group>
                        <Button type="submit" className="change-password-btn">
                            Đổi Mật Khẩu
                        </Button>
                    </Form>
                </div>
            </Container>
        </div>
    );
};

export default ChangePassword;
