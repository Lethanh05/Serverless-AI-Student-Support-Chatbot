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

function parseAllowedOrigins() {
  const rawOrigins = process.env.CORS_ORIGINS;
  if (!rawOrigins) {
    return ['http://localhost:5173', 'http://localhost:4173'];
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

// ============ MIDDLEWARE ============

// CORS - Cho phép frontend kết nối
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server tools (no Origin) and configured browser origins.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Parse JSON body
app.use(express.json());

// ============ ROUTES ============

// Auth routes (đăng nhập)
app.use('/api/auth', authRoutes);
app.use('/api/portal', require('./routes/portal'));

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
      console.log(' ================================');
      console.log(` UTH Chatbot Server`);
      console.log(` Port: ${PORT}`);
      console.log(` API: http://localhost:${PORT}/api`);
      console.log(` Health: http://localhost:${PORT}/api/health`);
      console.log(` CORS origins: ${allowedOrigins.join(', ')}`);
      console.log(' ================================');
    });
  } catch (error) {
    console.error('Không thể khởi động server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
