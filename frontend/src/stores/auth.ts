import { defineStore } from "pinia";
import { ref } from "vue";
import { authApi } from "../api/client";

interface User {
  id: string;
  email: string;
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem("ziplink_token"));
  const user = ref<User | null>(null);

  async function login(email: string, password: string): Promise<void> {
    const res = await authApi.login(email, password);
    token.value = res.data.token;
    user.value = res.data.user as User;
    localStorage.setItem("ziplink_token", res.data.token);
  }

  async function register(email: string, password: string): Promise<void> {
    const res = await authApi.register(email, password);
    token.value = res.data.token;
    user.value = res.data.user as User;
    localStorage.setItem("ziplink_token", res.data.token);
  }

  async function fetchMe(): Promise<void> {
    if (!token.value) return;
    try {
      const res = await authApi.me();
      user.value = (res.data as { user: User }).user;
    } catch {
      logout();
    }
  }

  function logout(): void {
    token.value = null;
    user.value = null;
    localStorage.removeItem("ziplink_token");
  }

  const isLoggedIn = (): boolean => !!token.value;

  return { token, user, login, register, logout, fetchMe, isLoggedIn };
});
