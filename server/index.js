// ============================================
// INDEX.JS - Entry Point Server
// ============================================
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 3001;

// ============ MIDDLEWARE ============

// CORS - Cho phép frontend kết nối
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite dev + production
  credentials: true,
}));

// Parse JSON body
app.use(express.json());

// ============ ROUTES ============

// Auth routes (đăng nhập)
app.use('/api/auth', authRoutes);

// Conversation routes (lịch sử tra cứu)
app.use('/api/conversations', conversationRoutes);

// Message routes (gửi/nhận tin nhắn)
app.use('/api/conversations', messageRoutes);

// Health check (kiểm tra server hoạt động)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'UTH Chatbot Server đang hoạt động!',
    timestamp: new Date().toISOString()
  });
});

// ============ START SERVER ============

async function startServer() {
  try {
    // Khởi tạo database (tạo bảng + seed data)
    await initDatabase();

    // Khởi động server
    app.listen(PORT, () => {
      console.log('🚀 ================================');
      console.log(`🚀 UTH Chatbot Server`);
      console.log(`🚀 Port: ${PORT}`);
      console.log(`🚀 API: http://localhost:${PORT}/api`);
      console.log(`🚀 Health: http://localhost:${PORT}/api/health`);
      console.log('🚀 ================================');
    });
  } catch (error) {
    console.error('❌ Không thể khởi động server:', error);
    process.exit(1);
  }
}

startServer();
