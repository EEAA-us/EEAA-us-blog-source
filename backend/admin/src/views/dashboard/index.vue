<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useDark, useECharts } from "@pureadmin/utils";
import { getDashboardStats } from "@/api/dashboard";
import type { DashboardStats } from "@/api/dashboard";
import Document from "~icons/ep/document";
import EditPen from "~icons/ep/edit-pen";
import Files from "~icons/ep/files";
import Discount from "~icons/ep/discount";
import { useNav } from "@/layout/hooks/useNav";
import ManagementShortcuts from "./components/ManagementShortcuts.vue";
import PublishPanel from "./components/PublishPanel.vue";

defineOptions({ name: "Dashboard" });

const { isDark } = useDark();
const { onPanel } = useNav();
const theme = computed(() => (isDark.value ? "dark" : "light"));
const loading = ref(true);
const stats = ref<DashboardStats | null>(null);
const error = ref("");
const refreshedAt = ref("");
let disposed = false;

// ── 统计卡片配置 ──
const statCards = computed(() => {
  if (!stats.value) return [];
  const c = stats.value.counts;
  return [
    { title: "已发布文章", value: c.posts, icon: Document },
    { title: "草稿", value: c.drafts, icon: EditPen },
    { title: "分类", value: c.categories, icon: Files },
    { title: "标签", value: c.tags, icon: Discount }
  ];
});

// ── 文章趋势图 ──
const postTrendRef = ref();
const { setOptions: setPostTrend } = useECharts(postTrendRef, { theme });

function updatePostTrend() {
  if (!stats.value) return;
  const data = stats.value.post_trend;
  setPostTrend({
    tooltip: { trigger: "axis" },
    grid: {
      top: "10%",
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map(d => d.date.slice(5)),
      axisLabel: { fontSize: 11 }
    },
    yAxis: { type: "value", minInterval: 1 },
    series: [
      {
        name: "发布数",
        type: "line",
        smooth: true,
        symbol: "none",
        areaStyle: { opacity: 0.15 },
        color: "#818cf8",
        data: data.map(d => d.count)
      }
    ]
  });
}

// ── 访客趋势图 ──
const visitorTrendRef = ref();
const { setOptions: setVisitorTrend } = useECharts(visitorTrendRef, { theme });

function updateVisitorTrend() {
  if (!stats.value) return;
  const data = stats.value.visitor_trend;
  setVisitorTrend({
    tooltip: { trigger: "axis" },
    grid: {
      top: "10%",
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map(d => d.date.slice(5)),
      axisLabel: { fontSize: 11 }
    },
    yAxis: { type: "value", minInterval: 1 },
    series: [
      {
        name: "访客数",
        type: "line",
        smooth: true,
        symbol: "none",
        areaStyle: { opacity: 0.15 },
        color: "#22d3ee",
        data: data.map(d => d.count)
      }
    ]
  });
}

// ── 分类分布饼图 ──
const categoryRef = ref();
const { setOptions: setCategory } = useECharts(categoryRef, { theme });

function updateCategory() {
  if (!stats.value) return;
  const data = stats.value.category_distribution;
  setCategory({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["40%", "65%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: "transparent",
          borderWidth: 2
        },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
        data: data.length ? data : [{ name: "暂无数据", value: 0 }]
      }
    ]
  });
}

// ── 浏览器分布饼图 ──
const browserRef = ref();
const { setOptions: setBrowser } = useECharts(browserRef, { theme });

function updateBrowser() {
  if (!stats.value) return;
  const data = stats.value.browser_distribution;
  setBrowser({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["40%", "65%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: "transparent",
          borderWidth: 2
        },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
        data: data.length ? data : [{ name: "暂无数据", value: 0 }]
      }
    ]
  });
}

