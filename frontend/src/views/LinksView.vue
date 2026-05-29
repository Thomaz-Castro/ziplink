<template>
  <div>
    <div class="page-header">
      <h2>{{ t.links.title }}</h2>
      <button class="btn btn-primary" @click="showCreate = true">{{ t.links.newLink }}</button>
    </div>

    <!-- Search + Filters -->
    <div class="search-bar">
      <input v-model="search" type="text" :placeholder="t.links.searchPlaceholder" @input="debouncedFetch" />
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label>{{ t.links.filters.status }}</label>
        <select v-model="filterStatus" @change="applyFilters">
          <option value="">{{ t.links.filters.statusAll }}</option>
          <option value="true">{{ t.links.filters.statusActive }}</option>
          <option value="false">{{ t.links.filters.statusInactive }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>{{ t.links.filters.sortLabel }}</label>
        <select v-model="sortBy" @change="applyFilters">
          <option value="created_at">{{ t.links.filters.sortRecent }}</option>
          <option value="clicks">{{ t.links.filters.sortClicks }}</option>
        </select>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="showCreate || editingLink" class="modal-backdrop" @click.self="closeModal">
      <div class="card modal">
        <h3>{{ editingLink ? t.links.modal.editTitle : t.links.modal.createTitle }}</h3>
        <form @submit.prevent="handleSave">
          <div class="field">
            <label>{{ t.links.modal.urlLabel }}</label>
            <input v-model="form.original_url" type="url" :placeholder="t.links.modal.urlPlaceholder" required />
          </div>
          <div class="field">
            <label>{{ t.links.modal.slugLabel }} <small>({{ t.links.modal.slugHint }})</small></label>
            <input v-model="form.slug" type="text" :placeholder="t.links.modal.slugPlaceholder" maxlength="20" />
          </div>
          <div class="field">
            <label>{{ t.links.modal.titleLabel }} <small>({{ t.links.modal.titleHint }})</small></label>
            <input v-model="form.title" type="text" :placeholder="t.links.modal.titlePlaceholder" maxlength="512" />
          </div>
          <div class="field">
            <label>{{ t.links.modal.expiresLabel }} <small>({{ t.links.modal.expiresHint }})</small></label>
            <input v-model="form.expires_at" type="datetime-local" />
          </div>
          <p v-if="formError" class="error-msg">{{ formError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="closeModal">{{ t.common.cancel }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? t.common.saving : (editingLink ? t.common.update : t.common.create) }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Links table -->
    <div v-if="loading" class="empty-state">{{ t.common.loading }}</div>

    <div v-else-if="links.length === 0" class="empty-state card">
      <p>{{ t.links.emptyState }}</p>
    </div>

    <div v-else class="links-table card">
      <table>
        <thead>
          <tr>
            <th>{{ t.links.table.shortUrl }}</th>
            <th>{{ t.links.table.destination }}</th>
            <th>{{ t.links.table.clicks }}</th>
            <th>{{ t.links.table.status }}</th>
            <th>{{ t.links.table.createdAt }}</th>
            <th>{{ t.links.table.actions }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="link in links" :key="link.id">
            <td>
              <a :href="`${baseUrl}/${link.slug}`" target="_blank" class="slug-link">
                {{ link.slug }}
              </a>
              <button class="copy-btn" @click="copyToClipboard(`${baseUrl}/${link.slug}`)" title="Copiar">⎘</button>
            </td>
            <td class="url-cell" :title="link.original_url">{{ truncate(link.original_url, 50) }}</td>
            <td>{{ link.clicks.toLocaleString() }}</td>
            <td>
              <span :class="link.active ? 'badge badge-green' : 'badge badge-red'">
                {{ link.active ? t.links.table.active : t.links.table.inactive }}
              </span>
            </td>
            <td>{{ formatDate(link.created_at) }}</td>
            <td class="actions">
              <button class="btn btn-ghost" style="padding:.25rem .6rem;font-size:.8rem" @click="startEdit(link)">{{ t.common.edit }}</button>
              <button
                class="btn"
                :class="link.active ? 'btn-warning' : 'btn-success'"
                style="padding:.25rem .6rem;font-size:.8rem"
                @click="toggleActive(link)"
              >{{ link.active ? t.links.pause : t.links.resume }}</button>
              <button class="btn btn-danger" style="padding:.25rem .6rem;font-size:.8rem" @click="removeLink(link.id)">{{ t.common.delete }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <button class="btn btn-ghost" :disabled="page === 1" @click="page--; fetchLinks()">{{ t.links.pagination.prev }}</button>
      <span>{{ t.links.pagination.page(page, totalPages) }}</span>
      <button class="btn btn-ghost" :disabled="page >= totalPages" @click="page++; fetchLinks()">{{ t.links.pagination.next }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { linksApi } from "../api/client";
import t from "../i18n";

interface Link {
  id: string;
  slug: string;
  original_url: string;
  title: string | null;
  clicks: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

// Use current origin so short URLs match whatever host the app is running on
const baseUrl = window.location.origin;

const links = ref<Link[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const search = ref("");
const filterStatus = ref<"" | "true" | "false">("");
const sortBy = ref<"created_at" | "clicks">("created_at");
const loading = ref(false);
const showCreate = ref(false);
const editingLink = ref<Link | null>(null);
const saving = ref(false);
const formError = ref("");

const form = ref({ original_url: "", slug: "", title: "", expires_at: "" });

const totalPages = computed(() => Math.ceil(total.value / limit.value));

async function fetchLinks(): Promise<void> {
  loading.value = true;
  try {
    const res = await linksApi.list({
      page: page.value,
      limit: limit.value,
      search: search.value || undefined,
      active: filterStatus.value || undefined,
      sortBy: sortBy.value,
    });
    links.value = (res.data as { data: Link[]; total: number }).data;
    total.value = (res.data as { data: Link[]; total: number }).total;
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  page.value = 1;
  fetchLinks();
}

let debounceTimer: ReturnType<typeof setTimeout>;
function debouncedFetch(): void {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { page.value = 1; fetchLinks(); }, 350);
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

function startEdit(link: Link): void {
  editingLink.value = link;
  form.value = {
    original_url: link.original_url,
    slug: "",
    title: link.title ?? "",
    expires_at: toDatetimeLocal(link.expires_at),
  };
}

function closeModal(): void {
  showCreate.value = false;
  editingLink.value = null;
  form.value = { original_url: "", slug: "", title: "", expires_at: "" };
  formError.value = "";
}

async function handleSave(): Promise<void> {
  saving.value = true;
  formError.value = "";
  try {
    if (editingLink.value) {
      await linksApi.update(editingLink.value.id, {
        original_url: form.value.original_url,
        title: form.value.title || undefined,
        expires_at: form.value.expires_at ? new Date(form.value.expires_at).toISOString() : null,
      });
    } else {
      await linksApi.create({
        original_url: form.value.original_url,
        slug: form.value.slug || undefined,
        title: form.value.title || undefined,
        expires_at: form.value.expires_at ? new Date(form.value.expires_at).toISOString() : undefined,
      });
    }
    closeModal();
    fetchLinks();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    formError.value = e?.response?.data?.error ?? t.links.saveErrorFallback;
  } finally {
    saving.value = false;
  }
}

async function toggleActive(link: Link): Promise<void> {
  await linksApi.update(link.id, { active: !link.active });
  link.active = !link.active;
}

async function removeLink(id: string): Promise<void> {
  if (!confirm(t.links.deleteConfirm)) return;
  await linksApi.remove(id);
  fetchLinks();
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

onMounted(fetchLinks);
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h2 { font-size: 1.4rem; font-weight: 700; }

.search-bar { margin-bottom: .5rem; }
.search-bar input { max-width: 400px; }

.filters-bar { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
.filter-group { display: flex; align-items: center; gap: .4rem; font-size: .85rem; }
.filter-group label { color: var(--text-muted); white-space: nowrap; }
.filter-group select {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: .3rem .6rem;
  font-size: .85rem;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal { width: 100%; max-width: 480px; }
.modal h3 { margin-bottom: 1.25rem; font-size: 1.1rem; }
.field { margin-bottom: 1rem; }
.field label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: .35rem; }
.modal-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: 1rem; }

.empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }

.links-table { overflow-x: auto; padding: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: .75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: .875rem; }
th { font-weight: 600; color: var(--text-muted); background: var(--surface-2); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--surface-2); }

.slug-link { font-family: monospace; font-weight: 600; color: var(--brand); }
.copy-btn {
  background: none; border: none; cursor: pointer; color: var(--text-muted);
  font-size: 1rem; padding: 0 .25rem; vertical-align: middle;
}
.copy-btn:hover { color: var(--brand); }
.url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; gap: .35rem; }
.btn-warning { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
.btn-warning:hover { background: #fde68a; }
.btn-success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
.btn-success:hover { background: #a7f3d0; }

.pagination {
  display: flex; align-items: center; justify-content: center; gap: 1rem;
  margin-top: 1rem; font-size: .9rem;
}
</style>
