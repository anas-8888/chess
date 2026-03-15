const getBaseOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  // fallback for non-browser contexts
  return "http://localhost:3003";
};

export const BASE_URL = getBaseOrigin();
export const API_BASE_URL = BASE_URL;

export const SOCKET_BASE_URL = API_BASE_URL;
