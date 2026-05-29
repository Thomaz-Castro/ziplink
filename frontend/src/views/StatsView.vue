<template>
  <div>
    <h2 style="font-size:1.4rem;font-weight:700;margin-bottom:1.5rem">Statistics</h2>

    <div v-if="loading" class="empty-state">Loading…</div>

    <div v-else class="stats-grid">
      <div class="card stat-card">
        <div class="stat-value">{{ stats.total_links }}</div>
        <div class="stat-label">Total Links</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{{ stats.active_links }}</div>
        <div class="stat-label">Active Links</div>
      </div>
      <div class="card stat-card accent">
        <div class="stat-value">{{ Number(stats.total_clicks).toLocaleString() }}</div>
        <div class="stat-label">Total Clicks</div>
      </div>
    </div>

    <div style="margin-top:2rem" class="card">
      <h3 style="margin-bottom:1rem">Top Links by Clicks</h3>
      <div v-if="topLinks.length === 0" class="empty-state">No links yet.</div>
      <table v-else style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;padding:.5rem;border-bottom:1px solid var(--border)">Slug</th>
            <th style="text-align:left;padding:.5rem;border-bottom:1px solid var(--border)">Title</th>
            <th style="text-align:right;padding:.5rem;border-bottom:1px solid var(--border)">Clicks</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="link in topLinks" :key="link.id">
            <td style="padding:.5rem;font-family:monospace;color:var(--brand)">{{ link.slug }}</td>
            <td style="padding:.5rem;color:var(--text-muted);font-size:.85rem">{{ link.title ?? link.original_url.slice(0, 40) }}</td>
            <td style="padding:.5rem;text-align:right;font-weight:600">{{ Number(link.clicks).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { linksApi } from "../api/client";

interface Stats { total_links: string; active_links: string; total_clicks: string; }
interface Link { id: string; slug: string; original_url: string; title: string | null; clicks: number; }

const stats = ref<Stats>({ total_links: "0", active_links: "0", total_clicks: "0" });
const topLinks = ref<Link[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [statsRes, linksRes] = await Promise.all([
      linksApi.stats(),
      linksApi.list({ limit: 10 }),
    ]);
    stats.value = statsRes.data as Stats;
    const sorted = ((linksRes.data as { data: Link[] }).data ?? [])
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
    topLinks.value = sorted;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
.stat-card { text-align: center; }
.stat-card.accent { border-color: var(--brand); }
.stat-value { font-size: 2.5rem; font-weight: 700; color: var(--brand); }
.stat-label { font-size: .875rem; color: var(--text-muted); margin-top: .25rem; }
.empty-state { text-align: center; padding: 2rem; color: var(--text-muted); }
</style>
