import React, { useState, useEffect, useRef } from 'react';
import { Send, User, History, GraduationCap } from 'lucide-react';
import ScheduleTable from '../components/RichUI';
import uthLogo from '../assets/logo/Logo_UTH.png';

function Chat() {
  const [messages, setMessages] = useState([
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
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const createNewChat = () => {
  // Lọc ra những tin nhắn là Bảng để giữ lại, còn lại thì bỏ hết
  const scheduleMessages = messages.filter(msg => msg.type === 'TABLE');
  
  setMessages([
    { role: 'bot', text: 'Đã làm mới đoạn chat! Bạn có thể đặt câu hỏi mới', type: 'TEXT' },
    ...scheduleMessages // Đưa các bảng lịch học cũ vào lại danh sách mới
  ]);
  
  setInput('');
};

  const handleSend = () => {
    if (!input.trim()) return;

    // 1. Thêm tin nhắn của User
    const userMsg = { role: 'user', text: input, type: 'TEXT' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // 2. Xử lý phản hồi của Bot
    setTimeout(() => {
      setIsLoading(false);
      
      if (input.includes("lịch học")) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: 'Đây là lịch học tuần này của Bạn:',
          type: 'TABLE',
          data: [
            { subject: 'Lập trình Web', room: 'C.201', time: '07:30' },
            { subject: 'Mạng máy tính', room: 'A.105', time: '13:00' },
          ]
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: `Bạn vừa hỏi về "${input}". Hiện tại mình đang kết nối dữ liệu từ UTH Portal, Bạn chờ xíu nhé!`,
          type: 'TEXT'
        }]);
      }
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar - Dùng GraduationCap và History ở đây giúp import sáng lên */}
      <div className="w-72 bg-[#003580] text-white p-6 hidden md:flex flex-col shadow-xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-1 rounded-lg">
            <img src={uthLogo} alt="UTH Logo" className="w-25 h-10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CHATBOT</h1>
        </div>
        
        <button 
  onClick={createNewChat} // <-- Thêm dòng này vào đây
  className="w-full bg-blue-600 hover:bg-blue-500 transition-colors py-3 rounded-xl font-medium mb-8 shadow-lg flex items-center justify-center gap-2"
>
  + Đoạn chat mới
</button>
  

        <div className="flex-1 overflow-y-auto">
          <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-4">Lịch sử tra cứu</p>
          <div className="flex items-center gap-3 p-3 hover:bg-blue-800/50 rounded-lg cursor-pointer transition-all">
            <History size={18} className="text-blue-400" />
            <span className="text-sm">Lịch học tuần này</span>
          </div>
        </div>

        <div className="pt-6 border-t border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">A</div>
            <div>
              <p className="text-sm font-bold">Văn A</p>
              <p className="text-xs text-blue-300">Sinh viên - UTH</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vùng Chat chính */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-16 bg-white border-b flex items-center px-8 shadow-sm justify-between">
          <span className="font-bold text-blue-900">Hỗ trợ đào tạo & Quản lý sinh viên</span>
          <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Hệ thống sẵn sàng</div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'bot' && (
                <img
                  src={uthLogo}
                  alt="Bot avatar"
                  className="w-8 h-8 rounded-full object-contain mt-1 bg-white border border-slate-200"
                />
              )}
              
              <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border rounded-tl-none'
              }`}>
                <p className="text-sm">{msg.text}</p>
                {/* Dùng ScheduleTable ở đây giúp import sáng lên */}
                {msg.type === 'TABLE' && (
                  <div className="mt-3">
                    <ScheduleTable data={msg.data} />
                  </div>
                )}
              </div>

              {msg.role === 'user' && <User size={20} className="text-gray-400 mt-1" />}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start items-center gap-2">
              <img
                src={uthLogo}
                alt="Bot avatar"
                className="w-6 h-6 rounded-full object-contain bg-white border border-slate-200"
              />
              <div className="bg-gray-100 p-3 rounded-lg animate-pulse text-xs">Đang xử lý...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t">
          <div className="max-w-4xl mx-auto relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi về lịch học, điểm số hoặc phòng thi..."
              className="w-full p-4 pr-16 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-600 bg-slate-50"
            />
            <button 
              onClick={handleSend} 
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700"
            >
              {/* Dùng Send ở đây giúp import sáng lên */}
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3 italic">
            Dữ liệu được cập nhật trực tiếp từ UTH Portal
          </p>
        </div>
      </div>
    </div>
  );
}

export default Chat;