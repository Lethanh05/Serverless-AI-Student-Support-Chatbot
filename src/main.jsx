import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render( // Sử dụng StrictMode để phát hiện các vấn đề tiềm ẩn trong ứng dụng, giúp cải thiện chất lượng mã nguồn và đảm bảo tuân thủ các best practices của React
  <StrictMode>
    <App />
  </StrictMode>,
)
