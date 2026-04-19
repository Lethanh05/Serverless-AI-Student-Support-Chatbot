// ============================================
// ROUTES/AUTH.JS - Đăng nhập nội bộ Chatbot (Phần đăng nhập 2 bước)
// ============================================
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPool } = require('../database');
const { encrypt, decrypt } = require('../crypto');
require('dotenv').config();

const router = express.Router();

/**
 * POST /api/auth/login
 * Option 2: Đăng nhập nội bộ, lưu MSSV và Mã hoá Password cho lần lấy portal sau
 */
router.post('/login', async (req, res) => {
  try {
    const { mssv, password } = req.body;

    if (!mssv || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ MSSV và Mật khẩu.' });
    }

    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM students WHERE mssv = ?', [mssv]);
    
    let studentId;
    let displayName = `Sinh viên ${mssv}`;
    let portalVerified = 0;

    if (rows.length === 0) {
      // CHƯA CÓ -> TỰ ĐỘNG ĐĂNG KÝ VÀ LƯU MẬT KHẨU MÃ HOÁ (Để sau này Bot Python gọi Portal)
      const encryptedPassword = encrypt(password);
      const [insertResult] = await pool.execute(
        'INSERT INTO students (mssv, password, display_name, portal_verified) VALUES (?, ?, ?, ?)',
        [mssv, encryptedPassword, displayName, 0]
      );
      studentId = insertResult.insertId;
      portalVerified = 0;
    } else {
      // ĐÃ CÓ -> KIỂM TRA MẬT KHẨU NỘI BỘ
      studentId = rows[0].id;
      displayName = rows[0].display_name;
      portalVerified = Number(rows[0].portal_verified || 0);

      let passwordMatched = false;
      try {
        const storedPasswordDecrypted = decrypt(rows[0].password);
        passwordMatched = password === storedPasswordDecrypted;
      } catch {
        // Tương thích dữ liệu cũ từng seed bằng bcrypt: nếu đúng thì migrate sang AES.
        const isLegacyBcrypt = await bcrypt.compare(password, rows[0].password);
        if (isLegacyBcrypt) {
          const encryptedPassword = encrypt(password);
          await pool.execute('UPDATE students SET password = ? WHERE id = ?', [encryptedPassword, studentId]);
          passwordMatched = true;
        }
      }

      if (!passwordMatched) {
        return res.status(401).json({ success: false, message: 'Sai mật khẩu đăng nhập Chatbot.' });
      }
    }

    // Tạo JWT token
    const token = jwt.sign(
      { id: studentId, mssv: mssv, display_name: displayName },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Trả về token
    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      student: {
        id: studentId,
        mssv: mssv,
        display_name: displayName,
        portal_verified: portalVerified
      }
    });

  } catch (error) {
    console.error('❌ Lỗi đăng nhập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
  }
});

module.exports = router;
