import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Input, Space, Button, Table, message, Tabs, Modal } from 'antd';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import { SaveOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

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
            
            console.log('Tasks của project:', projectId, response.data);
            
            setData(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu:', error);
            message.error('Lỗi khi lấy dữ liệu: ' + (error.response?.data?.error || error.message));
        }
    }, []);

    const initTimeline = useCallback(() => {
        if (!containerRef.current || !data.length) return;

        try {
            const items = data.map((task, index) => ({
                id: task.id || index,
                content: `${task.step || 'Chưa có tên'} (${task.assignee || 'Chưa phân công'})`,
                start: new Date(new Date(task.start_date).getTime() - 24 * 60 * 60 * 1000),
                end: new Date(task.end_date),
                type: 'range',
                className: `custom-item-${index % 10}`,
                group: index + 1
            }));

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

            const timeline = new Timeline(containerRef.current, items, groups, options);
            timelineRef.current = timeline;

        } catch (error) {
            console.error('Lỗi khi tạo timeline:', error);
        }
    }, [data, currentDate]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            message.error('Vui lòng đăng nhập để tiếp tục!');
            window.location.href = '/login';
            return;
        }
        
        // Load projects ngay khi component mount
        const loadInitialData = async () => {
            try {
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
                    setProjects(response.data);
                    const firstProjectId = response.data[0].id;
                    setActiveProject(firstProjectId);
                    
                    // Load tasks của project đầu tiên
                    await fetchTasks(firstProjectId);
                }
            } catch (error) {
                if (error.response?.data?.expired) {
                    message.error('Phiên đăng nhập đã hết hạn!');
                    localStorage.removeItem("token");
                    window.location.href = '/login';
                } else {
                    message.error('Lỗi khi tải dữ liệu: ' + (error.response?.data?.error || error.message));
                }
            }
        };

        loadInitialData();
    }, [fetchTasks]);

    useEffect(() => {
        if (activeProject) {
            fetchTasks(activeProject);
        } else {
            setData([]);
        }
    }, [activeProject, fetchTasks]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (data.length > 0) {
                if (timelineRef.current) {
                    try {
                        timelineRef.current.destroy();
                    } catch (e) {
                        console.log('Timeline cũ không tồn tại');
                    }
                    timelineRef.current = null;
                }
                initTimeline();
            }
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [data, currentDate, initTimeline]);

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

    useEffect(() => {
        if (timelineRef.current && data.length > 0) {
            const items = data.map(task => ({
                id: task.id,
                content: `${task.step || 'Chưa có tên'} (${task.assignee || 'Chưa phân công'})`,
                title: task.notes ? `Ghi chú: ${task.notes}` : '',
                start: new Date(task.start_date),
                end: new Date(task.end_date),
                className: `status-${(task.status || 'pending').toLowerCase().replace(' ', '-')}`
            }));
            
            try {
                timelineRef.current.setItems(items);
            } catch (e) {
                console.error('Lỗi khi cập nhật timeline:', e);
            }
        }
    }, [data]);

    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        return dateString.split('T')[0];
    };

    const handleCellChange = (id, field, value) => {
        setData(prevData => 
            prevData.map(item => {
                if (item.id === id) {
                    if (field === 'start_date' || field === 'end_date') {
                        return { ...item, [field]: value };
                    }
                    return { ...item, [field]: value };
                }
                return item;
            })
        );
    };

    const columns = [
        {
            title: 'Tên công việc',
            dataIndex: 'step',
            key: 'step',
            width: '20%',
            render: (text, record) => (
                <Input
                    key={record.id}
                    value={text || ''}
                    onChange={(e) => handleCellChange(record.id, 'step', e.target.value)}
                    placeholder="Nhập tên công việc"
                    style={{ width: '100%', maxWidth: '200px' }}
                />
            )
        },
        {
            title: 'Người thực hiện',
            dataIndex: 'assignee',
            key: 'assignee',
            width: '15%',
            render: (text, record) => (
                <Input
                    key={record.id}
                    value={text || ''}
                    onChange={(e) => handleCellChange(record.id, 'assignee', e.target.value)}
                    placeholder="Nhập tên người thực hiện"
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Ngày bắt đầu',
            dataIndex: 'start_date',
            key: 'start_date',
            width: '15%',
            render: (text, record) => (
                <input
                    type="date"
                    value={formatDateForInput(text)}
                    onChange={(e) => handleCellChange(record.id, 'start_date', e.target.value)}
                    style={{ 
                        width: '100%',
                        padding: '4px 11px',
                        border: '1px solid #d9d9d9',
                        borderRadius: '2px',
                        fontSize: '14px'
                    }}
                />
            )
        },
        {
            title: 'Ngày kết thúc',
            dataIndex: 'end_date',
            key: 'end_date',
            width: '15%',
            render: (text, record) => (
                <input
                    type="date"
                    value={formatDateForInput(text)}
                    onChange={(e) => handleCellChange(record.id, 'end_date', e.target.value)}
                    style={{ 
                        width: '100%',
                        padding: '4px 11px',
                        border: '1px solid #d9d9d9',
                        borderRadius: '2px',
                        fontSize: '14px'
                    }}
                />
            )
        },
        {
            title: 'Ghi chú',
            dataIndex: 'notes',
            key: 'notes',
            width: '25%',
            render: (text, record) => (
                <Input.TextArea
                    key={record.id}
                    value={text || ''}
                    onChange={(e) => handleCellChange(record.id, 'notes', e.target.value)}
                    placeholder="Nhập ghi chú"
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: '10%',
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
            status: 'Pending',
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
                // Chuyển đổi ngày về đúng múi giờ local
                const start = new Date(task.start_date);
                const end = new Date(task.end_date);
                
                // Thêm 7 tiếng để bù timezone
                start.setHours(start.getHours() + 7);
                end.setHours(end.getHours() + 7);

                return {
                    id: task.id?.toString().startsWith('temp_') ? undefined : task.id,
                    step: task.step || '',
                    assignee: task.assignee || '',
                    notes: task.notes || '',
                    start_date: start.toISOString().split('T')[0],
                    end_date: end.toISOString().split('T')[0],
                    status: task.status || 'Pending',
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

    const handleAddProject = () => {
        let projectName = '';
        
        Modal.confirm({
            title: 'Thêm Dự Án Mới',
            className: 'custom-modal',
            content: (
                <Input
                    className="project-input"
                    placeholder="Nhập tên dự án"
                    onChange={(e) => projectName = e.target.value}
                    onPressEnter={(e) => {
                        projectName = e.target.value;
                        Modal.destroyAll();
                        addNewProject(projectName);
                    }}
                />
            ),
            onOk: () => addNewProject(projectName),
            okText: 'Thêm',
            cancelText: 'Hủy',
        });
    };

    const addNewProject = async (projectName) => {
        if (!projectName.trim()) {
            message.error('Vui lòng nhập tên dự án!');
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await axios.post(
                `${API_BASE_URL}/auth/projects`,
                { name: projectName },
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const newProject = {
                id: response.data.projectId,
                name: projectName
            };
            setProjects(prev => [...prev, newProject]);
            setActiveProject(newProject.id);
            setData([]);
            message.success('Dự án đã được thêm thành công!');
        } catch (error) {
            console.error('Lỗi khi thêm dự án:', error);
            message.error('Lỗi khi thêm dự án!');
        }
    };

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

                    setProjects(prev => prev.filter(project => project.id !== projectId));
                    
                    if (activeProject === projectId) {
                        const remainingProjects = projects.filter(p => p.id !== projectId);
                        if (remainingProjects.length > 0) {
                            setActiveProject(remainingProjects[0].id);
                            await fetchTasks(remainingProjects[0].id);
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

    return (
        <div style={{ 
            padding: '0', 
            height: '100vh', 
            display: 'flex', 
            gap: '20px',
            overflow: 'hidden'  
        }}>
            <div style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', maxWidth: '50%' }}>
                <Space style={{ marginBottom: '16px' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProject}>
                        Thêm Dự Án
                    </Button>
                </Space>
                <div style={{ marginBottom: '16px' }}>
                    {projects.map(project => (
                        <Button
                            key={project.id}
                            type={activeProject === project.id ? 'primary' : 'default'}
                            onClick={() => setActiveProject(project.id)}
                            style={{ marginRight: '8px', marginBottom: '8px' }}
                        >
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
                    title="Danh Sách Công Việc"
                    style={{ 
                        flex: '1',
                        borderRadius: 0,
                        overflow: 'auto',
                        maxWidth: '100%'
                    }}
                    bodyStyle={{ padding: '0' }}
                    extra={
                        <Space>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAddRow}
                                disabled={!activeProject}
                            >
                                Thêm dòng
                            </Button>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleSave}
                                disabled={!activeProject}
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
                        scroll={{ y: 'calc(100vh - 250px)', x: '100%' }}
                        rowClassName={(record) => 
                            record.id?.toString().startsWith('temp_') ? 'unsaved-row' : ''
                        }
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
                        <span>Biểu Đồ Timeline</span>
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
                    maxWidth: '100%'
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

            <style>{`
                .status-pending {
                    background-color: #ffd666 !important;
                    color: #000;
                }
                .status-in-progress {
                    background-color: #69c0ff !important;
                    color: #000;
                }
                .status-completed {
                    background-color: #95de64 !important;
                    color: #000;
                }
                .vis-timeline {
                    border: none !important;
                    border: none;
                }
                .vis-item {
                    border-radius: 3px;
                    border: none !important;
                    height: auto !important;
                    min-height: 30px;
                    padding: 5px;
                }
                .vis-item .vis-item-content {
                    padding: 5px;
                    white-space: normal;
                }
                .vis-item .vis-item-overflow {
                    overflow: visible;
                }
                .vis-time-axis .vis-grid.vis-minor {
                    border-width: 1px;
                    border-color: #f0f0f0;
                }
                .vis-time-axis .vis-grid.vis-major {
                    border-width: 1px;
                    border-color: #e0e0e0;
                }
                .vis-panel.vis-center {
                    overflow-y: auto;
                }
                .vis-panel.vis-bottom {
                    overflow-y: hidden;
                }
                /* Style cho input date */
                input[type="date"] {
                    padding: 4px 11px;
                    font-size: 14px;
                    line-height: 1.5;
                    border: 1px solid #d9d9d9;
                }
                .unsaved-row {
                    background-color: #fafafa;
                }
                .unsaved-row td {
                    font-style: italic;
                }
                .unsaved-row input,
                .unsaved-row textarea {
                    border-color: #1890ff;
                }
                /* Style cho timeline items */
                .vis-timeline {
                    border: none !important;
                    background-color: #ffffff !important;
                }

                .vis-item {
                    border-radius: 4px !important;
                    border: none !important;
                    height: 28px !important;
                    line-height: 28px !important;
                    padding: 0 8px !important;
                    color: white !important;
                    font-weight: 500 !important;
                }

                /* Màu cho từng task */
                .custom-item-0 { background-color: #FF6B6B !important; }
                .custom-item-1 { background-color: #4ECDC4 !important; }
                .custom-item-2 { background-color: #45B7D1 !important; }
                .custom-item-3 { background-color: #96CEB4 !important; }
                .custom-item-4 { background-color: #FFEEAD !important; color: black !important; }
                .custom-item-5 { background-color: #D4A5A5 !important; }
                .custom-item-6 { background-color: #9FA4C4 !important; }
                .custom-item-7 { background-color: #B5EAD7 !important; color: black !important; }
                .custom-item-8 { background-color: #E2F0CB !important; color: black !important; }
                .custom-item-9 { background-color: #C7CEEA !important; color: black !important; }

                /* Style cho grid */
                .vis-grid.vis-vertical {
                    border-left: 1px dashed #e0e0e0;
                }

                .vis-panel.vis-center {
                    overflow-y: hidden !important;
                }

                /* Ẩn background của group */
                .vis-group {
                    background-color: transparent !important;
                    border: none !important;
                }

                /* Style cho text trong item */
                .vis-item .vis-item-content {
                    padding: 0 4px !important;
                    font-size: 12px !important;
                }

                .vis-time-axis .vis-text {
                    font-size: 12px !important;
                    color: #666 !important;
                }

                .vis-time-axis .vis-grid.vis-minor {
                    border-color: #f0f0f0 !important;
                }

                .vis-time-axis .vis-grid.vis-major {
                    border-color: #e0e0e0 !important;
                }

                /* Thêm các styles mới để kiểm soát chiều rộng */
                .ant-table {
                    width: 100% !important;
                    max-width: 100% !important;
                }

                .ant-table-container {
                    width: 100% !important;
                    max-width: 100% !important;
                }

                .ant-table-content {
                    width: 100% !important;
                    max-width: 100% !important;
                }

                .ant-table-body {
                    width: 100% !important;
                    max-width: 100% !important;
                }

                .ant-table-expanded-row-fixed {
                    width: 100% !important;
                    max-width: 100% !important;
                    position: relative !important;
                    left: auto !important;
                    overflow: hidden !important;
                }

                .ant-table-row-expand-icon-cell {
                    width: auto !important;
                    min-width: auto !important;
                }

                .ant-table-thead > tr > th {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .ant-table-tbody > tr > td {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Kiểm soát chiều rộng của input và textarea */
                .ant-input,
                .ant-input-textarea {
                    max-width: 100% !important;
                    width: 100% !important;
                }

                /* Ngăn chặn việc mở rộng của các phần tử con */
            `}</style>
        </div>
    );
};

export default SheetDashboard;