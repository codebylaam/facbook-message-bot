import axios from "axios";

// Unset means local development against the API on its own port; an empty string
// means the build is served behind one origin, so requests stay relative.
const configuredBaseUrl = import.meta.env.VITE_API_URL;
const baseURL = configuredBaseUrl === undefined ? "http://localhost:3000" : configuredBaseUrl;

export const API_BASE_URL = baseURL;

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const { pathname } = window.location;
      if (pathname !== "/sign-in") {
        window.location.assign("/sign-in");
      }
    }

    return Promise.reject(error);
  },
);
