import { useState } from 'react'; // Hook để quản lý state trong component
import { useNavigate } from 'react-router-dom'; // Hook để điều hướng giữa các trang trong ứng dụng, thay thế cho useHistory trong React Router v5

export default function Login() {
  const [mssv, setMssv] = useState(''); // State để lưu giá trị MSSV nhập vào
  const [password, setPassword] = useState(''); // State để lưu giá trị mật khẩu nhập vào
  const navigate = useNavigate(); // Hook để điều hướng giữa các trang trong ứng dụng 

  // Hàm xử lý khi bấm nút Đăng nhập
  const handleLogin = (e) => {
    e.preventDefault(); // Ngăn trang web load lại khi submit form
    
    // Giả lập kiểm tra: Chỉ cần nhập đủ MSSV và Password là cho qua
    if (mssv.trim() !== '' && password.trim() !== '') {
      // 1. Lưu một token giả vào localStorage của trình duyệt
      localStorage.setItem('token', 'uth-fake-jwt-token');
      
      // 2. Điều hướng người dùng sang trang Chat
      navigate('/chat');
    } else {
      alert("Vui lòng nhập đầy đủ MSSV và Mật khẩu!");
    }
  };

  return ( // Container chính của trang Login, sử dụng Flexbox để căn giữa nội dung
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {/* Tiêu đề Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">UTH PORTAL</h1>
          <p className="text-gray-500 mt-2">Hệ thống hỗ trợ sinh viên</p>
        </div>

        {/* Form đăng nhập */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mã số sinh viên (MSSV)</label>
            <input
              type="text" // Kiểu text cho MSSV
              value={mssv}
              maxLength={12} // Giới hạn MSSV tối đa 12 ký tự
              title="MSSV chỉ chứa số và tối đa 12 số" // Tooltip khi người dùng hover vào ô input
              onChange={(e) => { // Chỉ cho phép nhập số và giới hạn tối đa 12 ký tự cho MSSV
                const value = e.target.value; // Lấy giá trị nhập vào
                if (/^\d{0,12}$/.test(value)) { // Kiểm tra nếu chỉ chứa số và không vượt quá 12 ký tự
                  setMssv(value); // Cập nhật state MSSV nếu hợp lệ
                }
              }}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" // Các lớp Tailwind CSS để tạo kiểu cho ô input
              placeholder="Nhập MSSV của bạn..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
            <input
              type="password" // Kiểu password để ẩn ký tự khi nhập
              value={password}
              maxLength={6} // Giới hạn mật khẩu tối đa 6 ký tự
              title="Mật khẩu tối đa 6 ký tự" // Tooltip khi người dùng hover vào ô input
              onChange={(e) => { // Chỉ cho phép nhập tối đa 6 ký tự cho mật khẩu
                const value = e.target.value; // Lấy giá trị nhập vào
                if (value.length <= 6) { // Kiểm tra nếu độ dài không vượt quá 6 ký tự
                  setPassword(value); // Cập nhật state mật khẩu nếu hợp lệ
                }
              }}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" // Các lớp Tailwind CSS để tạo kiểu cho ô input
              placeholder="••••••••" // Placeholder hiển thị khi ô input rỗng, gợi ý người dùng nhập mật khẩu
            />
          </div>

          <button
            type="submit" // Kiểu submit để kích hoạt sự kiện onSubmit của form
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}