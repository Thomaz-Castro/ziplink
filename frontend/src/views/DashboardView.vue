<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <span class="logo">⚡</span>
        <span>ZipLink</span>
      </div>
      <nav>
        <RouterLink to="/links" class="nav-item" active-class="active">
          <span>Links</span>
        </RouterLink>
        <RouterLink to="/batch" class="nav-item" active-class="active">
          <span>Batch Import</span>
        </RouterLink>
        <RouterLink to="/stats" class="nav-item" active-class="active">
          <span>Stats</span>
        </RouterLink>
      </nav>
      <button class="nav-item logout" @click="handleLogout">Logout</button>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

function handleLogout(): void {
  auth.logout();
  router.push("/login");
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }

.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  gap: .25rem;
  flex-shrink: 0;
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
.logo { font-size: 1.4rem; }

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
  color: var(--brand-dark);
}

.logout {
  margin-top: auto;
  background: none;
  border: 1px solid var(--border);
  color: var(--danger);
  cursor: pointer;
  text-align: left;
}
.logout:hover { background: #fee2e2; }

.content { flex: 1; padding: 2rem; overflow-y: auto; }
</style>
