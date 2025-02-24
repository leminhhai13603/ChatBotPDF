import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Form, Button, Alert, Container, Card, InputGroup } from "react-bootstrap";
import { FaUser, FaLock } from "react-icons/fa";
import "../css/login.css";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Login = ({ setIsAuthenticated, setUser }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
            localStorage.setItem("token", response.data.token);
            setUser(response.data.user);
            setIsAuthenticated(true);

            navigate("/");
        } catch (err) {
            setError(err.response?.data?.error || "Sai tên đăng nhập hoặc mật khẩu.");
        }
    };

    return (
        <div className="login-page">
            <Container className="d-flex justify-content-center align-items-center min-vh-100">
                <Card className="login-card p-4 shadow-lg border-0">
                    <Card.Body>
                        <h2 className="text-center login-title">
                            <span role="img" aria-label="lock">🔐</span> Đăng Nhập
                        </h2>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-semibold">Tên đăng nhập</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text><FaUser /></InputGroup.Text>
                                    <Form.Control
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        className="rounded-end"
                                    />
                                </InputGroup>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-semibold">Mật khẩu</Form.Label>
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
                            <Button
                                variant="primary"
                                type="submit"
                                className="w-100 fw-semibold py-2 shadow-sm login-btn"
                            >
                                Đăng Nhập
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
};

export default Login;