// ── 数据加载 ──
async function loadContentStats() {
  loading.value = true;
  error.value = "";
  try {
    const result = await getDashboardStats();
    if (disposed) return;
    stats.value = result;
    refreshedAt.value = new Date().toLocaleString("zh-CN");
    await nextTick();
    updatePostTrend();
    updateCategory();
  } catch {
    if (!disposed) {
      stats.value = null;
      error.value = "本机内容数据读取失败，请检查后台服务后重试。";
    }
  } finally {
    if (!disposed) loading.value = false;
  }
}
onMounted(loadContentStats);
onUnmounted(() => {
  disposed = true;
});
</script>

<template>
  <div class="blog-workspace">
    <header class="workspace-heading">
      <div>
        <span class="blog-eyebrow">记录的另一面</span>
        <h1>博客工作台</h1>
        <p>整理你的内容，看看小站最近发生了什么。</p>
      </div>
      <div class="workspace-actions">
        <el-button
          title="只调整你的管理后台，访客的博客外观不受影响"
          @click="onPanel"
          >后台外观 · 仅自己可见</el-button
        ><router-link to="/post/edit" class="workspace-write"
          >写一篇文章 <span>↗</span></router-link
        >
      </div>
    </header>
    <PublishPanel />
    <section v-loading="loading" class="workspace-section">
      <div class="section-heading">
        <div>
          <h2>你的内容库</h2>
          <p>来自本机博客数据库 · 尚未发布的修改也包含在这里</p>
        </div>
        <el-button :loading="loading" @click="loadContentStats"
          >刷新内容数据</el-button
        >
      </div>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
      <div class="content-metrics">
        <router-link
          v-for="item in statCards"
          :key="item.title"
          :to="
            item.title === '分类'
              ? '/category/index'
              : item.title === '标签'
                ? '/tag/index'
                : '/post/index'
          "
          class="content-metric"
          ><el-icon :size="20"><component :is="item.icon" /></el-icon
          ><span>{{ item.title }}</span
          ><strong>{{ item.value }}</strong
          ><span class="metric-arrow">↗</span></router-link
        >
      </div>
      <p v-if="refreshedAt" class="data-timestamp">
        最近读取：{{ refreshedAt }}
      </p>
    </section>
    <ManagementShortcuts />
    <div v-if="stats" class="workspace-charts">
      <el-card shadow="never"
        ><template #header
          ><h2>文章发布节奏</h2>
          <p>本机已发布文章 · 最近30天</p></template
        >
        <div ref="postTrendRef" style="width: 100%; height: 260px"
      /></el-card>
      <el-card shadow="never"
        ><template #header
          ><h2>内容分类</h2>
          <p>本机已发布文章的分类分布</p></template
        >
        <div
          v-if="stats.category_distribution.length"
          ref="categoryRef"
          style="width: 100%; height: 260px" />
        <el-empty v-else description="还没有分类数据" :image-size="70"
      /></el-card>
    </div>
    <details
      v-if="stats"
      class="workspace-diagnostics"
      @toggle="
        nextTick(() => {
          updateVisitorTrend();
          updateBrowser();
        })
      "
    >
      <summary>
        本机访问诊断 <span>开发与测试记录，不代表线上访客</span>
      </summary>
      <p>
        以下是本机后端保存的
        {{ stats.counts.visitors }}
        条访问记录，可能包含你的测试。公网IP明细与排除站长访问尚未接入。
      </p>
      <div class="workspace-charts">
        <el-card shadow="never"
          ><template #header>本机访问记录趋势 · 最近30天</template>
          <div
            ref="visitorTrendRef"
            style="width: 100%; height: 260px" /></el-card
        ><el-card shadow="never"
          ><template #header>本机记录中的浏览器</template>
          <div
            v-if="stats.browser_distribution.length"
            ref="browserRef"
            style="width: 100%; height: 260px" />
          <el-empty v-else description="暂无本机访问记录" :image-size="70"
        /></el-card>
      </div>
      <router-link to="/visitor/index">查看本机访问记录 ↗</router-link>
    </details>
  </div>
</template>
