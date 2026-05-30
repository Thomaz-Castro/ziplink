<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <img src="../assets/logo.png" alt="ZipLink Logo" class="logo-img" />
        <span>ZipLink</span>
      </div>
      <nav>
        <RouterLink to="/links" class="nav-item" active-class="active">
          <span>{{ t.nav.links }}</span>
        </RouterLink>
        <RouterLink to="/batch" class="nav-item" active-class="active">
          <span>{{ t.nav.batch }}</span>
        </RouterLink>
        <RouterLink to="/stats" class="nav-item" active-class="active">
          <span>{{ t.nav.stats }}</span>
        </RouterLink>
      </nav>
      <button class="nav-item theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'">
        <span class="toggle-icon">{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
        <span class="toggle-text">{{ theme === 'dark' ? 'Modo Claro' : 'Modo Escuro' }}</span>
      </button>
      <button class="nav-item logout" @click="handleLogout">{{ t.nav.logout }}</button>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";
import t from "../i18n";

const auth = useAuthStore();
const router = useRouter();

const theme = ref("dark");

function initTheme(): void {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    theme.value = savedTheme;
  } else {
    theme.value = "dark";
  }
  document.documentElement.setAttribute("data-theme", theme.value);
}

function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
  localStorage.setItem("theme", theme.value);
  document.documentElement.setAttribute("data-theme", theme.value);
}

onMounted(() => {
  initTheme();
});

function handleLogout(): void {
  auth.logout();
  router.push("/login");
}
</script>

<style scoped>
.layout { display: flex; height: 100vh; overflow: hidden; }

.sidebar {
  width: 220px;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  gap: .25rem;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--brand);
  padding: .5rem .75rem;
  margin-bottom: 1rem;
}
.logo-img {
  height: 1.6rem;
  width: 1.6rem;
  object-fit: contain;
  border-radius: 6px;
}

.nav-item {
  display: block;
  padding: .6rem .75rem;
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: .9rem;
  font-weight: 500;
  transition: background .15s, color .15s;
  text-decoration: none;
}
.nav-item:hover, .nav-item.active {
  background: var(--brand-light);
  color: var(--brand-nav-text);
}

.theme-toggle {
  margin-top: auto;
  background: none;
  border: 1px solid var(--border);
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: .5rem;
}
.theme-toggle:hover {
  background: var(--brand-light);
  color: var(--brand-nav-text);
  border-color: var(--brand);
}
.toggle-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.logout {
  margin-top: .25rem;
  background: none;
  border: 1px solid var(--border);
  color: var(--danger);
  cursor: pointer;
  text-align: left;
}
.logout:hover { background: var(--danger-hover-bg); }

.content { flex: 1; padding: 2rem; overflow-y: auto; height: 100vh; }

/* ── Mobile: sidebar → bottom nav ──────────────────────────────────────── */
@media (max-width: 768px) {
  .layout {
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .sidebar {
    order: 2;
    width: 100%;
    height: 56px;
    min-height: 56px;
    flex-direction: row;
    align-items: center;
    padding: 0 .5rem;
    border-right: none;
    border-top: 1px solid var(--border);
    overflow: hidden;
    box-shadow: 0 -2px 8px rgba(0,0,0,.07);
  }

  .sidebar-brand { display: none; }

  nav { display: flex; flex: 1; height: 100%; }

  .nav-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: .4rem .25rem;
    font-size: .72rem;
    height: 100%;
  }

  .theme-toggle {
    order: 1;
    margin-top: 0;
    flex: 0 0 auto;
    padding: .4rem .75rem;
    font-size: .72rem;
    border: none;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .theme-toggle .toggle-text { display: none; }

  .logout {
    order: 2;
    margin-top: 0;
    flex: 0 0 auto;
    padding: .4rem .75rem;
    font-size: .72rem;
    border: none;
    height: 100%;
    display: flex;
    align-items: center;
  }

  .content {
    order: 1;
    flex: 1;
    height: 0;
    min-height: 0;
    padding: 1rem;
    overflow-y: auto;
  }
}
</style>
