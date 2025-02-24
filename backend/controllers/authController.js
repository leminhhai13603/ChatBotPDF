const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

// ✅ Đăng nhập
exports.login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Vui lòng nhập đủ username và mật khẩu!" });
    }

    try {
        const user = await userModel.getUserByUsername(username);
        if (!user) return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu!" });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token, user: { id: user.id, username: user.username, fullname: user.fullname, role: user.role } });
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ Lấy thông tin cá nhân
exports.getUserInfo = async (req, res) => {
    try {
        const user = await userModel.getUserById(req.user.id);
        if (!user) return res.status(404).json({ error: "Người dùng không tồn tại" });

        res.json({ id: user.id, username: user.username, fullname: user.fullname, role: user.role });
    } catch (error) {
        console.error("Lỗi lấy thông tin user:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ Cập nhật họ và tên
exports.updateProfile = async (req, res) => {
    const { fullname } = req.body;
    if (!fullname) return res.status(400).json({ error: "Tên không được để trống!" });

    try {
        await userModel.updateFullname(req.user.id, fullname);
        res.json({ message: "Cập nhật thông tin thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật thông tin:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ Đổi mật khẩu
exports.changePassword = async (req, res) => {
    const { password } = req.body;
    try {
        await userModel.updatePassword(req.user.id, password);
        res.json({ message: "Mật khẩu đã được cập nhật!" });
    } catch (error) {
        console.error("Lỗi đổi mật khẩu:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ --- Quản lý tài khoản (Chỉ Admin) ---
exports.getAllUsers = async (req, res) => {
    try {
        const users = await userModel.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error("Lỗi lấy danh sách tài khoản:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ Tạo tài khoản mới (Chỉ Admin)
exports.createUser = async (req, res) => {
    const { username, fullname, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: "Thiếu thông tin tài khoản!" });
    }

    try {
        await userModel.createUser(username, password, fullname, role);
        res.json({ message: "Tạo tài khoản thành công!" });
    } catch (error) {
        console.error("Lỗi tạo tài khoản:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ Cập nhật thông tin tài khoản (Chỉ Admin)
exports.updateUser = async (req, res) => {
    const { fullname, role } = req.body;
    const userId = req.params.id;

    try {
        await userModel.updateUser(userId, fullname, role);
        res.json({ message: "Cập nhật tài khoản thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật tài khoản:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ Đổi mật khẩu tài khoản khác (Chỉ Admin)
exports.changeUserPassword = async (req, res) => {
    const { password } = req.body;
    const userId = req.params.id;

    try {
        await userModel.updatePassword(userId, password);
        res.json({ message: "Mật khẩu đã được cập nhật!" });
    } catch (error) {
        console.error("Lỗi đổi mật khẩu người khác:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// ✅ Xóa tài khoản (Chỉ Admin)
exports.deleteUser = async (req, res) => {
    const userId = req.params.id;

    try {
        await userModel.deleteUser(userId);
        res.json({ message: "Xóa tài khoản thành công!" });
    } catch (error) {
        console.error("Lỗi xóa tài khoản:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};
