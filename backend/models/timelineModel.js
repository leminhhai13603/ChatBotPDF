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
        const result = await pool.query(
            `INSERT INTO timeline_tasks 
             (user_id, step, status, assignee, start_date, end_date, notes, project_id)
             VALUES ($1, $2, $3::task_status, $4, $5, $6, $7, $8)
             RETURNING *`,
            [user_id, step, status, assignee, start_date, end_date, notes, project_id]
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
            if (!task.project_id) {
                throw new Error('project_id là bắt buộc cho mỗi task');
            }

            // Log để debug
            console.log('Task dates before save:', {
                start: task.start_date,
                end: task.end_date
            });

            if (task.id && !task.id.toString().startsWith('temp_')) {
                const result = await client.query(
                    `UPDATE timeline_tasks 
                     SET step = $1, 
                         status = $2, 
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
                        task.status || 'Pending',
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
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING *`,
                    [
                        userId,
                        task.step || '',
                        task.status || 'Pending',
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