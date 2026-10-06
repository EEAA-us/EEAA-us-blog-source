<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { message } from "@/utils/message";
import { adminMediaPreview } from "@/lib/admin-hero-media";
import {
  getMediaCatalog,
  saveMediaCatalog,
  type MediaCatalog,
  type MediaCatalogCategory,
  type MediaCatalogItem
} from "@/api/siteConfig";

const loading = ref(false);
const loaded = ref(false);
const saving = ref(false);
const categories = ref<MediaCatalogCategory[]>([]);
const items = ref<MediaCatalogItem[]>([]);
const categoryDialog = ref(false);
const itemDialog = ref(false);
const editingCategoryId = ref("");
const editingItemId = ref("");
const categoryForm = ref({ name: "", order: 0, enabled: true });
const itemForm = ref<MediaCatalogItem>(emptyItem());
const categoryFormRef = ref();
const itemFormRef = ref();

function emptyItem(): MediaCatalogItem {
  return {
    id: "",
    name: "",
    category: "",
    kind: "video",
    url: "",
    poster: "",
    author: "",
    sourceUrl: "",
    licenseUrl: "",
    order: 0,
    enabled: true
  };
}

const orderedCategories = computed(() =>
  [...categories.value].sort((a, b) => a.order - b.order)
);
const orderedItems = computed(() =>
  [...items.value].sort((a, b) => a.order - b.order)
);
const itemRules = {
  name: [{ required: true, message: "请输入素材名称", trigger: "blur" }],
  category: [{ required: true, message: "请选择分类", trigger: "change" }],
  url: [
    { required: true, message: "请输入素材地址", trigger: "blur" },
    {
      validator: (
        _rule: unknown,
        value: string,
        done: (error?: Error) => void
      ) =>
        done(
          isSafeAssetUrl(value)
            ? undefined
            : new Error("请输入 HTTPS 地址或本站绝对路径")
        ),
      trigger: "blur"
    }
  ],
  poster: [
    { required: true, message: "请输入预览图地址", trigger: "blur" },
    {
      validator: (
        _rule: unknown,
        value: string,
        done: (error?: Error) => void
      ) =>
        done(
          isSafeAssetUrl(value)
            ? undefined
            : new Error("请输入 HTTPS 地址或本站绝对路径")
        ),
      trigger: "blur"
    }
  ]
};

function isSafeAssetUrl(value: string) {
  const url = value.trim();
  return (
    (url.startsWith("/") && !url.startsWith("//")) || /^https:\/\//i.test(url)
  );
}

function previewUrl(value: string) {
  if (!isSafeAssetUrl(value)) return undefined;
  const localPreview = adminMediaPreview(value);
  if (localPreview !== value) return localPreview;
  if (value.startsWith("/") && !value.startsWith("/uploads/")) {
    return new URL(
      value,
      import.meta.env.VITE_BLOG_PREVIEW_URL || "http://127.0.0.1:3000"
    ).href;
  }
  return value;
}

function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}

