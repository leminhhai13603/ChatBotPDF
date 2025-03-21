import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Input, Space, Button, Table, message, Tabs, Modal, Select, Tooltip } from 'antd';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import { SaveOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Chờ xử lý', color: '#ffd666' },
    { value: 'in-progress', label: 'Đang thực hiện', color: '#69c0ff' },
    { value: 'completed', label: 'Hoàn thành', color: '#95de64' },
    { value: 'delayed', label: 'Bị trễ', color: '#ff7875' }
];

// Khai báo mảng màu ở cấp độ module để sử dụng ở nhiều nơi
const TASK_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9FA4C4', '#B5EAD7', '#E2F0CB', '#C7CEEA',
    '#F67280', '#6C5B7B', '#C06C84', '#355C7D', '#F8B195',
    '#6A7FDB', '#8D6B94', '#7D80DA', '#93B5C6', '#DDA77B'
];

// Thêm hằng số cho các danh mục dự án
const PROJECT_CATEGORIES = [
    { key: 'new', label: 'List Mới', color: '#1890ff' },
    { key: 'old', label: 'List Cũ', color: '#52c41a' },
    { key: 'sale', label: 'Sale', color: '#fa8c16' },
    { key: 'production', label: 'Production', color: '#722ed1' },
];

const SheetDashboard = () => {
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [data, setData] = useState([]);
    const timelineRef = useRef(null);
    const containerRef = useRef(null);
    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    // Thêm state cho danh mục đang chọn
    const [activeCategory, setActiveCategory] = useState('new');

    const fetchTasks = useCallback(async (projectId) => {
        if (!projectId) {
            setData([]);
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/auth/projects/tasks?projectId=${projectId}`,
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('Tasks từ backend:', response.data);
            
            // Đảm bảo mỗi task có status
            const tasksWithStatus = Array.isArray(response.data) ? 
                response.data.map(task => ({
                    ...task,
                    status: task.status || 'pending' // Gán giá trị mặc định nếu không có status
                })) : [];
            
            setData(tasksWithStatus);
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu:', error);
            message.error('Lỗi khi lấy dữ liệu: ' + (error.response?.data?.error || error.message));
        }
    }, []);

    const initTimeline = useCallback(() => {
        if (!containerRef.current || !data.length) return;

        try {
            console.log('Initializing timeline with data:', data);
            
            const items = data.map((task, index) => {
                const colorIndex = index % TASK_COLORS.length;
                console.log(`Task ${index} assigned to color index ${colorIndex}, class custom-item-${colorIndex}`);
                
                return {
                    id: task.id || index,
                    content: '',
                    title: `${task.step || 'Chưa có tên'} (${task.assignee || 'Chưa phân công'}) - Trạng thái: ${
                        STATUS_OPTIONS.find(opt => opt.value === (task.status || 'pending'))?.label || 'Chờ xử lý'
                    }${task.notes ? `\nGhi chú: ${task.notes}` : ''}`,
                    start: new Date(new Date(task.start_date).getTime() - 24 * 60 * 60 * 1000),
                    end: new Date(task.end_date),
                    type: 'range',
                    className: `custom-item-${colorIndex}`, // Sử dụng chỉ số màu
                    style: `background-color: ${TASK_COLORS[colorIndex]} !important; border-color: ${TASK_COLORS[colorIndex]} !important;`, // Thêm style trực tiếp
                    group: index + 1
                };
            });

            const groups = data.map((_, index) => ({
                id: index + 1,
                content: ''
            }));

            const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

            const options = {
                width: '100%',
                height: '100%',
                stack: false,
                verticalScroll: true,
                horizontalScroll: false,
                zoomable: false,
                orientation: 'top',
                groupOrder: 'id',
                editable: false,
                start: startDate,
                end: endDate,
                timeAxis: { 
                    scale: 'day', 
                    step: 1
                },
                format: {
                    minorLabels: {
                        day: 'D',
                        month: 'Tháng M',
                        year: 'YYYY'
                    },
                    majorLabels: {
                        day: '',
                        month: 'Tháng M/YYYY',
                        year: ''
                    }
                }
            };

            // Xóa timeline cũ nếu có
            if (timelineRef.current) {
                try {
                    timelineRef.current.destroy();
                } catch (e) {
                    console.log('Timeline cũ không tồn tại', e);
                }
                timelineRef.current = null;
            }

            // Tạo timeline mới
            console.log('Creating new timeline with', items.length, 'items');
            const timeline = new Timeline(containerRef.current, items, groups, options);
            timelineRef.current = timeline;

        } catch (error) {
            console.error('Lỗi khi tạo timeline:', error);
        }
    }, [data, currentDate]);

    useEffect(() => {
        if (data.length > 0) {
            console.log('Data changed, reinitializing timeline');
            const timer = setTimeout(() => {
                initTimeline();
            }, 200);
            
            return () => clearTimeout(timer);
        }
    }, [data, currentDate, initTimeline]);

    // Thêm hàm để lọc dự án theo danh mục
    const getProjectsByCategory = (category) => {
        return projects.filter(project => project.category === category || 
            // Nếu không có category thì mặc định là 'new'
            (!project.category && category === 'new'));
    };

    // Sửa fetchProjects để bao gồm thông tin danh mục
    const fetchProjects = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/auth/projects`,
                {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (Array.isArray(response.data) && response.data.length > 0) {
                // Tải danh mục từ localStorage và gán vào dự án
                const projectsWithCategory = loadProjectCategories(response.data);
                
                console.log("Dự án sau khi tải với danh mục:", projectsWithCategory);
                setProjects(projectsWithCategory);
                
                // Nếu không có dự án active, chọn dự án đầu tiên trong danh mục hiện tại
                if (!activeProject) {
                    const projectsInCategory = projectsWithCategory.filter(p => p.category === activeCategory);
                    
                    if (projectsInCategory.length > 0) {
                        const firstProjectId = projectsInCategory[0].id;
                        setActiveProject(firstProjectId);
                        await fetchTasks(firstProjectId);
                    } else if (projectsWithCategory.length > 0) {
                        // Nếu không có dự án trong danh mục hiện tại, giữ danh mục hiện tại
                        // và không chọn dự án nào
                        setData([]);
                    }
                }
            }
        } catch (error) {
            console.error("Lỗi khi tải dự án:", error);
            if (error.response?.data?.expired) {
                message.error('Phiên đăng nhập đã hết hạn!');
                localStorage.removeItem("token");
                window.location.href = '/login';
            } else {
                message.error('Lỗi khi tải dự án: ' + (error.response?.data?.error || error.message));
            }
        }
    }, [activeCategory, activeProject, fetchTasks]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            message.error('Vui lòng đăng nhập để tiếp tục!');
            window.location.href = '/login';
            return;
        }
        
        fetchProjects();
    }, [fetchProjects]);

    useEffect(() => {
        if (activeProject) {
            fetchTasks(activeProject);
        } else {
            setData([]);
        }
    }, [activeProject, fetchTasks]);

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handleDelete = async (id) => {
        try {
            if (id.toString().startsWith('temp_')) {
                setData(prevData => prevData.filter(item => item.id !== id));
                message.success('Đã xóa dòng tạm thời');
                return;
            }

            console.log('Đang xóa task với ID:', id);
            const token = localStorage.getItem("token");
            
            const response = await axios.delete(
                `${API_BASE_URL}/auth/timeline/tasks/${id}`,
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 200) {
                setData(prevData => prevData.filter(item => item.id !== id));
                message.success('Đã xóa thành công');
                
                if (timelineRef.current) {
                    try {
                        timelineRef.current.setItems(
                            data.filter(item => item.id !== id)
                        );
                    } catch (e) {
                        console.error('Lỗi khi cập nhật timeline:', e);
                    }
                }
                
                console.log('Xóa task thành công:', response.data);
            }
        } catch (error) {
            console.error('Lỗi chi tiết khi xóa:', error.response?.data || error);
            message.error('Lỗi khi xóa: ' + (error.response?.data?.details || error.message));
        }
    };

    const formatDateToUTC = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Chuyển đổi về UTC để tránh vấn đề timezone
        const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        return utcDate.toISOString().split('T')[0];
    };

    const handleCellChange = (id, field, value) => {
        setData(prevData => 
            prevData.map(item => {
                if (item.id === id) {
                    // Xử lý đặc biệt cho các trường ngày
                    if (field === 'start_date' || field === 'end_date') {
                        return { ...item, [field]: formatDateToUTC(value) };
                    }
                    return { ...item, [field]: value };
                }
                return item;
            })
        );
    };

    // Thêm hàm kiểm tra màu sáng hay tối để chọn màu chữ phù hợp
    const isLightColor = (color) => {
        // Chuyển mã màu HEX sang RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Tính độ sáng theo công thức
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        // Nếu độ sáng > 128, coi là màu sáng
        return brightness > 128;
    };

    const columns = [
        {
            title: 'CV',
            dataIndex: 'step',
            key: 'step',
            width: '15%',
            render: (text, record, index) => {
                // Lấy màu tương ứng với index của dòng
                const colorIndex = index % TASK_COLORS.length;
                const backgroundColor = TASK_COLORS[colorIndex];
                // Tính màu chữ dựa trên độ sáng của màu nền
                const textColor = isLightColor(backgroundColor) ? 'black' : 'white';
                
                return (
                    <Tooltip title={text || 'Nhập tên công việc'}>
                        <Input
                            value={text || ''}
                            onChange={(e) => handleCellChange(record.id, 'step', e.target.value)}
                            placeholder="Tên CV"
                            style={{ 
                                width: '100%',
                                backgroundColor,
                                color: textColor,
                                border: 'none',
                                fontWeight: 'bold'
                            }}
                        />
                    </Tooltip>
                );
            }
        },
        {
            title: 'Người',
            dataIndex: 'assignee',
            key: 'assignee',
            width: '10%',
            render: (text, record) => (
                <Tooltip title={text || 'Nhập người thực hiện'}>
                    <Input
                        value={text || ''}
                        onChange={(e) => handleCellChange(record.id, 'assignee', e.target.value)}
                        placeholder="Người"
                        style={{ width: '100%' }}
                    />
                </Tooltip>
            )
        },
        {
            title: 'Bắt đầu',
            dataIndex: 'start_date',
            key: 'start_date',
            width: '12%',
            render: (text, record) => (
                <input
                    type="date"
                    value={formatDateForInput(text)}
                    onChange={(e) => handleCellChange(record.id, 'start_date', e.target.value)}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Kết thúc',
            dataIndex: 'end_date',
            key: 'end_date',
            width: '12%',
            render: (text, record) => (
                <input
                    type="date"
                    value={formatDateForInput(text)}
                    onChange={(e) => handleCellChange(record.id, 'end_date', e.target.value)}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: '20%',
            render: (text, record) => (
                <Select
                    value={text || 'pending'}
                    onChange={(value) => handleCellChange(record.id, 'status', value)}
                    style={{ width: '100%' }}
                    options={STATUS_OPTIONS.map(option => ({
                        value: option.value,
                        label: option.label,
                        style: {
                            backgroundColor: option.color,
                            color: option.value === 'pending' ? '#000' : '#fff'
                        }
                    }))}
                />
            )
        },
        {
            title: 'Ghi chú',
            dataIndex: 'notes',
            key: 'notes',
            width: '15%',
            render: (text, record) => (
                <Tooltip title={text || 'Chưa có ghi chú'}>
                    <Input.TextArea
                        value={text || ''}
                        onChange={(e) => handleCellChange(record.id, 'notes', e.target.value)}
                        placeholder="Ghi chú"
                        autoSize={{ minRows: 1, maxRows: 2 }}
                        style={{ width: '100%' }}
                    />
                </Tooltip>
            )
        },
        {
            title: '',
            key: 'action',
            width: '5%',
            render: (_, record) => (
                <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(record.id)}
                />
            )
        }
    ];

    const handleAddRow = () => {
        if (!activeProject) {
            message.warning('Vui lòng chọn dự án trước khi thêm công việc!');
            return;
        }

        const today = new Date();
        const formattedDate = today.getFullYear() + '-' + 
            String(today.getMonth() + 1).padStart(2, '0') + '-' + 
            String(today.getDate()).padStart(2, '0');
        
        const newTask = {
            id: 'temp_' + Date.now(),
            step: '',
            assignee: '',
            notes: '',
            start_date: formattedDate,
            end_date: formattedDate,
            status: 'pending',
            project_id: Number(activeProject)
        };
        
        setData(prevData => [...prevData, newTask]);
    };

    useEffect(() => {
        console.log('Data hiện tại:', data);
    }, [data]);

    const handleSave = async () => {
        try {
            if (!activeProject) {
                message.warning('Vui lòng chọn dự án trước khi lưu!');
                return;
            }

            const token = localStorage.getItem("token");
            
            const tasksToUpdate = data.map(task => {
                // Thêm 1 ngày khi lưu
                const addOneDay = (dateStr) => {
                    const date = new Date(dateStr);
                    date.setDate(date.getDate() + 1);
                    return date.toISOString().split('T')[0];
                };

                return {
                    id: task.id?.toString().startsWith('temp_') ? undefined : task.id,
                    step: task.step || '',
                    assignee: task.assignee || '',
                    notes: task.notes || '',
                    start_date: addOneDay(task.start_date),
                    end_date: addOneDay(task.end_date),
                    status: task.status || 'pending',
                    project_id: activeProject
                };
            });

            console.log('Tasks to save:', tasksToUpdate);

            const response = await axios.post(
                `${API_BASE_URL}/auth/timeline/tasks/batch`,
                tasksToUpdate,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data) {
                message.success('Đã lưu thành công');
                await fetchTasks(activeProject);
            }
        } catch (error) {
            console.error('Lỗi khi lưu:', error);
            message.error('Lỗi khi lưu dữ liệu: ' + (error.response?.data?.error || error.message));
        }
    };

    // Sửa phương thức thêm dự án
    const handleAddProject = () => {
        // Khởi tạo giá trị danh mục với danh mục đang active
        let projectInput = {
            name: '',
            category: activeCategory // Gán danh mục hiện tại là mặc định
        };
        
        Modal.confirm({
            title: 'Thêm Dự Án Mới',
            className: 'custom-modal',
            content: (
                <div>
                    <Input
                        className="project-input"
                        placeholder="Nhập tên dự án"
                        onChange={(e) => projectInput.name = e.target.value}
                        style={{ marginBottom: '10px' }}
                    />
                    <Select
                        defaultValue={activeCategory}
                        style={{ width: '100%' }}
                        onChange={(value) => {
                            projectInput.category = value;
                            console.log("Đã chọn danh mục:", value); // Debug
                        }}
                        options={PROJECT_CATEGORIES.map(cat => ({
                            value: cat.key,
                            label: cat.label
                        }))}
                    />
                </div>
            ),
            onOk: () => {
                // Log ra để debug
                console.log("Đang tạo dự án với danh mục:", projectInput.category);
                addNewProject(projectInput);
            },
            okText: 'Thêm',
            cancelText: 'Hủy',
        });
    };

    const addNewProject = async (projectInput) => {
        if (!projectInput.name.trim()) {
            message.error('Vui lòng nhập tên dự án!');
            return;
        }
        
        console.log("Bắt đầu tạo dự án:", projectInput); // Debug

        try {
            const token = localStorage.getItem("token");
            
            // Tạo dự án trên backend
            const response = await axios.post(
                `${API_BASE_URL}/auth/projects`,
                { name: projectInput.name }, // Không gửi category nếu backend không hỗ trợ
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Tạo đối tượng dự án mới với category được chọn
            const newProject = {
                id: response.data.projectId,
                name: projectInput.name,
                category: projectInput.category // Đảm bảo lưu category đã chọn
            };
            
            console.log("Dự án mới được tạo:", newProject); // Debug
            
            // Cập nhật state projects với dự án mới
            setProjects(prev => {
                const updated = [...prev, newProject];
                console.log("Danh sách dự án mới:", updated);
                
                // Lưu danh sách dự án có category vào localStorage
                saveProjectCategories(updated);
                
                return updated;
            });
            
            // Đặt active project là dự án mới
            setActiveProject(newProject.id);
            
            // Cập nhật category hiện tại thành category của dự án mới
            setActiveCategory(projectInput.category);
            
            // Reset data
            setData([]);
            
            message.success('Dự án đã được thêm thành công!');
        } catch (error) {
            console.error('Lỗi khi thêm dự án:', error);
            message.error('Lỗi khi thêm dự án: ' + (error.response?.data?.error || error.message));
        }
    };

    // Thêm hàm lưu category của dự án vào localStorage
    const saveProjectCategories = (projectsList) => {
        try {
            const projectCategories = projectsList.map(project => ({
                id: project.id,
                category: project.category || 'new'
            }));
            localStorage.setItem('projectCategories', JSON.stringify(projectCategories));
            console.log("Đã lưu danh mục dự án vào localStorage:", projectCategories);
        } catch (error) {
            console.error("Lỗi khi lưu danh mục dự án:", error);
        }
    };

    // Thêm hàm tải category của dự án từ localStorage
    const loadProjectCategories = (projectsList) => {
        try {
            const savedCategories = localStorage.getItem('projectCategories');
            if (!savedCategories) return projectsList;
            
            const categoriesData = JSON.parse(savedCategories);
            console.log("Đã tải danh mục dự án từ localStorage:", categoriesData);
            
            return projectsList.map(project => {
                const savedProject = categoriesData.find(p => p.id === project.id);
                return savedProject 
                    ? {...project, category: savedProject.category} 
                    : {...project, category: project.category || 'new'};
            });
        } catch (error) {
            console.error("Lỗi khi tải danh mục dự án:", error);
            return projectsList;
        }
    };

    // Sửa lại hàm xóa dự án để cập nhật localStorage
    const handleDeleteProject = async (projectId) => {
        const project = projects.find(p => p.id === projectId);
        
        Modal.confirm({
            title: 'Xác nhận xóa dự án',
            className: 'custom-modal delete-modal',
            content: `Bạn có chắc chắn muốn xóa dự án "${project?.name}"? Tất cả công việc trong dự án này sẽ bị xóa và không thể khôi phục.`,
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const token = localStorage.getItem("token");
                    await axios.delete(
                        `${API_BASE_URL}/auth/projects/${projectId}`,
                        {
                            headers: { 
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    // Cập nhật danh sách dự án và lưu vào localStorage
                    const updatedProjects = projects.filter(project => project.id !== projectId);
                    setProjects(updatedProjects);
                    saveProjectCategories(updatedProjects);
                    
                    if (activeProject === projectId) {
                        const remainingProjects = projects.filter(p => p.id !== projectId);
                        if (remainingProjects.length > 0) {
                            // Tìm dự án đầu tiên trong cùng danh mục
                            const projectsInSameCategory = remainingProjects.filter(p => p.category === activeCategory);
                            
                            if (projectsInSameCategory.length > 0) {
                                setActiveProject(projectsInSameCategory[0].id);
                                await fetchTasks(projectsInSameCategory[0].id);
                            } else {
                                setActiveProject(null);
                                setData([]);
                            }
                        } else {
                            setActiveProject(null);
                            setData([]);
                        }
                    }
                    
                    message.success('Dự án đã được xóa thành công!');
                } catch (error) {
                    console.error('Lỗi khi xóa dự án:', error);
                    message.error('Lỗi khi xóa dự án: ' + (error.response?.data?.error || error.message));
                }
            },
        });
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        return dateString.split('T')[0];
    };

    // Thêm hàm chuyển đổi danh mục
    const handleCategoryChange = (category) => {
        console.log("Chuyển sang danh mục:", category);
        setActiveCategory(category);
        
        // Tìm dự án đầu tiên trong danh mục này
        const projectsInCategory = projects.filter(p => p.category === category);
        console.log("Các dự án trong danh mục này:", projectsInCategory);
        
        if (projectsInCategory.length > 0) {
            setActiveProject(projectsInCategory[0].id);
            fetchTasks(projectsInCategory[0].id);
        } else {
            setActiveProject(null);
            setData([]);
        }
    };

    // Tạo màu cho dự án dựa trên danh mục
    const getProjectColor = (project) => {
        const category = project.category || 'new';
        const categoryInfo = PROJECT_CATEGORIES.find(cat => cat.key === category);
        return categoryInfo ? categoryInfo.color : '#1890ff';
    };

    // Thêm logic lưu category với dự án hiện có
    const handleChangeProjectCategory = async (projectId, newCategory) => {
        try {
            const token = localStorage.getItem("token");
            const project = projects.find(p => p.id === projectId);
            
            if (!project) {
                message.error('Không tìm thấy dự án!');
                return;
            }
            
            // Cập nhật category trong state local trước
            setProjects(prev => prev.map(p => 
                p.id === projectId ? {...p, category: newCategory} : p
            ));
            
            // Thử cập nhật trên server nếu API hỗ trợ
            try {
                await axios.put(
                    `${API_BASE_URL}/auth/projects/${projectId}`,
                    { 
                        name: project.name,
                        category: newCategory
                    },
                    {
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                message.success('Đã cập nhật danh mục dự án thành công!');
            } catch (error) {
                console.warn('API không hỗ trợ cập nhật category, sử dụng lưu trữ local');
                // Vẫn giữ thay đổi trong state local
            }
            
        } catch (error) {
            console.error('Lỗi khi thay đổi danh mục dự án:', error);
            message.error('Lỗi khi thay đổi danh mục dự án');
        }
    };

    // Thêm tùy chọn để di chuyển dự án giữa các danh mục
    const ProjectContextMenu = ({ project }) => {
        return (
            <div className="project-context-menu">
                {PROJECT_CATEGORIES.map(category => (
                    category.key !== project.category && (
                        <div 
                            key={category.key} 
                            className="project-context-menu-item"
                            onClick={() => handleChangeProjectCategory(project.id, category.key)}
                        >
                            Di chuyển đến {category.label}
                        </div>
                    )
                ))}
            </div>
        );
    };

    // Thêm menu context khi click chuột phải vào dự án
    useEffect(() => {
        const handleContextMenu = (e) => {
            if (e.target.classList.contains('project-btn')) {
                e.preventDefault();
                const projectId = e.target.dataset.projectId;
                // Hiển thị menu context
            }
        };
        
        document.addEventListener('contextmenu', handleContextMenu);
        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, []);

    return (
        <div style={{ 
            padding: '0', 
            height: '100vh', 
            display: 'flex', 
            gap: '20px',
            overflow: 'hidden'  
        }}>
            <div style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', maxWidth: '50%' }}>
                {/* Nút chọn danh mục */}
                <div style={{ marginBottom: '16px' }}>
                    {PROJECT_CATEGORIES.map(category => (
                        <Button
                            key={category.key}
                            type={activeCategory === category.key ? 'primary' : 'default'}
                            onClick={() => handleCategoryChange(category.key)}
                            style={{ 
                                marginRight: '8px', 
                                marginBottom: '8px',
                                backgroundColor: activeCategory === category.key ? category.color : undefined,
                                borderColor: category.color,
                                color: activeCategory === category.key ? '#fff' : category.color
                            }}
                        >
                            {category.label}
                            {projects.filter(p => p.category === category.key).length > 0 && (
                                <span style={{ marginLeft: '5px' }}>
                                    ({projects.filter(p => p.category === category.key).length})
                                </span>
                            )}
                        </Button>
                    ))}
                </div>
                
                <Space style={{ marginBottom: '16px' }}>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={handleAddProject}
                        style={{
                            backgroundColor: PROJECT_CATEGORIES.find(c => c.key === activeCategory)?.color,
                            borderColor: PROJECT_CATEGORIES.find(c => c.key === activeCategory)?.color,
                        }}
                    >
                        Thêm Dự Án vào {PROJECT_CATEGORIES.find(c => c.key === activeCategory)?.label}
                    </Button>
                </Space>
                
                <div style={{ 
                    marginBottom: '16px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                }}>
                    {projects
                        .filter(project => project.category === activeCategory)
                        .map(project => (
                            <Button
                                key={project.id}
                                type={activeProject === project.id ? 'primary' : 'default'}
                                onClick={() => setActiveProject(project.id)}
                                style={{ 
                                    backgroundColor: activeProject === project.id ? getProjectColor(project) : undefined,
                                    borderColor: getProjectColor(project),
                                    color: activeProject === project.id ? '#fff' : getProjectColor(project),
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '4px'
                                }}
                            >
                                <div style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    backgroundColor: getProjectColor(project),
                                    marginRight: '6px',
                                    display: activeProject === project.id ? 'none' : 'block'
                                }} />
                                {project.name}
                                {activeProject === project.id && (
                                    <DeleteOutlined
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteProject(project.id);
                                        }}
                                        style={{ marginLeft: '8px' }}
                                    />
                                )}
                            </Button>
                        ))}
                </div>
                
                <Card 
                    title={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                borderRadius: '50%', 
                                backgroundColor: PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color,
                                marginRight: '8px' 
                            }} />
                            <span>Danh Sách Công Việc - {PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.label}</span>
                        </div>
                    }
                    style={{ 
                        flex: '1',
                        borderRadius: 0,
                        overflow: 'auto',
                        maxWidth: '100%',
                        borderTop: `3px solid ${PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color}`
                    }}
                    bodyStyle={{ padding: '0' }}
                    extra={
                        <Space>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAddRow}
                                disabled={!activeProject}
                                style={{ 
                                    backgroundColor: activeProject ? PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color : undefined,
                                    borderColor: activeProject ? PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color : undefined,
                                }}
                            >
                                Thêm dòng
                            </Button>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleSave}
                                disabled={!activeProject}
                                style={{ 
                                    backgroundColor: activeProject ? PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color : undefined,
                                    borderColor: activeProject ? PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color : undefined,
                                }}
                            >
                                Lưu vào database
                            </Button>
                        </Space>
                    }
                >
                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey={record => record.id}
                        pagination={false}
                        scroll={{ y: 'calc(100vh - 350px)', x: '100%' }}
                        rowClassName={(record, index) => {
                            // Tạo class cho mỗi dòng dựa trên index
                            const colorClass = `table-row-${index % TASK_COLORS.length}`;
                            const tempClass = record.id?.toString().startsWith('temp_') ? 'unsaved-row' : '';
                            return `${colorClass} ${tempClass}`;
                        }}
                        bordered
                        size="small"
                        style={{ 
                            marginTop: '16px', 
                            tableLayout: 'fixed',
                            width: '100%',
                            maxWidth: '100%'
                        }}
                    />
                </Card>
            </div>

            {/* Timeline bên phải */}
            <Card 
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                borderRadius: '50%', 
                                backgroundColor: PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color,
                                marginRight: '8px' 
                            }} />
                            <span>Biểu Đồ Timeline - {PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.label}</span>
                        </div>
                        <Space>
                            <Button onClick={handlePrevMonth}>&lt; Tháng trước</Button>
                            <span>{`Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`}</span>
                            <Button onClick={handleNextMonth}>Tháng sau &gt;</Button>
                        </Space>
                    </div>
                }
                style={{ 
                    flex: '0 0 50%',
                    borderRadius: 0,
                    height: '100vh',
                    overflow: 'hidden',
                    maxWidth: '100%',
                    borderTop: `3px solid ${PROJECT_CATEGORIES.find(cat => cat.key === activeCategory)?.color}`
                }}
            >
                <div 
                    ref={containerRef}
                    style={{ 
                        width: '100%', 
                        height: 'calc(100vh - 130px)',
                        overflow: 'hidden'  
                    }}
                ></div>
            </Card>
        </div>
    );
};

