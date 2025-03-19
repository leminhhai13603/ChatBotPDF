const timelineModel = require("../models/timelineModel");
const projectModel = require("../models/projectModel");

exports.getAllTasks = async (req, res) => {
    const { projectId } = req.query; 

    try {
        // Kiểm tra vai trò admin
        const isAdmin = req.user.roles.includes('admin');
        
        // Lấy tasks dựa vào vai trò
        let tasks;
        if (isAdmin) {
            tasks = await timelineModel.getAllTasksForAdmin(projectId);
        } else {
            tasks = await timelineModel.getAllTasks(req.user.id, projectId);
        }
        
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
        const tasks = req.body;
        const userId = req.user.id;

        // Log để debug
        console.log('Tasks received:', tasks);
        console.log('User ID:', userId);

        // Validate dữ liệu
        if (!Array.isArray(tasks)) {
            return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
        }

        // Gọi model để xử lý
        const result = await timelineModel.updateBatchTasks(tasks, userId);

        res.json({
            message: "Cập nhật thành công",
            data: result
        });
    } catch (error) {
        console.error("Lỗi khi cập nhật tasks:", error);
        res.status(500).json({ error: "Lỗi khi cập nhật tasks" });
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

exports.getTasksByAssignee = async (req, res) => {
    const { projectId } = req.query;

    try {
        // Kiểm tra vai trò admin
        const isAdmin = req.user.roles.includes('admin');
        
        // Lấy tasks dựa vào vai trò
        let tasks;
        if (isAdmin) {
            tasks = await timelineModel.getTasksByAssigneeForAdmin(projectId);
        } else {
            tasks = await timelineModel.getTasksByAssignee(req.user.id, projectId);
        }
        
        res.json(tasks);
    } catch (error) {
        console.error("Lỗi lấy tasks:", error);
        res.status(500).json({ error: "Lỗi máy chủ!" });
    }
};

exports.getTasksByAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.query.projectId;
        const isAdmin = req.user.roles.includes('admin');

        if (!projectId) {
            return res.status(400).json({ error: "Thiếu projectId" });
        }

        let tasks;
        if (isAdmin) {
            tasks = await timelineModel.getTasksByAssigneeForAdmin(projectId);
        } else {
            tasks = await timelineModel.getTasksByAssignee(userId, projectId);
        }
        
        res.json(tasks);
    } catch (error) {
        console.error("Lỗi khi lấy tasks:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.createProject = async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
        return res.status(400).json({ error: "Tên dự án không được để trống!" });
    }

    try {
        const projectId = await projectModel.createProject(name, userId);
        res.json({ message: "Tạo dự án thành công!", projectId });
    } catch (error) {
        console.error("Lỗi tạo dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

exports.deleteProject = async (req, res) => {
    const { id } = req.params;

    try {
        await projectModel.deleteProject(id);
        res.json({ message: "Xóa dự án thành công!" });
    } catch (error) {
        console.error("Lỗi xóa dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
}; 