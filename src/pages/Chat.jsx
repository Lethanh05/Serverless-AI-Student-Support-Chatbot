import React, { useState, useEffect, useRef } from 'react'; // Các hook cần thiết để quản lý state, hiệu ứng và tham chiếu DOM
import { Send, User, Bot, History, GraduationCap, MoreHorizontal, Pin, Edit2, Trash } from 'lucide-react'; // Các icon từ thư viện lucide-react để sử dụng trong giao diện
import ScheduleTable from '../components/RichUI'; // Component con để hiển thị bảng lịch học, được tách riêng để tái sử dụng và giữ mã sạch sẽ

function Chat() { // Component chính của trang Chat, nơi người dùng tương tác với chatbot
  const [messages, setMessages] = useState([ // State để lưu trữ các tin nhắn trong đoạn chat, khởi tạo với một tin nhắn chào mừng có bảng lịch học mẫu
    { 
      role: 'bot', 
      text: 'Chào Bạn! Đây là lịch học của bạn:', 
      type: 'TABLE', 
      data: [
        { date:'13/4/2026',subject: 'Lập trình Web', room: 'C.201', time: '07:30' },
        { date:'14/4/2026', subject: 'Mạng máy tính', room: 'A.105', time: '13:00' }
      ] 
    }
  ]);
  const [input, setInput] = useState(''); // State để lưu trữ giá trị của ô input khi người dùng nhập tin nhắn mới
  const [isLoading, setIsLoading] = useState(false); // State để quản lý trạng thái đang tải khi chatbot đang xử lý câu hỏi của người dùng
  const [showMenu, setShowMenu] = useState(null); // Để null để quản lý menu theo ID
  const messagesEndRef = useRef(null); // Ref để tham chiếu đến phần tử cuối cùng trong danh sách tin nhắn, dùng để tự động cuộn xuống khi có tin nhắn mới
  const [headerTitle, setHeaderTitle] = useState('Lịch học tuần này của bạn.');

  const scrollToBottom = () => { // Hàm để cuộn xuống phần tử cuối cùng của danh sách tin nhắn mỗi khi có tin nhắn mới hoặc trạng thái tải thay đổi
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); // Sử dụng optional chaining để đảm bảo không lỗi nếu ref chưa được gán, và cuộn mượt mà đến phần tử cuối cùng
  };
 
  useEffect(() => { // Hiệu ứng này sẽ chạy mỗi khi mảng messages hoặc trạng thái isLoading thay đổi, đảm bảo rằng giao diện luôn cuộn xuống tin nhắn mới nhất
    scrollToBottom();
  }, [messages, isLoading]); 

  useEffect(() => { // Hiệu ứng này để lắng nghe sự kiện click trên toàn bộ cửa sổ, nhằm đóng menu khi người dùng click ra ngoài
    const closeMenu = () => setShowMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu); // Dọn dẹp sự kiện khi component unmount để tránh rò rỉ bộ nhớ
  }, []);

