import axios from "axios";

// Unset means local development against the API on its own port; an empty string
// means the build is served behind one origin, so requests stay relative.
// The scheme follows the page, so a tunnel hostname, which is https, reaches the
// API over https as well.
const configuredBaseUrl = import.meta.env.VITE_API_URL;
const localDevBaseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
const baseURL = configuredBaseUrl === undefined ? localDevBaseUrl : configuredBaseUrl;

export const API_BASE_URL = baseURL;

// No default Content-Type: axios sets application/json for a plain object and a
// multipart boundary for FormData, and a blanket application/json header would
// make every document upload go out as JSON.
export const api = axios.create({
  baseURL,
  withCredentials: true,
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
