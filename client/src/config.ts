const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);

export const API_BASE = import.meta.env.VITE_API_BASE || (isLocal ? 'http://localhost:3001' : 'https://family-chat-2flf.onrender.com');
export const WS_BASE = import.meta.env.VITE_WS_BASE || (isLocal ? 'ws://localhost:3001' : 'wss://family-chat-2flf.onrender.com');

