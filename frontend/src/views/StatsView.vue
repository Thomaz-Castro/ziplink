<template>
  <div>
    <h2 style="font-size:1.4rem;font-weight:700;margin-bottom:1.5rem">{{ t.stats.title }}</h2>

    <div v-if="loading" class="empty-state">{{ t.common.loading }}</div>

    <div v-else class="stats-grid">
      <div class="card stat-card">
        <div class="stat-value">{{ stats.total_links }}</div>
        <div class="stat-label">{{ t.stats.totalLinks }}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{{ stats.active_links }}</div>
        <div class="stat-label">{{ t.stats.activeLinks }}</div>
      </div>
      <div class="card stat-card accent">
        <div class="stat-value">{{ Number(stats.total_clicks).toLocaleString() }}</div>
        <div class="stat-label">{{ t.stats.totalClicks }}</div>
      </div>
    </div>

    <div style="margin-top:2rem" class="card">
      <h3 style="margin-bottom:1rem">{{ t.stats.topLinksTitle }}</h3>
      <div v-if="topLinks.length === 0" class="empty-state">{{ t.stats.emptyState }}</div>
      <table v-else style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;padding:.5rem;border-bottom:1px solid var(--border)">{{ t.stats.tableSlug }}</th>
            <th style="text-align:left;padding:.5rem;border-bottom:1px solid var(--border)">{{ t.stats.tableTitle }}</th>
            <th style="text-align:right;padding:.5rem;border-bottom:1px solid var(--border)">{{ t.stats.tableClicks }}</th>
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
import t from "../i18n";

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
