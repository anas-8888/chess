import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

document.documentElement.classList.add('dark');
document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'ar');

createRoot(document.getElementById("root")!).render(
  <App />
);
