<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  getPublishStatus,
  startPublication,
  getOnlineStatistics,
  type OnlineStats,
  type PublishStatus
} from "@/api/publish";

const status = ref<PublishStatus | null>(null);
const error = ref("");
const pending = ref(false);
const onlineStats = ref<OnlineStats | null>(null);
const statsLoading = ref(false);
const statsError = ref("");
const busy = computed(
  () =>
    pending.value ||
    [
      "running",
      "exporting",
      "building",
      "previewing",
      "syncing",
      "promoting"
    ].includes(status.value?.phase ?? "")
);
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const queryTime = computed(() =>
  onlineStats.value
    ? new Date(onlineStats.value.queriedAt).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour12: false
      })
    : ""
);

async function queryStatistics() {
  statsLoading.value = true;
  statsError.value = "";
  try {
    const result = await getOnlineStatistics();
    if (!disposed) onlineStats.value = result;
  } catch {
    if (!disposed) {
      onlineStats.value = null;
      statsError.value = "线上统计暂不可用；请确认云端统计服务已配置。";
    }
  } finally {
    if (!disposed) statsLoading.value = false;
  }
}

async function refresh() {
  try {
    const result = await getPublishStatus();
    if (disposed) return;
    status.value = result;
    error.value = "";
  } catch {
    if (!disposed) error.value = "无法读取发布状态，请检查本机后台。";
  } finally {
    if (!disposed && busy.value) timer = setTimeout(refresh, 3000);
  }
}

async function publish() {
  if (busy.value || !status.value?.ready) return;
  pending.value = true;
  error.value = "";
  try {
    await startPublication();
  } catch {
    error.value = "未能启动发布，请检查配置或正在运行的任务。";
  } finally {
    pending.value = false;
    await refresh();
  }
}

onMounted(() => {
  refresh();
  queryStatistics();
});
onUnmounted(() => {
  disposed = true;
  clearTimeout(timer);
});
</script>

<template>
  <el-card shadow="never" class="publication-panel">
    <div class="online-heading">
      <div>
        <span class="blog-eyebrow">线上网站 · 近七天</span>
        <h2>有人来读你的记录吗？</h2>
        <p>从云端统计服务读取；含站长访问，访客按浏览器去重。</p>
      </div>
      <el-button :loading="statsLoading" @click="queryStatistics"
        >刷新线上统计</el-button
      >
    </div>
    <p v-if="statsError" class="online-error" role="status">
      {{ statsError }} 不用本机数据或示例数字代替。
    </p>
    <div class="online-metrics">
      <div>
        <span>浏览次数 / PV</span
        ><strong>{{ onlineStats ? onlineStats.totals.pv : "—" }}</strong
        ><small>页面被浏览的次数</small>
      </div>
      <div>
        <span>访客数 / UV</span
        ><strong>{{ onlineStats ? onlineStats.totals.uv : "—" }}</strong
        ><small>去重浏览器，不等于人数</small>
      </div>
      <div>
        <span>访问会话</span
        ><strong>{{ onlineStats ? onlineStats.totals.sessions : "—" }}</strong
        ><small>一次连续访问</small>
      </div>
    </div>
    <p v-if="onlineStats" class="data-timestamp">
      {{ onlineStats.range.start }} — {{ onlineStats.range.end }}（北京时间） ·
      查询时间 {{ queryTime }}
    </p>
    <details class="online-ranking">
      <summary>哪些文章被阅读 · 累计排行</summary>
      <el-table
        v-if="onlineStats?.ranking.length"
        :data="onlineStats.ranking.slice(0, 10)"
        ><el-table-column prop="title" label="文章" /><el-table-column
          prop="views"
          label="累计阅读"
          width="110" /><el-table-column prop="likes" label="点赞" width="90"
      /></el-table>
      <p v-else>暂无可显示的线上文章数据。</p>
    </details>
    <div class="publication-tools">
      <p class="data-timestamp">
        下方显示最近发布任务的状态；本机新修改需要再次发布才会更新线上。
      </p>
      <div class="flex-bc flex-wrap gap-3">
        <div>
          <h2 class="font-medium">发布网站</h2>
          <p class="text-sm text-gray-500 mt-1">
            电脑上保存内容后，发布到网上；发布完成后关机也能访问。
          </p>
        </div>
        <div class="flex gap-2">
          <el-button :disabled="busy" @click="refresh">刷新状态</el-button>
          <el-button
            type="primary"
            :loading="busy"
            :disabled="!status?.ready"
            @click="publish"
          >
            发布网站
          </el-button>
        </div>
      </div>
      <p class="mt-3 text-sm" role="status">
        {{ status?.message || "正在读取发布状态…" }}
      </p>
      <el-alert
        v-if="status && !status.ready"
        class="mt-3"
        type="info"
        :closable="false"
        title="发布配置尚不完整；这不代表线上网站不可访问。"
        :description="`待配置：${status.missingConfig.join('、')}`"
      />
      <el-alert
        v-if="error"
        class="mt-3"
        type="error"
        :closable="false"
        :title="error"
      />
      <a
        v-if="status?.lastSuccessfulUrl"
        :href="status.lastSuccessfulUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary text-sm mt-2 inline-block"
        >查看最近成功发布的网站</a
      >
    </div>
  </el-card>
</template>
