const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

export const API_BASE = import.meta.env.VITE_API_BASE || `${isHttps ? 'https:' : 'http:'}//${host}:3001`;
export const WS_BASE = import.meta.env.VITE_WS_BASE || `${isHttps ? 'wss:' : 'ws:'}//${host}:3001`;
