const pool = require("../config/db");

// Lưu lịch sử hội thoại
exports.saveChatHistory = async (userId, query, response, source) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO chat_history (user_id, query, response, source, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id;
        `;
        
        const result = await client.query(insertQuery, [userId, query, response, source]);
        return result.rows[0].id;
    } catch (error) {
        console.error("❌ Lỗi khi lưu lịch sử hội thoại:", error);
        throw error;
    } finally {
        client.release();
    }
};

// Lấy lịch sử hội thoại của user
exports.getChatHistory = async (userId, limit = 10) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, query, response, source, created_at
            FROM chat_history
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2;
        `;
        
        const result = await client.query(query, [userId, limit]);
        return result.rows;
    } catch (error) {
        console.error("❌ Lỗi khi lấy lịch sử hội thoại:", error);
        throw error;
    } finally {
        client.release();
    }
};

// Xóa lịch sử hội thoại của user
exports.clearChatHistory = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            DELETE FROM chat_history
            WHERE user_id = $1;
        `;
        
        await client.query(query, [userId]);
        return true;
    } catch (error) {
        console.error("❌ Lỗi khi xóa lịch sử hội thoại:", error);
        throw error;
    } finally {
        client.release();
    }
}; 