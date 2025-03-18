const pool = require("../config/db");

// Tạo dự án mới
exports.createProject = async (name, userId) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            "INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id",
            [name, userId]
        );
        return result.rows[0].id;
    } catch (error) {
        console.error("❌ Lỗi khi tạo dự án:", error);
        throw error;
    } finally {
        client.release();
    }
};

// Lấy tất cả dự án của user
exports.getProjectsByUserId = async (userId) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            "SELECT * FROM projects WHERE user_id = $1",
            [userId]
        );
        return result.rows;
    } catch (error) {
        console.error("❌ Lỗi khi lấy dự án:", error);
        throw error;
    } finally {
        client.release();
    }
};

// Xóa dự án
exports.deleteProject = async (projectId) => {
    const client = await pool.connect();
    try {
        await client.query("DELETE FROM projects WHERE id = $1", [projectId]);
    } catch (error) {
        console.error("❌ Lỗi khi xóa dự án:", error);
        throw error;
    } finally {
        client.release();
    }
}; 