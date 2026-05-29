import axios from "axios";

// Always relative — nginx (or Vite proxy in standalone dev) routes /api/* to the backend
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ziplink_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ziplink_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ token: string; user: unknown }>("/auth/register", { email, password }),
  login: (email: string, password: string) =>
    api.post<{ token: string; user: unknown }>("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
};

export const linksApi = {
  list: (params?: { page?: number; limit?: number; search?: string; sortBy?: "created_at" | "clicks"; active?: "true" | "false" }) =>
    api.get("/links", { params }),
  create: (data: { original_url: string; slug?: string; title?: string; expires_at?: string }) =>
    api.post("/links", data),
  update: (id: string, data: object) => api.patch(`/links/${id}`, data),
  remove: (id: string) => api.delete(`/links/${id}`),
  stats: () => api.get("/links/stats"),
};

export const batchApi = {
  submit: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/batch", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  status: (jobId: string) => api.get(`/batch/${jobId}`),
  list: () => api.get("/batch"),
};
