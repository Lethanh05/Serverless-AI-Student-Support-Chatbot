import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Chat from './pages/Chat';

// COMPONENT AUTH GUARD (Người gác cổng)
// Nhiệm vụ: Kiểm tra xem user có token chưa. Chưa có thì đuổi về trang Login.
const ProtectedRoute = ({ children }) => { // Lấy token từ trình duyết
  // Lấy token từ trình duyệt
  const token = localStorage.getItem('token');
  
  if (!token) {
    // Nếu không có token -> Chuyển hướng (Navigate) về trang chủ "/"
    // Thuộc tính replace giúp xóa lịch sử trang hiện tại, user bấm Back sẽ không quay lại trang chat được
    return <Navigate to="/" replace />;
  }
  
  // Nếu có token -> Cho phép render Component con (trang Chat)
  return children;
};

// COMPONENT CHÍNH
// Nhiệm vụ: Khai báo các đường dẫn (Router) của ứng dụng
export default function App() { // Sử dụng BrowserRouter để quản lý các tuyến đường trong ứng dụng, Routes để định nghĩa các tuyến đường và Route để xác định thành phần nào sẽ được hiển thị cho mỗi tuyến đướng
  return (
    <BrowserRouter>
      <Routes>
        {/* Đường dẫn mặc định: Mở trang Đăng nhập */}
        <Route path="/" element={<Login />} />
        
        {/* Đường dẫn /chat: Được bọc bởi ProtectedRoute để bảo vệ */}
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}