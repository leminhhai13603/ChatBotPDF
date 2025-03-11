import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Input, Space, Button, Table, message } from 'antd';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import { SaveOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SheetDashboard = () => {
    const [data, setData] = useState([]);
    const timelineRef = useRef(null);
    const containerRef = useRef(null);
    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

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

    const fetchTasks = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/auth/timeline/tasks`,
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            setData(response.data);
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu:', error);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
    }, []);

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
            console.log('Deleting task with ID:', id);
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
                
                if (timelineRef.current) {
                    try {
                        timelineRef.current.setItems(
                            data.filter(item => item.id !== id)
                        );
                    } catch (e) {
                        console.error('Lỗi khi cập nhật timeline:', e);
                    }
                }

                await fetchTasks();
                
                console.log('Xóa task thành công:', response.data);
            }
        } catch (error) {
            console.error('Lỗi chi tiết khi xóa:', error.response?.data || error);
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
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    };

    const handleCellChange = (id, field, value) => {
        setData(prevData => 
            prevData.map(item => {
                if (item.id === id) {
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
                    style={{ width: '100%' }}
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
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        
        const newTask = {
            id: 'temp_' + Date.now(),
            step: '',
            assignee: '',
            notes: '',
            start_date: formattedDate,
            end_date: formattedDate,
            status: 'Pending'
        };
        
        setData(prevData => [...prevData, newTask]);
    };

    useEffect(() => {
        console.log('Data hiện tại:', data);
    }, [data]);

    const handleSave = async () => {
        try {
            const token = localStorage.getItem("token");
            
            const tasksToUpdate = data.map(task => {
                const startDate = new Date(task.start_date);
                const endDate = new Date(task.end_date);
                startDate.setDate(startDate.getDate() + 1);
                endDate.setDate(endDate.getDate() + 1);

                if (task.id?.toString().startsWith('temp_') || !task.id) {
                    return {
                        step: task.step || '',
                        assignee: task.assignee || '',
                        notes: task.notes || '',
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        status: 'Pending'
                    };
                }
                
                return {
                    id: task.id,
                    step: task.step,
                    assignee: task.assignee,
                    notes: task.notes,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    status: task.status || 'Pending'
                };
            });

            console.log('Dữ liệu gửi lên server:', tasksToUpdate);

            const response = await axios.post(
                `${API_BASE_URL}/auth/timeline/tasks/batch`,
                { tasks: tasksToUpdate },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            message.success('Đã lưu thành công');
            await fetchTasks();
        } catch (error) {
            console.error('Lỗi khi lưu:', error);
            message.error('Lỗi khi lưu dữ liệu: ' + (error.response?.data?.details || error.message));
        }
    };

    return (
        <div style={{ 
            padding: '0', 
            height: '100vh', 
            display: 'flex', 
            gap: '20px',
            overflow: 'hidden'  
        }}>
            {/* Bảng bên trái */}
            <Card 
                title="Danh Sách Công Việc"
                style={{ 
                    flex: '0 0 50%',
                    borderRadius: 0,
                    height: '100vh',
                    overflow: 'auto' 
                }}
                extra={
                    <Space>
                        <Button
                            type="default"
                            icon={<PlusOutlined />}
                            onClick={handleAddRow}
                        >
                            Thêm dòng mới
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
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
                    scroll={{ y: 'calc(100vh - 250px)', x: 'max-content' }}
                    rowClassName={(record) => 
                        record.id?.toString().startsWith('temp_') ? 'unsaved-row' : ''
                    }
                    bordered
                    size="small"
                    style={{ marginTop: '16px' }}
                />
            </Card>

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
                    overflow: 'hidden'  
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
            `}</style>
        </div>
    );
};

export default SheetDashboard;