// ============================================
// AUTH MIDDLEWARE - Xác thực JWT Token
// ============================================
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware xác thực token
 * - Kiểm tra header: Authorization: Bearer <token>
 * - Giải mã token và gắn thông tin sinh viên vào req.student
 */
function authenticateToken(req, res, next) {
  // Lấy token từ header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" -> "TOKEN"

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Không tìm thấy token. Vui lòng đăng nhập.' 
    });
  }

  try {
    // Giải mã token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Gắn thông tin sinh viên vào request
    req.student = {
      id: decoded.id,
      mssv: decoded.mssv,
      display_name: decoded.display_name,
    };
    
    next(); // Cho phép đi tiếp
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token không hợp lệ hoặc đã hết hạn.' 
    });
  }
}

module.exports = authenticateToken;
