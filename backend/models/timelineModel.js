const pool = require("../config/db");

exports.getAllTasks = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM timeline_tasks 
            WHERE user_id = $1 
            ORDER BY start_date ASC
        `;
        const result = await client.query(query, [userId]);
        return result.rows;
    } catch (error) {
        throw new Error("Lỗi khi lấy danh sách tasks!");
    } finally {
        client.release();
    }
};

exports.createTask = async (taskData) => {
    try {
        const { user_id, step, status, assignee, start_date, end_date, notes, project_id } = taskData;
        
        // Validate status
        const validStatus = ['pending', 'in-progress', 'completed', 'delayed'];
        const normalizedStatus = status && validStatus.includes(status.toLowerCase()) 
            ? status.toLowerCase() 
            : 'pending';

        const result = await pool.query(
            `INSERT INTO timeline_tasks 
             (user_id, step, status, assignee, start_date, end_date, notes, project_id)
             VALUES ($1, $2, $3::task_status, $4, $5, $6, $7, $8)
             RETURNING *`,
            [user_id, step, normalizedStatus, assignee, start_date, end_date, notes, project_id]
        );
        return result.rows[0];
    } catch (error) {
        console.error("Error in createTask:", error);
        throw new Error("Lỗi khi tạo task mới!");
    }
};

exports.updateBatchTasks = async (tasks, userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const results = [];
        for (const task of tasks) {
            if (!task.project_id) {
                throw new Error('project_id là bắt buộc cho mỗi task');
            }

            // Đảm bảo status luôn có giá trị hợp lệ
            const validStatus = ['pending', 'in-progress', 'completed', 'delayed'];
            const status = task.status && validStatus.includes(task.status.toLowerCase()) 
                ? task.status.toLowerCase() 
                : 'pending';

            if (task.id && !task.id.toString().startsWith('temp_')) {
                const result = await client.query(
                    `UPDATE timeline_tasks 
                     SET step = $1, 
                         status = $2::task_status, 
                         assignee = $3, 
                         start_date = $4, 
                         end_date = $5, 
                         notes = $6,
                         project_id = $7,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $8 AND user_id = $9
                     RETURNING *`,
                    [
                        task.step || '',
                        status,
                        task.assignee || '',
                        task.start_date,
                        task.end_date,
                        task.notes || '',
                        task.project_id,
                        task.id,
                        userId
                    ]
                );
                if (result.rows[0]) {
                    results.push(result.rows[0]);
                }
            } else {
                const result = await client.query(
                    `INSERT INTO timeline_tasks 
                     (user_id, step, status, assignee, start_date, end_date, notes, project_id)
                     VALUES ($1, $2, $3::task_status, $4, $5, $6, $7, $8)
                     RETURNING *`,
                    [
                        userId,
                        task.step || '',
                        status,
                        task.assignee || '',
                        task.start_date,
                        task.end_date,
                        task.notes || '',
                        task.project_id
                    ]
                );
                results.push(result.rows[0]);
            }
        }

        await client.query('COMMIT');
        return results;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Database error:", error);
        throw new Error(`Lỗi khi cập nhật tasks: ${error.message}`);
    } finally {
        client.release();
    }
};

exports.deleteTask = async (taskId, userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const result = await client.query(
            "DELETE FROM timeline_tasks WHERE id = $1 AND user_id = $2 RETURNING *",
            [taskId, userId]
        );

        await client.query('COMMIT');

        if (result.rowCount === 0) {
            throw new Error(`Không tìm thấy task với ID ${taskId}`);
        }

        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Database error when deleting:", error);
        throw new Error(`Lỗi khi xóa task: ${error.message}`);
    } finally {
        client.release();
    }
};

exports.getTasksByAssignee = async (userId, projectId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM timeline_tasks 
            WHERE user_id = $1 AND project_id = $2 
            ORDER BY assignee, start_date ASC
        `;
        const result = await client.query(query, [userId, projectId]);
        return result.rows;
    } catch (error) {
        throw new Error("Lỗi khi lấy danh sách tasks theo người thực hiện!");
    } finally {
        client.release();
    }
};

// Thêm hàm mới để admin có thể xem tất cả tasks
exports.getAllTasksForAdmin = async (projectId = null) => {
    const client = await pool.connect();
    try {
        let query;
        let params = [];
        
        if (projectId) {
            query = `
                SELECT t.*, u.fullname as creator_name, p.name as project_name
                FROM timeline_tasks t
                LEFT JOIN users u ON t.user_id = u.id
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.project_id = $1
                ORDER BY t.start_date ASC
            `;
            params = [projectId];
        } else {
            query = `
                SELECT t.*, u.fullname as creator_name, p.name as project_name
                FROM timeline_tasks t
                LEFT JOIN users u ON t.user_id = u.id
                LEFT JOIN projects p ON t.project_id = p.id
                ORDER BY t.start_date ASC
            `;
        }
        
        const result = await client.query(query, params);
        return result.rows;
    } catch (error) {
        console.error("Lỗi khi lấy tất cả tasks cho admin:", error);
        throw new Error("Lỗi khi lấy danh sách tasks!");
    } finally {
        client.release();
    }
};

// Thêm hàm mới để admin có thể xem tất cả tasks theo người thực hiện
exports.getTasksByAssigneeForAdmin = async (projectId = null) => {
    const client = await pool.connect();
    try {
        let query;
        let params = [];
        
        if (projectId) {
            query = `
                SELECT t.*, u.fullname as creator_name, p.name as project_name
                FROM timeline_tasks t
                LEFT JOIN users u ON t.user_id = u.id
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.project_id = $1
                ORDER BY t.assignee, t.start_date ASC
            `;
            params = [projectId];
        } else {
            query = `
                SELECT t.*, u.fullname as creator_name, p.name as project_name
                FROM timeline_tasks t
                LEFT JOIN users u ON t.user_id = u.id
                LEFT JOIN projects p ON t.project_id = p.id
                ORDER BY t.assignee, t.start_date ASC
            `;
        }
        
        const result = await client.query(query, params);
        return result.rows;
    } catch (error) {
        console.error("Lỗi khi lấy tasks theo người thực hiện cho admin:", error);
        throw new Error("Lỗi khi lấy danh sách tasks theo người thực hiện!");
    } finally {
        client.release();
    }
}; 