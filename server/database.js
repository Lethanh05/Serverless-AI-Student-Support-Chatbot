// ============================================
// DATABASE.JS - Kết nối MySQL + Tự động tạo bảng
// ============================================
const mysql = require('mysql2/promise');
const { encrypt } = require('./crypto');
require('dotenv').config();

// Tạo Connection Pool (tối ưu cho production/cloud)
let pool;

function getConnectionBaseConfig() {
  const socketPath = process.env.DB_SOCKET_PATH
    || (process.env.INSTANCE_CONNECTION_NAME ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}` : null);

  const base = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };

  if (socketPath) {
    base.socketPath = socketPath;
  } else {
    base.host = process.env.DB_HOST || '127.0.0.1';
    if (process.env.DB_PORT) {
      base.port = Number(process.env.DB_PORT);
    }
  }

  return base;
}

function getConnectionConfig(includeDatabase = false) {
  const config = getConnectionBaseConfig();
  if (includeDatabase) {
    config.database = process.env.DB_NAME;
  }
  return config;
}

function isBootstrapEnabled() {
  const value = String(process.env.DB_BOOTSTRAP ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no'].includes(value);
}


async function initDatabase() {
  const shouldBootstrap = isBootstrapEnabled();

  // 1. Kết nối MySQL (chưa chọn database) để tạo database
  if (shouldBootstrap) {
    const tempConnection = await mysql.createConnection(getConnectionConfig(false));

    await tempConnection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await tempConnection.end();
  }

  // 2. Tạo connection pool với database đã chọn
  pool = mysql.createPool({
    ...getConnectionConfig(true),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
  });

  if (shouldBootstrap) {
    // 3. Tạo các bảng
    await createTables();

    // 4. Seed dữ liệu sinh viên mẫu
    await seedStudents();

    console.log('Database đã sẵn sàng!');
    return;
  }

  console.log('Database pool đã sẵn sàng (DB_BOOTSTRAP=false).');
}

/**
 * Tạo các bảng: students, conversations, messages
 */
async function createTables() {
  // Bảng sinh viên (tài khoản từ UTH Portal)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mssv VARCHAR(20) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      faculty VARCHAR(100),
      portal_verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration cho DB cũ: thêm cột portal_verified nếu chưa có
  const [verifiedColumn] = await pool.execute("SHOW COLUMNS FROM students LIKE 'portal_verified'");
  if (verifiedColumn.length === 0) {
    await pool.execute('ALTER TABLE students ADD COLUMN portal_verified TINYINT(1) NOT NULL DEFAULT 0');
  }

  // Bảng cuộc hội thoại
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      title VARCHAR(255) DEFAULT 'Đoạn chat mới',
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      pinned_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Migration cho DB cũ: thêm cột ghim hội thoại nếu chưa có
  const [pinnedColumn] = await pool.execute("SHOW COLUMNS FROM conversations LIKE 'is_pinned'");
  if (pinnedColumn.length === 0) {
    await pool.execute('ALTER TABLE conversations ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0');
  }

  const [pinnedAtColumn] = await pool.execute("SHOW COLUMNS FROM conversations LIKE 'pinned_at'");
  if (pinnedAtColumn.length === 0) {
    await pool.execute('ALTER TABLE conversations ADD COLUMN pinned_at TIMESTAMP NULL DEFAULT NULL');
  }

  // Bảng tin nhắn
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      role ENUM('user', 'bot') NOT NULL,
      text TEXT NOT NULL,
      type ENUM('TEXT', 'TABLE') DEFAULT 'TEXT',
      data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  console.log('📋 Các bảng đã được tạo/kiểm tra.');
}

/**
 * Seed dữ liệu sinh viên mẫu (mô phỏng tài khoản UTH Portal)
 */
async function seedStudents() {
  const students = [
    { mssv: 'admin', password: '123456', display_name: 'Admin', faculty: null, portal_verified: 0 },
   
  ];

  for (const student of students) {
    // Kiểm tra đã tồn tại chưa
    const [existing] = await pool.execute('SELECT id FROM students WHERE mssv = ?', [student.mssv]);
    
    if (existing.length === 0) {
      // Mã hóa 2 chiều để bot Python có thể giải mã dùng lại khi gọi portal
      const encryptedPassword = encrypt(student.password);
      
      await pool.execute(
        'INSERT INTO students (mssv, password, display_name, faculty, portal_verified) VALUES (?, ?, ?, ?, ?)',
        [student.mssv, encryptedPassword, student.display_name, student.faculty, student.portal_verified]
      );
      console.log(`👤 Đã thêm sinh viên: ${student.mssv} - ${student.display_name}`);
    }
  }
}

/**
 * Lấy connection pool
 */
function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool };
