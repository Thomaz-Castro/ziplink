<template>
  <div class="auth-page">
    <div class="card auth-card">
      <h1 class="auth-title">ZipLink</h1>
      <p class="auth-subtitle">{{ t.auth.register.subtitle }}</p>

      <form @submit.prevent="handleRegister">
        <div class="field">
          <label>{{ t.auth.emailLabel }}</label>
          <input v-model="email" type="email" :placeholder="t.auth.emailPlaceholder" required />
        </div>
        <div class="field">
          <label>{{ t.auth.passwordLabel }} <small>({{ t.auth.passwordHint }})</small></label>
          <input v-model="password" type="password" placeholder="••••••••" required minlength="8" />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:.5rem" :disabled="loading">
          {{ loading ? t.auth.register.submitting : t.auth.register.submit }}
        </button>
      </form>

      <p class="auth-footer">
        {{ t.auth.register.footer }} <RouterLink to="/login">{{ t.auth.register.footerLink }}</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import t from "../i18n";

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleRegister(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    await auth.register(email.value, password.value);
    router.push("/links");
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    error.value = e?.response?.data?.error ?? t.auth.register.errorFallback;
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

@media (max-width: 480px) {
  .auth-page { align-items: flex-start; padding-top: 2rem; }
  .auth-card { border-radius: 0; border-left: none; border-right: none; box-shadow: none; }
}
</style>
