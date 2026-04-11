// ============================================
// ROUTES/AUTH.JS - Đăng nhập (Không có Đăng ký)
// ============================================
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../database');
require('dotenv').config();

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { mssv: string, password: string }
 * Response: { success, token, student: { id, mssv, display_name, faculty } }
 */
router.post('/login', async (req, res) => {
  try {
    const { mssv, password } = req.body;

    // Validate input
    if (!mssv || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng nhập đầy đủ MSSV và Mật khẩu.' 
      });
    }

    const pool = getPool();

    // Tìm sinh viên theo MSSV
    const [rows] = await pool.execute(
      'SELECT * FROM students WHERE mssv = ?', 
      [mssv]
    );

    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'MSSV không tồn tại trong hệ thống.' 
      });
    }

    const student = rows[0];

    // So sánh password với bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, student.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Mật khẩu không đúng.' 
      });
    }

    // Tạo JWT token (hết hạn sau 24 giờ)
    const token = jwt.sign(
      { 
        id: student.id, 
        mssv: student.mssv, 
        display_name: student.display_name 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Trả về token + thông tin sinh viên (không trả password)
    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      student: {
        id: student.id,
        mssv: student.mssv,
        display_name: student.display_name,
        faculty: student.faculty,
      }
    });

  } catch (error) {
    console.error('❌ Lỗi đăng nhập:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server. Vui lòng thử lại.' 
    });
  }
});

module.exports = router;