async function load() {
  loading.value = true;
  try {
    const catalog = await getMediaCatalog();
    categories.value = catalog.categories ?? [];
    items.value = catalog.items ?? [];
    loaded.value = true;
  } catch (error: any) {
    message(error?.message ?? "素材目录加载失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

function editCategory(category?: MediaCatalogCategory) {
  editingCategoryId.value = category?.id ?? "";
  categoryForm.value = category
    ? { name: category.name, order: category.order, enabled: category.enabled }
    : { name: "", order: categories.value.length, enabled: true };
  categoryDialog.value = true;
}

async function submitCategory() {
  try {
    await categoryFormRef.value?.validate();
  } catch {
    return;
  }
  const name = categoryForm.value.name.trim();
  if (!name) return;
  if (editingCategoryId.value) {
    const category = categories.value.find(
      value => value.id === editingCategoryId.value
    );
    if (category) Object.assign(category, categoryForm.value, { name });
  } else {
    categories.value.push({ id: makeId(), ...categoryForm.value, name });
  }
  categoryDialog.value = false;
}

function removeCategory(category: MediaCatalogCategory) {
  if (items.value.some(item => item.category === category.id)) {
    message("该分类仍有素材引用，请先将这些素材换到其他分类。", {
      type: "warning"
    });
    return;
  }
  categories.value = categories.value.filter(value => value.id !== category.id);
  categories.value
    .sort((a, b) => a.order - b.order)
    .forEach((value, index) => {
      value.order = index;
    });
}

function editItem(item?: MediaCatalogItem) {
  editingItemId.value = item?.id ?? "";
  itemForm.value = item
    ? { ...item }
    : {
        ...emptyItem(),
        category: orderedCategories.value[0]?.id ?? "",
        order: items.value.length
      };
  itemDialog.value = true;
}

async function submitItem() {
  try {
    await itemFormRef.value?.validate();
  } catch {
    return;
  }
  const next = {
    ...itemForm.value,
    name: itemForm.value.name.trim(),
    url: itemForm.value.url.trim(),
    poster: itemForm.value.poster.trim()
  };
  if (editingItemId.value) {
    const index = items.value.findIndex(
      value => value.id === editingItemId.value
    );
    if (index >= 0) items.value[index] = { ...next, id: editingItemId.value };
  } else {
    items.value.push({ ...next, id: makeId() });
  }
  itemDialog.value = false;
}

function removeItem(item: MediaCatalogItem) {
  items.value = items.value.filter(value => value.id !== item.id);
}

function categoryName(id: string) {
  return (
    categories.value.find(category => category.id === id)?.name ?? "未知分类"
  );
}

async function save() {
  if (!loaded.value || saving.value) return;
  saving.value = true;
  const snapshot = JSON.stringify({
    categories: categories.value,
    items: items.value
  });
  const payload: MediaCatalog = {
    version: 1,
    categories: categories.value
      .map(value => ({ ...value }))
      .sort((a, b) => a.order - b.order),
    items: items.value
      .map(value => ({ ...value }))
      .sort((a, b) => a.order - b.order)
  };
  try {
    const result = await saveMediaCatalog(payload);
    if (
      JSON.stringify({ categories: categories.value, items: items.value }) !==
      snapshot
    ) {
      message(
        "先前的素材目录已保存；保存期间的新调整仍留在草稿中，请再次保存。",
        { type: "success" }
      );
      return;
    }
    categories.value = result.categories ?? payload.categories;
    items.value = result.items ?? payload.items;
    message(
      "动态封面素材已保存。刷新博客预览即可读取新配置；线上页面需重新发布后生效。",
      { type: "success", duration: 5000 }
    );
  } catch (error: any) {
    message(error?.message ?? "保存失败，草稿仍保留在当前页面", {
      type: "error"
    });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <el-card shadow="never" class="mt-4" v-loading="loading">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span class="font-medium">动态封面素材</span>
          <div class="mt-1 text-xs text-gray-500">
            支持视频与 GIF。分类可自定义；隐藏分类或素材不会删除数据。URL 使用
            HTTPS 或本站绝对路径。
          </div>
        </div>
        <div class="flex gap-2">
          <el-button @click="editCategory()">新增分类</el-button>
          <el-button
            type="primary"
            plain
            :disabled="categories.length === 0"
            @click="editItem()"
            >新增素材</el-button
          >
          <el-button :disabled="loading || saving" @click="load"
            >重新读取</el-button
          >
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!loaded"
            @click="save"
            >保存全部</el-button
          >
        </div>
      </div>
    </template>

    <div class="mb-5">
      <div class="mb-2 font-medium">分类</div>
      <el-empty
        v-if="categories.length === 0"
        description="请先新增一个分类"
        :image-size="56"
      />
      <el-table v-else :data="orderedCategories" row-key="id" size="small">
        <el-table-column prop="name" label="分类名称" min-width="180" />
        <el-table-column prop="order" label="顺序" width="90" />
        <el-table-column label="显示" width="90"
          ><template #default="{ row }"
            ><el-switch v-model="row.enabled" /></template
        ></el-table-column>
        <el-table-column label="操作" width="150"
          ><template #default="{ row }">
            <el-button link type="primary" @click="editCategory(row)"
              >编辑</el-button
            >
            <el-button link type="danger" @click="removeCategory(row)"
              >移除</el-button
            >
          </template></el-table-column
        >
      </el-table>
    </div>

    <div class="mb-2 font-medium">素材</div>
    <el-table
      :data="orderedItems"
      row-key="id"
      size="small"
      empty-text="暂无素材"
    >
      <el-table-column label="预览" width="112"
        ><template #default="{ row }">
          <video
            v-if="row.kind === 'video' && isSafeAssetUrl(row.url)"
            :src="previewUrl(row.url)"
            :poster="previewUrl(row.poster)"
            muted
            preload="none"
            class="h-14 w-24 rounded object-cover"
          />
          <img
            v-else-if="isSafeAssetUrl(row.url)"
            :src="previewUrl(row.url)"
            :alt="row.name"
            class="h-14 w-24 rounded object-cover"
            loading="lazy"
          />
          <span v-else class="text-xs text-gray-400">无预览</span>
        </template></el-table-column
      >
      <el-table-column
        prop="name"
        label="名称"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column label="分类" min-width="120"
        ><template #default="{ row }">{{
          categoryName(row.category)
        }}</template></el-table-column
      >
      <el-table-column label="类型" width="80"
        ><template #default="{ row }">{{
          row.kind === "video" ? "视频" : "GIF"
        }}</template></el-table-column
      >
      <el-table-column prop="order" label="顺序" width="75" />
      <el-table-column label="显示" width="80"
        ><template #default="{ row }"
          ><el-switch v-model="row.enabled" /></template
      ></el-table-column>
      <el-table-column label="操作" width="130" fixed="right"
        ><template #default="{ row }">
          <el-button link type="primary" @click="editItem(row)">编辑</el-button>
          <el-button link type="danger" @click="removeItem(row)"
            >移除</el-button
          >
        </template></el-table-column
      >
    </el-table>
    <div class="mt-3 text-xs text-gray-500">
      修改先保留为草稿，点击保存全部后刷新博客预览生效；线上需重新发布。
    </div>
  </el-card>

  <el-dialog
    v-model="categoryDialog"
    :title="editingCategoryId ? '编辑分类' : '新增分类'"
    width="440px"
    destroy-on-close
  >
    <el-form ref="categoryFormRef" :model="categoryForm" label-width="90px">
      <el-form-item
        label="分类名称"
        prop="name"
        :rules="[
          { required: true, message: '请输入分类名称', trigger: 'blur' }
        ]"
        ><el-input v-model="categoryForm.name" maxlength="40" show-word-limit
      /></el-form-item>
      <el-form-item label="显示顺序"
        ><el-input-number v-model="categoryForm.order" :min="0"
      /></el-form-item>
      <el-form-item label="显示"
        ><el-switch v-model="categoryForm.enabled"
      /></el-form-item>
    </el-form>
    <template #footer
      ><el-button @click="categoryDialog = false">取消</el-button
      ><el-button type="primary" @click="submitCategory"
        >确定</el-button
      ></template
    >
  </el-dialog>

  <el-dialog
    v-model="itemDialog"
    :title="editingItemId ? '编辑素材' : '新增素材'"
    width="660px"
    destroy-on-close
  >
    <el-form
      ref="itemFormRef"
      :model="itemForm"
      :rules="itemRules"
      label-width="110px"
    >
      <el-form-item label="素材名称" prop="name"
        ><el-input v-model="itemForm.name" maxlength="80" show-word-limit
      /></el-form-item>
      <el-form-item label="分类" prop="category"
        ><el-select v-model="itemForm.category" class="w-full"
          ><el-option
            v-for="category in orderedCategories"
            :key="category.id"
            :label="category.name"
            :value="category.id" /></el-select
      ></el-form-item>
      <el-form-item label="素材类型"
        ><el-radio-group v-model="itemForm.kind"
          ><el-radio value="video">视频</el-radio
          ><el-radio value="gif">GIF</el-radio></el-radio-group
        ></el-form-item
      >
      <el-form-item label="素材地址" prop="url"
        ><el-input v-model="itemForm.url" placeholder="https://… 或 /uploads/…"
      /></el-form-item>
      <el-form-item label="预览图地址" prop="poster"
        ><el-input
          v-model="itemForm.poster"
          placeholder="https://… 或 /uploads/…"
      /></el-form-item>
      <el-form-item label="显示顺序"
        ><el-input-number v-model="itemForm.order" :min="0"
      /></el-form-item>
      <el-form-item label="显示"
        ><el-switch v-model="itemForm.enabled"
      /></el-form-item>
      <el-divider content-position="left"
        >可选来源信息（便于开源使用者自定义与署名）</el-divider
      >
      <el-form-item label="作者"
        ><el-input v-model="itemForm.author"
      /></el-form-item>
      <el-form-item label="来源链接"
        ><el-input v-model="itemForm.sourceUrl" placeholder="https://…"
      /></el-form-item>
      <el-form-item label="许可链接"
        ><el-input v-model="itemForm.licenseUrl" placeholder="https://…"
      /></el-form-item>
    </el-form>
    <template #footer
      ><el-button @click="itemDialog = false">取消</el-button
      ><el-button type="primary" @click="submitItem"
        >应用到草稿</el-button
      ></template
    >
  </el-dialog>
</template>
