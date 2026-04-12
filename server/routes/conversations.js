// ============================================
// ROUTES/CONVERSATIONS.JS - Lịch sử tra cứu CRUD
// ============================================
const express = require('express');
const authenticateToken = require('../middleware/auth');
const { getPool } = require('../database');

const router = express.Router();

// Tất cả routes đều yêu cầu đăng nhập
router.use(authenticateToken);

/**
 * GET /api/conversations
 * Lấy danh sách cuộc hội thoại của sinh viên (mới nhất trước)
 */
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [conversations] = await pool.execute(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.student_id = ?
       ORDER BY c.updated_at DESC`,
      [req.student.id]
    );

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách conversations:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

/**
 * POST /api/conversations
 * Tạo đoạn chat mới
 */
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.execute(
      'INSERT INTO conversations (student_id, title) VALUES (?, ?)',
      [req.student.id, 'Đoạn chat mới']
    );

    const conversationId = result.insertId;

    // Thêm tin nhắn chào mừng từ bot
    await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type) VALUES (?, ?, ?, ?)',
      [conversationId, 'bot', 'Chào bạn! Mình là trợ lý ảo UTH. Bạn cần hỗ trợ gì?', 'TEXT']
    );

    
    const [rows] = await pool.execute(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Đã tạo đoạn chat mới!',
      conversation: rows[0]
    });
  } catch (error) {
    console.error(' Lỗi tạo conversation:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const conversationId = req.params.id;

    // Kiểm tra conversation thuộc về sinh viên này
    const [convRows] = await pool.execute(
      'SELECT * FROM conversations WHERE id = ? AND student_id = ?',
      [conversationId, req.student.id]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy cuộc hội thoại.' 
      });
    }

    // Lấy tất cả messages
    const [messages] = await pool.execute(
      'SELECT id, role, text, type, data, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );

    // Parse JSON data cho messages có type = TABLE
    const parsedMessages = messages.map(msg => ({
      ...msg,
      data: msg.data ? (typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data) : null,
    }));

    res.json({ 
      success: true, 
      conversation: convRows[0],
      messages: parsedMessages
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết conversation:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Xóa cuộc hội thoại
 */
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const conversationId = req.params.id;

    // Kiểm tra quyền sở hữu
    const [convRows] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND student_id = ?',
      [conversationId, req.student.id]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy cuộc hội thoại.' 
      });
    }

    // Xóa (CASCADE sẽ tự xóa messages)
    await pool.execute('DELETE FROM conversations WHERE id = ?', [conversationId]);

    res.json({ success: true, message: 'Đã xóa cuộc hội thoại.' });
  } catch (error) {
    console.error('❌ Lỗi xóa conversation:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

module.exports = router;
