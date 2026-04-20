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
      `SELECT c.id, c.title, c.is_pinned, c.pinned_at, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.student_id = ?
       ORDER BY c.is_pinned DESC, c.pinned_at DESC, c.updated_at DESC`,
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

    const [studentRows] = await pool.execute(
      'SELECT display_name, faculty FROM students WHERE id = ?',
      [req.student.id]
    );

    const studentName = studentRows[0]?.display_name || req.student.display_name || 'bạn';
    const studentFaculty = studentRows[0]?.faculty || req.student.faculty;
    const welcomeText = studentFaculty
      ? `Chào ${studentName}! Mình là trợ lý ảo UTH. Mình đã nhận diện bạn thuộc ngành ${studentFaculty}. Bạn cần hỗ trợ gì?`
      : `Chào ${studentName}! Mình là trợ lý ảo UTH. Bạn cần hỗ trợ gì?`;

    // Thêm tin nhắn chào mừng từ bot
    await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type) VALUES (?, ?, ?, ?)',
      [conversationId, 'bot', welcomeText, 'TEXT']
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
    console.error(' Lỗi lấy chi tiết conversation:', error);
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

/**
 * PATCH /api/conversations/:id/title
 * Đổi tên cuộc hội thoại
 */
router.patch('/:id/title', async (req, res) => {
  try {
    const pool = getPool();
    const conversationId = req.params.id;
    const nextTitle = String(req.body?.title || '').trim();

    if (!nextTitle) {
      return res.status(400).json({ success: false, message: 'Tên cuộc hội thoại không được để trống.' });
    }

    const safeTitle = nextTitle.length > 120 ? nextTitle.slice(0, 120) : nextTitle;

    const [convRows] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND student_id = ?',
      [conversationId, req.student.id]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc hội thoại.' });
    }

    await pool.execute(
      'UPDATE conversations SET title = ? WHERE id = ?',
      [safeTitle, conversationId]
    );

    const [updatedRows] = await pool.execute(
      'SELECT id, title, is_pinned, pinned_at, created_at, updated_at FROM conversations WHERE id = ?',
      [conversationId]
    );

    return res.json({ success: true, message: 'Đổi tên cuộc hội thoại thành công.', conversation: updatedRows[0] });
  } catch (error) {
    console.error('❌ Lỗi đổi tên conversation:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

/**
 * PATCH /api/conversations/:id/pin
 * Ghim/Bỏ ghim cuộc hội thoại
 */
router.patch('/:id/pin', async (req, res) => {
  try {
    const pool = getPool();
    const conversationId = req.params.id;
    const isPinned = Number(req.body?.isPinned ? 1 : 0);

    const [convRows] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND student_id = ?',
      [conversationId, req.student.id]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc hội thoại.' });
    }

    await pool.execute(
      `UPDATE conversations
       SET is_pinned = ?, pinned_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ?`,
      [isPinned, isPinned, conversationId]
    );

    const [updatedRows] = await pool.execute(
      'SELECT id, title, is_pinned, pinned_at, created_at, updated_at FROM conversations WHERE id = ?',
      [conversationId]
    );

    return res.json({
      success: true,
      message: isPinned ? 'Đã ghim cuộc hội thoại.' : 'Đã bỏ ghim cuộc hội thoại.',
      conversation: updatedRows[0],
    });
  } catch (error) {
    console.error('❌ Lỗi ghim conversation:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

module.exports = router;
