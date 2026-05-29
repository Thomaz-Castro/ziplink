<template>
  <div>
    <div class="page-header">
      <h2>Batch Import</h2>
    </div>

    <!-- Upload area -->
    <div class="card upload-card">
      <h3>Upload CSV or JSON</h3>
      <p class="hint">
        Accepts <strong>.csv</strong> (columns: <code>url, slug, title</code>) or
        <strong>.json</strong> (array of <code>{"{"}"url","slug","title"{"}"}</code> objects).
        Maximum <strong>2,000 URLs</strong> per file.
      </p>

      <div
        class="drop-zone"
        :class="{ dragging: isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <input ref="fileInput" type="file" accept=".csv,.json" style="display:none" @change="onFileChange" />
        <div v-if="selectedFile">
          <p class="file-name">{{ selectedFile.name }}</p>
          <p class="file-size">{{ formatSize(selectedFile.size) }}</p>
        </div>
        <div v-else>
          <p>Drop file here or <strong>click to browse</strong></p>
          <p style="font-size:.8rem;color:var(--text-muted);margin-top:.25rem">CSV or JSON, max 5 MB</p>
        </div>
      </div>

      <p v-if="uploadError" class="error-msg">{{ uploadError }}</p>

      <button class="btn btn-primary" :disabled="!selectedFile || uploading" @click="submitBatch" style="margin-top:1rem">
        {{ uploading ? "Uploading…" : "Submit Batch" }}
      </button>
    </div>

    <!-- Job list -->
    <div style="margin-top:2rem">
      <h3 style="margin-bottom:1rem">Import Jobs</h3>

      <div v-if="jobs.length === 0" class="empty-state card">
        <p>No import jobs yet.</p>
      </div>

      <div v-for="job in jobs" :key="job.id" class="card job-card">
        <div class="job-header">
          <span class="job-id">{{ job.id.slice(0, 8) }}…</span>
          <span :class="statusClass(job.status)">{{ job.status }}</span>
          <span style="color:var(--text-muted);font-size:.8rem;margin-left:auto">{{ formatDate(job.created_at) }}</span>
        </div>

        <div class="job-progress">
          <div class="progress-bar" :style="{ width: progressPct(job) + '%' }"></div>
        </div>

        <div class="job-stats">
          <span>Total: {{ job.total }}</span>
          <span class="success">Success: {{ job.success_count }}</span>
          <span class="fail">Failed: {{ job.failure_count }}</span>
          <span>Processed: {{ job.processed }}</span>
        </div>

        <button
          v-if="job.status === 'completed' && job.failure_count > 0"
          class="btn btn-ghost"
          style="font-size:.8rem;margin-top:.75rem"
          @click="toggleResults(job.id)"
        >
          {{ expandedJob === job.id ? "Hide" : "Show" }} failed rows
        </button>

        <div v-if="expandedJob === job.id" class="results-list">
          <div v-for="r in failedResults(job)" :key="r.line" class="result-row">
            <span class="result-line">Line {{ r.line }}</span>
            <span class="result-url">{{ r.url }}</span>
            <span class="result-error">{{ r.error }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { batchApi } from "../api/client";

interface BatchResult {
  line: number;
  url: string;
  status: "success" | "error";
  error?: string;
}

interface BatchJob {
  id: string;
  status: string;
  total: number;
  processed: number;
  success_count: number;
  failure_count: number;
  results: BatchResult[];
  created_at: string;
}

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);
const uploading = ref(false);
const uploadError = ref("");
const jobs = ref<BatchJob[]>([]);
const expandedJob = ref<string | null>(null);

let pollInterval: ReturnType<typeof setInterval> | null = null;

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) selectedFile.value = input.files[0];
}

function onDrop(e: DragEvent): void {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) selectedFile.value = file;
}

async function submitBatch(): Promise<void> {
  if (!selectedFile.value) return;
  uploading.value = true;
  uploadError.value = "";
  try {
    await batchApi.submit(selectedFile.value);
    selectedFile.value = null;
    fetchJobs();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    uploadError.value = e?.response?.data?.error ?? "Upload failed";
  } finally {
    uploading.value = false;
  }
}

async function fetchJobs(): Promise<void> {
  const res = await batchApi.list();
  jobs.value = res.data as BatchJob[];
}

function progressPct(job: BatchJob): number {
  if (job.total === 0) return 0;
  return Math.round((job.processed / job.total) * 100);
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    pending: "badge badge-gray",
    processing: "badge badge-gray",
    completed: "badge badge-green",
    failed: "badge badge-red",
  };
  return map[status] ?? "badge badge-gray";
}

function failedResults(job: BatchJob): BatchResult[] {
  return (job.results ?? []).filter((r) => r.status === "error");
}

function toggleResults(id: string): void {
  expandedJob.value = expandedJob.value === id ? null : id;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

onMounted(() => {
  fetchJobs();
  pollInterval = setInterval(fetchJobs, 3000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h2 { font-size: 1.4rem; font-weight: 700; }

.upload-card h3 { margin-bottom: .5rem; }
.hint { color: var(--text-muted); font-size: .875rem; margin-bottom: 1rem; }

.drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  padding: 2.5rem;
  text-align: center;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.drop-zone:hover, .drop-zone.dragging { border-color: var(--brand); background: var(--brand-light); }
.file-name { font-weight: 600; }
.file-size { color: var(--text-muted); font-size: .85rem; }

.empty-state { text-align: center; padding: 2rem; color: var(--text-muted); }

.job-card { margin-bottom: 1rem; }
.job-header { display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem; }
.job-id { font-family: monospace; color: var(--text-muted); font-size: .85rem; }

.job-progress { background: var(--border); border-radius: 999px; height: 6px; overflow: hidden; margin-bottom: .75rem; }
.progress-bar { height: 6px; background: var(--brand); border-radius: 999px; transition: width .3s; }

.job-stats { display: flex; gap: 1.5rem; font-size: .85rem; flex-wrap: wrap; }
.job-stats .success { color: #166534; }
.job-stats .fail { color: var(--danger); }

.results-list { margin-top: .75rem; border-top: 1px solid var(--border); }
.result-row { display: flex; gap: .75rem; align-items: flex-start; padding: .5rem 0; border-bottom: 1px solid var(--border); font-size: .8rem; flex-wrap: wrap; }
.result-line { color: var(--text-muted); min-width: 60px; }
.result-url { flex: 1; color: var(--text); word-break: break-all; }
.result-error { color: var(--danger); }
</style>
