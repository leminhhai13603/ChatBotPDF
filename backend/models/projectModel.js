const pool = require("../config/db");

// Tạo dự án mới - thêm tham số category
exports.createProject = async (name, userId, category) => {
    const client = await pool.connect();
    try {
        // Kiểm tra xem bảng projects đã có cột category chưa
        const tableInfo = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'category'
        `);
        
        let query;
        let params;
        
        if (tableInfo.rows.length > 0) {
            // Nếu đã có cột category
            query = "INSERT INTO projects (name, user_id, category) VALUES ($1, $2, $3) RETURNING id";
            params = [name, userId, category || 'new'];
        } else {
            // Nếu chưa có cột category
            query = "INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id";
            params = [name, userId];
        }
        
        const result = await client.query(query, params);
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
        // Kiểm tra xem bảng projects đã có cột category chưa
        const tableInfo = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'category'
        `);
        
        let result;
        
        if (tableInfo.rows.length > 0) {
            // Nếu đã có cột category
            result = await client.query(
                "SELECT id, name, user_id, created_at, category FROM projects WHERE user_id = $1",
                [userId]
            );
        } else {
            // Nếu chưa có cột category, tạo cột này
            try {
                await client.query("ALTER TABLE projects ADD COLUMN category VARCHAR(20) DEFAULT 'new'");
                console.log("✅ Đã thêm cột category vào bảng projects");
            } catch (alterError) {
                console.error("❌ Lỗi khi thêm cột category:", alterError);
            }
            
            // Sau đó lấy dữ liệu như bình thường
            result = await client.query(
                "SELECT id, name, user_id, created_at, category FROM projects WHERE user_id = $1",
                [userId]
            );
        }
        
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

// Thêm hàm mới để admin xem tất cả dự án
exports.getAllProjects = async () => {
    const client = await pool.connect();
    try {
        // Kiểm tra xem bảng projects đã có cột category chưa
        const tableInfo = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'category'
        `);
        
        let query;
        
        if (tableInfo.rows.length > 0) {
            // Nếu đã có cột category
            query = `
                SELECT p.id, p.name, p.user_id, p.created_at, p.category, 
                    u.fullname as creator_name,
                    (SELECT COUNT(*) FROM timeline_tasks t WHERE t.project_id = p.id) as task_count
                FROM projects p
                LEFT JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
            `;
        } else {
            // Nếu chưa có cột category, tạo cột này
            try {
                await client.query("ALTER TABLE projects ADD COLUMN category VARCHAR(20) DEFAULT 'new'");
                console.log("✅ Đã thêm cột category vào bảng projects");
            } catch (alterError) {
                console.error("❌ Lỗi khi thêm cột category:", alterError);
            }
            
            // Sau đó lấy dữ liệu với cột category
            query = `
                SELECT p.id, p.name, p.user_id, p.created_at, p.category, 
                    u.fullname as creator_name,
                    (SELECT COUNT(*) FROM timeline_tasks t WHERE t.project_id = p.id) as task_count
                FROM projects p
                LEFT JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
            `;
        }
        
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error("❌ Lỗi khi lấy tất cả dự án:", error);
        throw error;
    } finally {
        client.release();
    }
};

// Thêm hàm cập nhật thông tin dự án
exports.updateProject = async (projectId, name, category) => {
    const client = await pool.connect();
    try {
        // Kiểm tra xem bảng projects đã có cột category chưa
        const tableInfo = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'category'
        `);
        
        let query;
        let params;
        
        if (tableInfo.rows.length > 0) {
            // Nếu đã có cột category
            query = "UPDATE projects SET name = $1, category = $2 WHERE id = $3 RETURNING *";
            params = [name, category || 'new', projectId];
        } else {
            // Nếu chưa có cột category, tạo cột này
            try {
                await client.query("ALTER TABLE projects ADD COLUMN category VARCHAR(20) DEFAULT 'new'");
                console.log("✅ Đã thêm cột category vào bảng projects");
                
                // Sau khi tạo cột, thực hiện update với category
                query = "UPDATE projects SET name = $1, category = $2 WHERE id = $3 RETURNING *";
                params = [name, category || 'new', projectId];
            } catch (alterError) {
                console.error("❌ Lỗi khi thêm cột category:", alterError);
                
                // Nếu không thêm được cột, chỉ update name
                query = "UPDATE projects SET name = $1 WHERE id = $2 RETURNING *";
                params = [name, projectId];
            }
        }
        
        const result = await client.query(query, params);
        return result.rows[0];
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật dự án:", error);
        throw error;
    } finally {
        client.release();
    }
}; 