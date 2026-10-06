<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { getVisitorIpGroups, getVisitorIpPaths } from "@/api/visitor";
import type { VisitorIpGroup, VisitorPathItem } from "@/api/visitor";
import { message } from "@/utils/message";

defineOptions({ name: "VisitorIndex" });

const loading = ref(false);
const loadingMore = ref(false);
const search = ref("");
const groups = ref<VisitorIpGroup[]>([]);
const total = ref(0);
const expandedIp = ref("");
const pathsByIp = reactive<Record<string, VisitorPathItem[]>>({});
const pathTotals = reactive<Record<string, number>>({});
const groupError = ref("");
const pathError = ref("");
const pathLoading = ref(false);
const groupLimit = 50;
const pathLimit = 20;

function formatTime(value: string) {
  return value ? value.replace("T", " ").slice(0, 19) : "未知";
}

async function loadGroups(reset = true) {
  if (loading.value || loadingMore.value) return;
  groupError.value = "";
  if (reset) loading.value = true;
  else loadingMore.value = true;
  try {
    const offset = reset ? 0 : groups.value.length;
    const result = await getVisitorIpGroups({
      search: search.value.trim() || undefined,
      offset,
      limit: groupLimit
    });
    groups.value = reset
      ? (result.items ?? [])
      : [...groups.value, ...(result.items ?? [])];
    total.value = result.total ?? 0;
    if (reset) {
      expandedIp.value = "";
      pathError.value = "";
      Object.keys(pathsByIp).forEach(ip => delete pathsByIp[ip]);
      Object.keys(pathTotals).forEach(ip => delete pathTotals[ip]);
    }
  } catch (error: any) {
    groupError.value = error?.message || "访客 IP 加载失败，请重试";
    message(groupError.value, { type: "error" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function toggleGroup(ip: string) {
  if (pathLoading.value) return;
  if (expandedIp.value === ip) {
    expandedIp.value = "";
    return;
  }
  expandedIp.value = ip;
  pathError.value = "";
  if (pathsByIp[ip]) return;
  pathLoading.value = true;
  try {
    const result = await getVisitorIpPaths({ ip, offset: 0, limit: pathLimit });
    pathsByIp[ip] = result.items ?? [];
    pathTotals[ip] = result.total ?? 0;
  } catch (error: any) {
    pathError.value = error?.message || "访问路径加载失败，请重试";
    message(pathError.value, { type: "error" });
  } finally {
    pathLoading.value = false;
  }
}

async function loadMorePaths(ip: string) {
  if (pathLoading.value) return;
  pathError.value = "";
  pathLoading.value = true;
  try {
    const result = await getVisitorIpPaths({
      ip,
      offset: pathsByIp[ip]?.length ?? 0,
      limit: pathLimit
    });
    pathsByIp[ip] = [...(pathsByIp[ip] ?? []), ...(result.items ?? [])];
    pathTotals[ip] = result.total ?? 0;
  } catch (error: any) {
    pathError.value = error?.message || "更多访问路径加载失败，请重试";
    message(pathError.value, { type: "error" });
  } finally {
    pathLoading.value = false;
  }
}

onMounted(() => loadGroups());
</script>

<template>
  <div class="visitor-source-note">
    <strong>本机访问记录</strong>
    <p>
      数据来自本机后端，可能包含开发测试与回环地址；这里不是公网访客 IP
      列表。线上访问次数请看博客工作台。
    </p>
  </div>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="font-medium">按 IP 分组</span>
          <span class="muted">共 {{ total }} 个 IP</span>
        </div>
      </template>

      <div class="search-row">
        <el-input
          v-model="search"
          :disabled="loading || loadingMore"
          clearable
          placeholder="搜索 IP 地址"
          class="search-input"
          @keyup.enter="loadGroups()"
          @clear="loadGroups()"
        />
        <el-button
          type="primary"
          :loading="loading"
          :disabled="loadingMore"
          @click="loadGroups()"
          >搜索</el-button
        >
      </div>

      <el-skeleton v-if="loading" :rows="5" animated />
      <el-alert
        v-if="groupError"
        :title="groupError"
        type="error"
        :closable="false"
      />
      <el-empty
        v-else-if="groups.length === 0"
        description="没有匹配的 IP 记录"
      />
      <div v-else class="group-list">
        <article v-for="group in groups" :key="group.ip" class="ip-group">
          <button
            class="group-summary"
            :disabled="pathLoading"
            @click="toggleGroup(group.ip)"
          >
            <span class="ip-address">{{ group.ip }}</span>
            <span class="visit-count">{{ group.visit_count }} 次访问</span>
            <span class="latest-time"
              >最近：{{ formatTime(group.latest_at) }}</span
            >
            <el-icon class="chevron"
              ><ArrowDown v-if="expandedIp === group.ip" /><ArrowRight v-else
            /></el-icon>
          </button>
          <div v-if="expandedIp === group.ip" class="paths-panel">
            <div class="paths-title">最近访问路径</div>
            <el-alert
              v-if="pathError"
              :title="pathError"
              type="error"
              :closable="false"
            />
            <el-skeleton
              v-if="pathLoading && !pathsByIp[group.ip]"
              :rows="3"
              animated
            />
            <template v-else>
              <el-empty
                v-if="!pathError && !pathsByIp[group.ip]?.length"
                description="暂无路径记录"
                :image-size="48"
              />
              <div v-else class="path-list">
                <div
                  v-for="(item, index) in pathsByIp[group.ip]"
                  :key="`${item.created_at}-${index}`"
                  class="path-row"
                >
                  <code>{{ item.path || "/" }}</code>
                  <time>{{ formatTime(item.created_at) }}</time>
                </div>
              </div>
              <div
                v-if="
                  (pathTotals[group.ip] ?? 0) >
                  (pathsByIp[group.ip]?.length ?? 0)
                "
                class="more-row"
              >
                <el-button
                  link
                  type="primary"
                  :loading="pathLoading"
                  :disabled="pathLoading"
                  @click="loadMorePaths(group.ip)"
                  >加载更多路径（{{ pathsByIp[group.ip]?.length }}/{{
                    pathTotals[group.ip]
                  }}）</el-button
                >
              </div>
            </template>
          </div>
        </article>
      </div>

      <div v-if="groups.length < total" class="more-row group-more">
        <el-button
          :loading="loadingMore"
          :disabled="loading"
          @click="loadGroups(false)"
          >加载更多 IP</el-button
        >
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.visitor-source-note {
  margin: 16px 16px 0;
  padding: 12px 16px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  color: var(--el-text-color-primary);
}
.visitor-source-note p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.header-row,
.search-row,
.group-summary,
.path-row {
  display: flex;
  align-items: center;
}
.header-row {
  justify-content: space-between;
}
.muted,
.latest-time,
.path-row time {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.search-row {
  gap: 8px;
  margin-bottom: 16px;
}
.search-input {
  max-width: 360px;
}
.group-list {
  border-top: 1px solid var(--el-border-color-lighter);
}
.ip-group {
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.group-summary {
  width: 100%;
  gap: 16px;
  padding: 14px 8px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}
.group-summary:hover {
  background: var(--el-fill-color-light);
}
.ip-address {
  min-width: 150px;
  font-family: ui-monospace, monospace;
  font-weight: 600;
}
.visit-count {
  min-width: 90px;
  color: var(--el-color-primary);
}
.latest-time {
  flex: 1;
}
.chevron {
  margin-left: auto;
}
.paths-panel {
  padding: 0 12px 12px;
}
.paths-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}
.path-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.path-row {
  justify-content: space-between;
  gap: 16px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.path-row:last-child {
  border-bottom: 0;
}
.path-row code {
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
}
.path-row time {
  flex-shrink: 0;
}
.more-row {
  display: flex;
  justify-content: center;
  padding-top: 10px;
}
.group-more {
  padding-top: 18px;
}
@media (max-width: 640px) {
  .group-summary {
    flex-wrap: wrap;
    gap: 6px 12px;
  }
  .latest-time {
    flex-basis: 100%;
  }
  .path-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