export default SheetDashboard;

<style>{`
    /* Reset các style cũ liên quan đến status */
    .status-pending, .status-in-progress, .status-completed, .status-delayed {
        display: none !important;
    }
    
    /* Style đơn giản cho từng loại custom item trên timeline */
    .custom-item-0 { background-color: ${TASK_COLORS[0]} !important; color: #fff !important; }
    .custom-item-1 { background-color: ${TASK_COLORS[1]} !important; color: #fff !important; }
    .custom-item-2 { background-color: ${TASK_COLORS[2]} !important; color: #fff !important; }
    .custom-item-3 { background-color: ${TASK_COLORS[3]} !important; color: #fff !important; }
    .custom-item-4 { background-color: ${TASK_COLORS[4]} !important; color: #000 !important; }
    .custom-item-5 { background-color: ${TASK_COLORS[5]} !important; color: #fff !important; }
    .custom-item-6 { background-color: ${TASK_COLORS[6]} !important; color: #fff !important; }
    .custom-item-7 { background-color: ${TASK_COLORS[7]} !important; color: #000 !important; }
    .custom-item-8 { background-color: ${TASK_COLORS[8]} !important; color: #000 !important; }
    .custom-item-9 { background-color: ${TASK_COLORS[9]} !important; color: #000 !important; }
    .custom-item-10 { background-color: ${TASK_COLORS[10]} !important; color: #fff !important; }
    .custom-item-11 { background-color: ${TASK_COLORS[11]} !important; color: #fff !important; }
    .custom-item-12 { background-color: ${TASK_COLORS[12]} !important; color: #fff !important; }
    .custom-item-13 { background-color: ${TASK_COLORS[13]} !important; color: #fff !important; }
    .custom-item-14 { background-color: ${TASK_COLORS[14]} !important; color: #000 !important; }
    .custom-item-15 { background-color: ${TASK_COLORS[15]} !important; color: #fff !important; }
    .custom-item-16 { background-color: ${TASK_COLORS[16]} !important; color: #fff !important; }
    .custom-item-17 { background-color: ${TASK_COLORS[17]} !important; color: #fff !important; }
    .custom-item-18 { background-color: ${TASK_COLORS[18]} !important; color: #fff !important; }
    .custom-item-19 { background-color: ${TASK_COLORS[19]} !important; color: #000 !important; }
    
    /* Style cơ bản cho timeline */
    .vis-item {
        border-radius: 4px !important;
        border: none !important;
        height: 28px !important;
        line-height: 28px !important;
        padding: 0 8px !important;
        font-weight: 500 !important;
    }
    
    /* Các style khác giữ nguyên */
    /* ... existing styles ... */

    /* Style cho các custom item trên timeline - chỉ định cụ thể hơn */
    .vis-item.custom-item-0 { background-color: ${TASK_COLORS[0]} !important; border-color: ${TASK_COLORS[0]} !important; }
    .vis-item.custom-item-1 { background-color: ${TASK_COLORS[1]} !important; border-color: ${TASK_COLORS[1]} !important; }
    .vis-item.custom-item-2 { background-color: ${TASK_COLORS[2]} !important; border-color: ${TASK_COLORS[2]} !important; }
    .vis-item.custom-item-3 { background-color: ${TASK_COLORS[3]} !important; border-color: ${TASK_COLORS[3]} !important; }
    .vis-item.custom-item-4 { background-color: ${TASK_COLORS[4]} !important; border-color: ${TASK_COLORS[4]} !important; color: black !important; }
    .vis-item.custom-item-5 { background-color: ${TASK_COLORS[5]} !important; border-color: ${TASK_COLORS[5]} !important; }
    .vis-item.custom-item-6 { background-color: ${TASK_COLORS[6]} !important; border-color: ${TASK_COLORS[6]} !important; }
    .vis-item.custom-item-7 { background-color: ${TASK_COLORS[7]} !important; border-color: ${TASK_COLORS[7]} !important; color: black !important; }
    .vis-item.custom-item-8 { background-color: ${TASK_COLORS[8]} !important; border-color: ${TASK_COLORS[8]} !important; color: black !important; }
    .vis-item.custom-item-9 { background-color: ${TASK_COLORS[9]} !important; border-color: ${TASK_COLORS[9]} !important; color: black !important; }
    .vis-item.custom-item-10 { background-color: ${TASK_COLORS[10]} !important; border-color: ${TASK_COLORS[10]} !important; }
    .vis-item.custom-item-11 { background-color: ${TASK_COLORS[11]} !important; border-color: ${TASK_COLORS[11]} !important; }
    .vis-item.custom-item-12 { background-color: ${TASK_COLORS[12]} !important; border-color: ${TASK_COLORS[12]} !important; }
    .vis-item.custom-item-13 { background-color: ${TASK_COLORS[13]} !important; border-color: ${TASK_COLORS[13]} !important; }
    .vis-item.custom-item-14 { background-color: ${TASK_COLORS[14]} !important; border-color: ${TASK_COLORS[14]} !important; color: black !important; }
    .vis-item.custom-item-15 { background-color: ${TASK_COLORS[15]} !important; border-color: ${TASK_COLORS[15]} !important; }
    .vis-item.custom-item-16 { background-color: ${TASK_COLORS[16]} !important; border-color: ${TASK_COLORS[16]} !important; }
    .vis-item.custom-item-17 { background-color: ${TASK_COLORS[17]} !important; border-color: ${TASK_COLORS[17]} !important; }
    .vis-item.custom-item-18 { background-color: ${TASK_COLORS[18]} !important; border-color: ${TASK_COLORS[18]} !important; }
    .vis-item.custom-item-19 { background-color: ${TASK_COLORS[19]} !important; border-color: ${TASK_COLORS[19]} !important; color: black !important; }
    
    /* Các CSS khác giữ nguyên */
    .vis-timeline { border: none !important; }
    .vis-item {
        border-radius: 4px !important;
        height: 28px !important;
        line-height: 28px !important;
        padding: 0 8px !important;
        color: white !important;
        font-weight: 500 !important;
    }
    
    /* Style cho vis-item mà không phải chỉ định class để đảm bảo */
    .vis-timeline .vis-item {
        color: white !important;
    }
    
    /* Các CSS khác */
    
    /* Debug - thêm viền để dễ nhìn */
    .vis-item {
        border-width: 1px !important;
        box-shadow: 0 1px 5px rgba(0,0,0,0.2) !important;
    }
`}</style>