<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message as msg } from "@/utils/message";
import {
  getAllSiteConfig,
  updateSiteConfig,
  createSiteConfig,
  deleteSiteConfig
} from "@/api/siteConfig";
import type { SiteConfigItem } from "@/api/siteConfig";
import MediaCatalogManager from "./components/MediaCatalogManager.vue";

defineOptions({ name: "SiteConfigIndex" });

const loading = ref(false);
const saving = ref(false);
const loadError = ref(false);
let searchSequence = 0;
const dataList = ref<SiteConfigItem[]>([]);

// 编辑对话框
const dialogVisible = ref(false);
const dialogTitle = ref("编辑配置");
const formRef = ref();
const form = ref({
  key: "",
  value: "",
  description: ""
});
const isEdit = ref(false);

const rules = {
  key: [{ required: true, message: "请输入配置键名", trigger: "blur" }],
  value: [{ required: true, message: "请输入配置值", trigger: "blur" }]
};

const columns: TableColumnList = [
  { label: "ID", prop: "id", width: 60 },
  { label: "配置键名", prop: "key", width: 220 },
  {
    label: "配置值",
    prop: "value",
    minWidth: 200,
    slot: "value"
  },
  { label: "说明", prop: "description", minWidth: 160 },
  {
    label: "更新时间",
    prop: "updated_at",
    width: 170,
    formatter: ({ updated_at }: SiteConfigItem) =>
      updated_at ? updated_at.replace("T", " ").slice(0, 19) : ""
  },
  {
    label: "操作",
    fixed: "right",
    width: 150,
    slot: "operation"
  }
];

async function onSearch() {
  const sequence = ++searchSequence;
  loading.value = true;
  try {
    const data = await getAllSiteConfig();
    if (sequence !== searchSequence) return;
    dataList.value = data;
    loadError.value = false;
  } catch {
    if (sequence !== searchSequence) return;
    loadError.value = true;
    msg("配置加载失败，请重试", { type: "error" });
  } finally {
    if (sequence === searchSequence) loading.value = false;
  }
}

function openAdd() {
  if (saving.value) return;
  isEdit.value = false;
  dialogTitle.value = "新增配置";
  form.value = { key: "", value: "", description: "" };
  dialogVisible.value = true;
}

function openEdit(row: SiteConfigItem) {
  if (saving.value) return;
  isEdit.value = true;
  dialogTitle.value = "编辑配置";
  form.value = {
    key: row.key,
    value:
      typeof row.value === "string" ? row.value : JSON.stringify(row.value),
    description: row.description || ""
  };
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (saving.value) return;
  saving.value = true;
  try {
    await formRef.value?.validate();
  } catch {
    saving.value = false;
    return;
  }
  const submitted = { ...form.value };
  const editing = isEdit.value;
  try {
    if (editing) {
      await updateSiteConfig(submitted.key, {
        value: submitted.value,
        description: submitted.description
      });
      msg("更新成功", { type: "success" });
    } else {
      await createSiteConfig({
        key: submitted.key,
        value: submitted.value,
        description: submitted.description
      });
      msg("新增成功", { type: "success" });
    }
    dialogVisible.value = false;
    await onSearch();
  } catch (e: any) {
    msg(e?.message ?? "操作失败", { type: "error" });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: SiteConfigItem) {
  try {
    await deleteSiteConfig(row.key);
    msg("删除成功", { type: "success" });
    await onSearch();
  } catch (e: any) {
    msg(e?.message ?? "删除失败", { type: "error" });
  }
}

function formatValue(val: unknown): string {
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

onMounted(() => onSearch());
</script>

<template>
  <div class="p-4">
    <header class="blog-settings-heading">
      <span>个人博客 / 博客内容设置</span>
      <h1>博客封面与素材</h1>
      <p>
        这里管理访客在博客外观面板里可选的封面素材。保存后刷新本机博客查看；公开网站重新发布后生效。
      </p>
      <p>
        这不会替换后台背景。后台背景在右上角“后台外观”里调整；项目卡片图片在“项目图片”里设置。
      </p>
    </header>
    <MediaCatalogManager />
    <details class="blog-advanced-config">
      <summary>高级配置 · 配置键值</summary>
      <p>
        面向维护者的底层设置。通常无需新增配置；它不是后台图片或项目封面的设置入口。
      </p>
      <el-card shadow="never">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-medium">站点配置</span>
            <el-button type="primary" @click="openAdd">新增配置</el-button>
          </div>
        </template>

        <el-alert
          v-if="loadError"
          title="配置加载失败，已有列表保留；请重新加载。"
          type="error"
          :closable="false"
          class="mb-4"
        >
          <el-button :loading="loading" @click="onSearch">重新加载</el-button>
        </el-alert>
        <pure-table
          :data="dataList"
          :columns="columns"
          :loading="loading"
          align-whole="center"
          row-key="id"
          table-layout="auto"
        >
          <template #value="{ row }">
            <div
              class="text-left max-w-xs truncate"
              :title="formatValue(row.value)"
            >
              {{ formatValue(row.value) }}
            </div>
          </template>

          <template #operation="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">
              编辑
            </el-button>
            <el-popconfirm
              :title="`确认删除配置 ${row.key}？`"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </pure-table>
      </el-card>
    </details>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="520px"
      destroy-on-close
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :disabled="saving"
        label-width="80px"
      >
        <el-form-item label="配置键名" prop="key">
          <el-input
            v-model="form.key"
            :disabled="isEdit"
            placeholder="如 cloud_music_playlist_id"
          />
        </el-form-item>
        <el-form-item label="配置值" prop="value">
          <el-input
            v-model="form.value"
            type="textarea"
            :rows="3"
            placeholder="配置值"
          />
        </el-form-item>
        <el-form-item label="说明" prop="description">
          <el-input
            v-model="form.description"
            placeholder="配置项说明（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="dialogVisible = false"
          >取消</el-button
        >
        <el-button type="primary" :loading="saving" @click="handleSubmit"
          >确定</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.blog-settings-heading {
  padding: 24px;
  margin-bottom: 20px;
  border-radius: 22px;
  background: var(--blog-panel);
  border: 1px solid var(--blog-border);
}
.blog-settings-heading span {
  font-size: 12px;
  color: var(--blog-accent);
}
.blog-settings-heading h1 {
  font-size: 26px;
  margin: 8px 0;
}
.blog-settings-heading p,
.blog-advanced-config p {
  color: var(--blog-muted);
  font-size: 13px;
  line-height: 1.8;
}
.blog-advanced-config {
  margin: 20px 0;
  border: 1px solid var(--blog-border);
  border-radius: 16px;
  padding: 20px;
  background: var(--blog-panel);
}
.blog-advanced-config summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--blog-accent);
}
</style>
