const DEFAULT_API_BASE_URL = 'http://localhost:3003';

export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;
export const SOCKET_BASE_URL = API_BASE_URL;
