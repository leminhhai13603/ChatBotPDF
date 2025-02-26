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
exports.getUserRoles = async (userId) => {
    try {
        const result = await pool.query(
            `SELECT r.name FROM user_roles ur 
             JOIN roles r ON ur.role_id = r.id 
             WHERE ur.user_id = $1`,
            [userId]
        );
        return result.rows.map(row => row.name);
    } catch (error) {
        throw new Error("Lỗi khi lấy danh sách quyền của người dùng!");
    }
};
exports.getAllRoles = async () => {
    try {
        const result = await pool.query("SELECT * FROM roles ORDER BY id ASC");
        return result.rows;
    } catch (error) {
        throw new Error("Lỗi khi lấy danh sách roles!");
    }
};
exports.getUserById = async (userId) => {
    try {
        const result = await pool.query(
            `SELECT 
                users.id, 
                users.username, 
                users.fullname, 
                ARRAY_REMOVE(ARRAY_AGG(roles.name), NULL) AS roles
            FROM users
            LEFT JOIN user_roles ON users.id = user_roles.user_id
            LEFT JOIN roles ON user_roles.role_id = roles.id
            WHERE users.id = $1
            GROUP BY users.id;`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        throw new Error("❌ Lỗi khi tìm người dùng theo ID!");
    }
};


// ✅ Tạo tài khoản mới (role mặc định là "user")
exports.createUser = async (username, password, fullname, roles) => {
    try {
        // Băm mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);
        // Tạo user và lấy id mới tạo
        const newUser = await pool.query(
            "INSERT INTO users (username, password, fullname) VALUES ($1, $2, $3) RETURNING id",
            [username, hashedPassword, fullname]
        );
        const userId = newUser.rows[0].id;

        for (let roleId of roles) {
            await pool.query(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
                [userId, roleId]
            );
        }
        return userId;
    } catch (error) {
        throw new Error("Lỗi khi tạo người dùng mới: " + error.message);
    }
};

// ✅ Cập nhật thông tin tài khoản (không thay đổi quyền)
exports.updateUser = async (id, fullname) => {
    console.log("🔄 Updating user:", { id, fullname });

    await pool.query(
        "UPDATE users SET fullname = $1 WHERE id = $2",
        [fullname, id]
    );
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

// ✅ Lấy danh sách tất cả người dùng và quyền của họ
exports.getAllUsers = async () => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.fullname, 
                    ARRAY_REMOVE(ARRAY_AGG(r.name), NULL) AS roles
             FROM users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             GROUP BY u.id
             ORDER BY u.id ASC`
        );
        return result.rows;
    } catch (error) {
        throw new Error("Lỗi khi lấy danh sách người dùng!");
    }
};

// ✅ Cập nhật quyền của người dùng
exports.updateUserRoles = async (userId, roleIds) => {
    try {
        await pool.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);

        for (const roleId of roleIds) {
            await pool.query(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
                [userId, roleId]
            );
        }
    } catch (error) {
        throw new Error("Lỗi khi cập nhật quyền người dùng: " + error.message);
    }
};


// ✅ Xóa người dùng (xóa luôn quyền trong user_roles)
exports.deleteUser = async (userId) => {
    try {
        await pool.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    } catch (error) {
        throw new Error("Lỗi khi xóa người dùng!");
    }
};

exports.getUserRolesWithId = async (userId) => {
    const client = await pool.connect();
    try {
        // Lấy roles của user hiện tại
        const userRolesQuery = `
            SELECT r.name 
            FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = $1
        `;
        const userRoles = await client.query(userRolesQuery, [userId]);
        
        // Kiểm tra nếu là admin
        const isAdmin = userRoles.rows.some(role => role.name.toLowerCase() === 'admin');

        let query;
        if (isAdmin) {
            // Admin thấy tất cả roles
            query = `
                SELECT id as role_id, name 
                FROM roles 
                ORDER BY id
            `;
            const result = await client.query(query);
            return result.rows;
        } else {
            // User thường chỉ thấy roles được phân quyền
            query = `
                SELECT r.id as role_id, r.name 
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1
                ORDER BY r.id
            `;
            const result = await client.query(query, [userId]);
            return result.rows;
        }
    } catch (error) {
        console.error("❌ Lỗi khi lấy roles:", error);
        throw error;
    } finally {
        client.release();
    }
};
