const pool = require("../config/db");

exports.getAllTasks = async (userId) => {
    try {
        const result = await pool.query(
            "SELECT * FROM timeline_tasks WHERE user_id = $1 ORDER BY start_date ASC",
            [userId]
        );
        return result.rows;
    } catch (error) {
        throw new Error("Lỗi khi lấy danh sách tasks!");
    }
};

exports.createTask = async (taskData) => {
    try {
        const { user_id, step, status, assignee, start_date, end_date, notes } = taskData;
        const result = await pool.query(
            `INSERT INTO timeline_tasks 
             (user_id, step, status, assignee, start_date, end_date, notes)
             VALUES ($1, $2, $3::task_status, $4, $5, $6, $7)
             RETURNING *`,
            [user_id, step, status, assignee, start_date, end_date, notes]
        );
        return result.rows[0];
    } catch (error) {
        throw new Error("Lỗi khi tạo task mới!");
    }
};

exports.updateBatchTasks = async (tasks, userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const results = [];
        for (const task of tasks) {
            if (task.id) {
                // Cập nhật task hiện có, kiểm tra user_id
                const result = await client.query(
                    `UPDATE timeline_tasks 
                     SET step = $1, 
                         status = $2, 
                         assignee = $3, 
                         start_date = $4::date, 
                         end_date = $5::date, 
                         notes = $6,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $7 AND user_id = $8
                     RETURNING *`,
                    [
                        task.step || '',
                        task.status || 'Pending',
                        task.assignee || '',
                        task.start_date,
                        task.end_date,
                        task.notes || '',
                        task.id,
                        userId
                    ]
                );
                if (result.rows[0]) {
                    results.push(result.rows[0]);
                }
            } else {
                // Thêm task mới với user_id
                const result = await client.query(
                    `INSERT INTO timeline_tasks 
                     (user_id, step, status, assignee, start_date, end_date, notes)
                     VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
                     RETURNING *`,
                    [
                        userId,
                        task.step || '',
                        task.status || 'Pending',
                        task.assignee || '',
                        task.start_date,
                        task.end_date,
                        task.notes || ''
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