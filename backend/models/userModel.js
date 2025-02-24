const pool = require("../config/db");
const bcrypt = require("bcryptjs");

// ✅ Tìm người dùng theo username
exports.getUserByUsername = async (username) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error("Lỗi khi tìm người dùng theo username!");
    }
};

// ✅ Tìm người dùng theo ID
exports.getUserById = async (userId) => {
    try {
        const result = await pool.query("SELECT id, username, fullname, role, password FROM users WHERE id = $1", [userId]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error("Lỗi khi tìm người dùng theo ID!");
    }
};

// ✅ Lưu người dùng mới vào DB
exports.createUser = async (username, password, fullname, role = "user") => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO users (username, password, fullname, role) VALUES ($1, $2, $3, $4)",
            [username, hashedPassword, fullname, role]
        );
    } catch (error) {
        throw new Error("Lỗi khi tạo người dùng mới!");
    }
};
// ✅ Cập nhật thông tin tài khoản (không thay đổi mật khẩu)
exports.updateUser = async (id, fullname, role) => {
    console.log("🔄 Updating user:", { id, fullname, role });

    await pool.query(
        "UPDATE users SET fullname = $1, role = $2 WHERE id = $3",
        [fullname, role, id]
    );
};


// ✅ Cập nhật họ và tên
exports.updateFullname = async (userId, fullname) => {
    try {
        await pool.query("UPDATE users SET fullname = $1 WHERE id = $2", [fullname, userId]);
    } catch (error) {
        throw new Error("Lỗi khi cập nhật họ và tên!");
    }
};

// ✅ Cập nhật mật khẩu (băm trước khi lưu)
exports.updatePassword = async (userId, newPassword) => {
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, userId]);
    } catch (error) {
        throw new Error("Lỗi khi cập nhật mật khẩu!");
    }
};

// ✅ Lấy danh sách tất cả người dùng
exports.getAllUsers = async () => {
    try {
        const result = await pool.query("SELECT id, username, fullname, role FROM users ORDER BY id ASC");
        return result.rows;
    } catch (error) {
        throw new Error("Lỗi khi lấy danh sách người dùng!");
    }
};

// ✅ Cập nhật quyền của người dùng (chỉ dành cho Admin)
exports.updateUserRole = async (userId, role) => {
    try {
        await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);
    } catch (error) {
        throw new Error("Lỗi khi cập nhật quyền người dùng!");
    }
};

// ✅ Xóa người dùng
exports.deleteUser = async (userId) => {
    try {
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    } catch (error) {
        throw new Error("Lỗi khi xóa người dùng!");
    }
};
