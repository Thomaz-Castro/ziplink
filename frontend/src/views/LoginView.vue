<template>
  <div class="auth-page">
    <div class="card auth-card">
      <h1 class="auth-title">ZipLink</h1>
      <p class="auth-subtitle">Sign in to your account</p>

      <form @submit.prevent="handleLogin">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" required autofocus />
        </div>
        <div class="field">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:.5rem" :disabled="loading">
          {{ loading ? "Signing in…" : "Sign In" }}
        </button>
      </form>

      <p class="auth-footer">
        Don't have an account? <RouterLink to="/register">Register</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleLogin(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    await auth.login(email.value, password.value);
    router.push("/links");
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    error.value = e?.response?.data?.error ?? "Login failed";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
}
.auth-card { width: 100%; max-width: 400px; }
.auth-title { font-size: 2rem; font-weight: 700; color: var(--brand); text-align: center; }
.auth-subtitle { text-align: center; color: var(--text-muted); margin-bottom: 1.5rem; }
.field { margin-bottom: 1rem; }
.field label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: .35rem; }
.auth-footer { text-align: center; margin-top: 1rem; font-size: .9rem; color: var(--text-muted); }
</style>
