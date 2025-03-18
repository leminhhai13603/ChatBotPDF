const timelineModel = require("../models/timelineModel");

exports.getAllTasks = async (req, res) => {
    const { projectId } = req.query; // Lấy projectId từ query

    try {
        const tasks = await timelineModel.getAllTasks(req.user.id, projectId);
        res.json(tasks);
    } catch (error) {
        console.error("Lỗi lấy tasks:", error);
        res.status(500).json({ error: "Lỗi máy chủ!" });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { step, status, assignee, start_date, end_date, notes } = req.body;
        const task = await timelineModel.createTask({
            user_id: req.user.id,
            step,
            status,
            assignee,
            start_date,
            end_date,
            notes
        });
        res.json(task);
    } catch (error) {
        console.error("Lỗi tạo task:", error);
        res.status(500).json({ error: "Lỗi máy chủ!" });
    }
};

exports.updateBatchTasks = async (req, res) => {
    try {
        const { tasks } = req.body;
        console.log("Received tasks:", tasks);

        await timelineModel.updateBatchTasks(tasks, req.user.id);
        res.json({ message: "Cập nhật thành công!" });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ 
            error: "Lỗi máy chủ!", 
            details: error.message 
        });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        console.log('Attempting to delete task:', taskId);

        const deletedTask = await timelineModel.deleteTask(taskId, req.user.id);

        if (deletedTask) {
            res.json({ 
                message: "Xóa task thành công!", 
                deletedTask 
            });
        } else {
            res.status(404).json({ 
                error: "Không tìm thấy task để xóa" 
            });
        }
    } catch (error) {
        console.error("Lỗi khi xóa task:", error);
        res.status(500).json({ 
            error: "Lỗi khi xóa task", 
            details: error.message 
        });
    }
}; 