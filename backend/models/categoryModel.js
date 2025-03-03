const pool = require("../config/db");

exports.getAllCategories = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                r.id,
                r.name,
                COUNT(pf.id) as file_count
            FROM roles r
            LEFT JOIN pdf_files pf ON r.id = pf.group_id
            GROUP BY r.id, r.name
            ORDER BY r.id ASC
        `);
        return result.rows;
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.createCategory = async (name) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO roles (name) VALUES ($1) RETURNING id',
            [name]
        );
        return result.rows[0].id;
    } catch (error) {
        console.error("❌ Lỗi khi tạo danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.updateCategory = async (id, name) => {
    const client = await pool.connect();
    try {
        await client.query(
            'UPDATE roles SET name = $1 WHERE id = $2',
            [name, id]
        );
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.deleteCategory = async (id) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM roles WHERE id = $1', [id]);
    } catch (error) {
        console.error("❌ Lỗi khi xóa danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.checkCategoryHasFiles = async (id) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT EXISTS(SELECT 1 FROM pdf_files WHERE group_id = $1)',
            [id]
        );
        return result.rows[0].exists;
    } catch (error) {
        console.error("❌ Lỗi khi kiểm tra danh mục có file:", error);
        throw error;
    } finally {
        client.release();
    }
}; 