const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const pdfRoutes = require("./routes/pdfRoutes");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const sheetRoutes = require('./routes/sheetRoutes');
const projectRoutes = require("./routes/projectRoutes");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Thêm middleware để phục vụ static files từ frontend build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// API routes
app.use("/api/pdf", pdfRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use('/api/sheets', sheetRoutes);
app.use("/api/projects", projectRoutes);

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.use((req, res) => {
    res.status(404).json({ error: "Không tìm thấy route này!" });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    console.log(`🚀 Server đang chạy tại:`);
    console.log(`- Local: http://localhost:${address.port}`);
    console.log(`- Network: http://${address.address}:${address.port}`);
    console.log(`- PORT được sử dụng: ${address.port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} đã được sử dụng. Vui lòng thử port khác.`);
    } else {
        console.error('❌ Lỗi khi khởi động server:', err);
    }
    process.exit(1);
});