const createNewChat = () => { // Hàm để tạo một đoạn chat mới, sẽ reset mảng tin nhắn chỉ với một tin nhắn chào mừng và bảng lịch học
  // Tìm bảng lịch học đầu tiên (hoặc cuối cùng) trong danh sách tin nhắn cũ
  const firstSchedule = messages.find(msg => msg.type === 'TABLE');
  
  const newStartMessages = [  // Tin nhắn chào mừng mới khi tạo đoạn chat mới, có thể tùy chỉnh lại nội dung để phù hợp với ngữ cảnh hơn
    { role: 'bot', text: 'Đã làm mới đoạn chat! Bạn có thể đặt câu hỏi mới', type: 'TEXT' }
  ];

  // Nếu tìm thấy bảng thì mới thêm vào mảng tin nhắn mới
  if (firstSchedule) { // Kiểm tra nếu tìm thấy bảng lịch học trong tin nhắn cũ
    newStartMessages.push(firstSchedule);
  }

  setMessages(newStartMessages); // Cập nhật state messages với mảng tin nhắn mới, bắt đầu bằng tin nhắn chào mừng và có thể kèm theo bảng lịch học nếu tìm thấy
  setHeaderTitle('Lịch học tuần này của bạn.'); // Reset tiêu đề header về mặc định khi tạo đoạn chat mới
  setInput('');
};

  const handleSend = () => {
    if (!input.trim()) return; // Nếu ô input trống hoặc chỉ chứa khoảng trắng, không gửi tin nhắn và trả về ngay
    //const userMsg = { role: 'user', text: input, type: 'TEXT' }; // Tạo một đối tượng tin nhắn mới với vai trò là người dùng và loại là văn bản
    //setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    setHeaderTitle(input); // Cập nhật tiêu đề header bằng nội dung câu hỏi của người dùng để tạo cảm giác tương tác và phản hồi trực tiếp với câu hỏi đó
    const userMsg = { role: 'user', text: input, type: 'TEXT' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => { // Giả lập thời gian phản hồi của chatbot, sau 1 giây sẽ trả lời dựa trên nội dung câu hỏi của người dùng
      setIsLoading(false);  // Kết thúc trạng thái tải, cho phép hiển thị câu trả lời của chatbot
      if (input.includes("lịch học")) { // Nếu câu hỏi của người dùng có chứa từ "lịch học", chatbot sẽ trả lời bằng một bảng lịch học mẫu
        setMessages(prev => [...prev, { // Thêm tin nhắn mới vào mảng messages, với vai trò là bot, loại là bảng và dữ liệu mẫu cho lịch học
          role: 'bot',
          text: 'Đây là lịch học tuần này của Bạn:',
          type: 'TABLE',
          data: [
            { date:'13/4/2026',subject: 'Lập trình Web', room: 'C.201', time: '07:30' },
            { date:'14/4/2026',subject: 'Mạng máy tính', room: 'A.105', time: '13:00' },
          ]
        }]);
      } else { // Nếu câu hỏi không chứa từ khóa "lịch học", chatbot sẽ trả lời bằng một tin nhắn văn bản đơn giản, phản hồi lại câu hỏi của người dùng để tạo cảm giác tương tác
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: `Bạn vừa hỏi về "${input}". Hiện tại mình đang kết nối dữ liệu từ UTH Portal...`,
          type: 'TEXT'
        }]);
      }
    }, 1000); // Thời gian giả lập 1 giây để chatbot "xử lý" câu hỏi và trả lời, tạo cảm giác thực tế hơn khi tương tác với chatbot
  };

  return ( // Container chính của trang Chat, sử dụng Flexbox để chia thành hai phần: sidebar bên trái và vùng chat chính bên phải
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* SIDEBAR - Thanh màu xanh bên trái */}
      <div className="w-72 bg-[#003580] text-white p-6 hidden md:flex flex-col shadow-xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-white p-2 rounded-lg">
            <GraduationCap className="text-[#003580]" size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">UTH CHATBOT</h1>
        </div>
        
        <button 
          onClick={createNewChat}
          className="w-full bg-blue-600 hover:bg-blue-500 transition-colors py-3 rounded-xl font-medium mb-8 shadow-lg flex items-center justify-center gap-2"
        >
          + Đoạn chat mới
        </button>

        {/* PHẦN LỊCH SỬ TRA CỨU */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-4">Lịch sử tra cứu</p>
          
          {[
            { id: 1, title: 'Lịch học tuần này' }, // Đây là dữ liệu mẫu cho phần lịch sử tra cứu, mỗi mục có một ID duy nhất để quản lý trạng thái hiển thị menu
            { id: 2, title: 'Điểm số học kỳ' },
            { id: 3, title: 'Phòng thi cuối kỳ' }
          ].map((item) => ( // Duyệt qua mảng dữ liệu lịch sử tra cứu và hiển thị từng mục, mỗi mục có thể click để hiện menu tùy chọn (ghim, sửa, xóa)
            <div key={item.id} className="group flex items-center justify-between p-3 hover:bg-blue-800/50 rounded-lg cursor-pointer transition-all relative">
              <div className="flex items-center gap-3">
                <History size={18} className="text-blue-400" />
                <span className="text-sm">{item.title}</span>
              </div>

              <div className="relative">
                <button
                  onClick={(e) => { // Ngăn chặn sự kiện click lan ra ngoài để tránh đóng menu ngay khi vừa mở
                    e.stopPropagation(); // Nếu menu đang mở cho mục này, đóng nó; nếu đang đóng, mở nó
                    setShowMenu(showMenu === item.id ? null : item.id); // Cập nhật trạng thái showMenu dựa trên ID của mục được click, nếu đã mở thì đóng, nếu chưa mở thì mở menu cho mục đó
                  }}
                  className="p-1 hover:bg-blue-700 rounded-md transition-all opacity-0 group-hover:opacity-100"
                >
                  <MoreHorizontal size={18} className="text-blue-300" />
                </button>

                {showMenu === item.id && (
                  <div className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-2xl py-2 z-50 text-gray-800 border">
                    <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-xs font-medium"><Pin size={14} /> Ghim</button>
                    <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-xs font-medium"><Edit2 size={14} /> Sửa</button>
                    <div className="border-t my-1"></div>
                    <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-xs font-medium text-red-600"><Trash size={14} /> Xóa</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* PHẦN THÔNG TIN SINH VIÊN */}
        <div className="pt-6 border-t text-white mt-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold">
              <User size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold">Văn A</p>
              <p className="text-xs text-blue-300">Sinh viên - UTH</p>
            </div>
          </div>
        </div>
      </div>

      {/* VÙNG CHAT CHÍNH */} 
      <div className="flex-1 flex flex-col relative">
        <header className="h-16 bg-white border-b flex items-center px-8 shadow-sm justify-between">
          {/*<span className="font-bold text-blue-900">Lịch học tuần này của bạn.</span>*/}
          <span className="font-bold text-blue-900">{headerTitle}</span> {/* Hiển thị tiêu đề header, có thể thay đổi dựa trên câu hỏi của người dùng để tạo cảm giác tương tác */}
          <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Hệ thống sẵn sàng</div> 
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'bot' && <Bot size={20} className="text-blue-600 mt-1" />}
              <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border rounded-tl-none'}`}>
                <p className="text-sm">{msg.text}</p>
                {msg.type === 'TABLE' && (
                  <div className="mt-3"><ScheduleTable data={msg.data} /></div>
                )}
              </div>
              {msg.role === 'user' && <User size={20} className="text-blue-600 mt-1" />}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start items-center gap-2 animate-pulse">
              <Bot size={20} className="text-blue-600" />
              <div className="bg-gray-100 p-3 rounded-lg text-xs">Đang xử lý...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ô NHẬP TIN NHẮN */}
        <div className="p-6 bg-white border-t">
          <div className="max-w-4xl mx-auto relative">
            <input 
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi về lịch học, điểm số..."
              className="w-full p-4 pr-16 border-2 border-slate-200 rounded-2xl focus:border-blue-600 bg-slate-50 outline-none"
            />
            <button onClick={handleSend} className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;