<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "@/utils/message";
import {
  getAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  getAlbumPhotos,
  createPhoto,
  deletePhoto,
  uploadImage
} from "@/api/album";
import type { AlbumItem, PhotoItem } from "@/api/album";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { blogPhotoAlbums } from "@/lib/blog-media";
import { useLocalPagination } from "@/lib/use-local-pagination";

defineOptions({ name: "AlbumIndex" });
const builtInAlbums = blogPhotoAlbums.map(album => ({
  ...album,
  pages: useLocalPagination(() => album.photos)
}));

// ========== 相册列表 ==========
const loading = ref(false);
const dataList = ref<AlbumItem[]>([]);
const {
  pagination: albumPagination,
  pageItems: albumPageItems,
  showPagination: showAlbumPagination,
  handlePageSizeChange: handleAlbumPageSizeChange
} = useLocalPagination(dataList);
const dialogVisible = ref(false);
const dialogTitle = ref("新增相册");
const formRef = ref();
const form = ref({
  id: 0,
  title: "",
  description: "",
  cover: "",
  sort: 0
});

const rules = {
  title: [{ required: true, message: "请输入相册名称", trigger: "blur" }]
};

const columns: TableColumnList = [
  { label: "ID", prop: "id", width: 70 },
  { label: "相册名称", prop: "title", minWidth: 150 },
  { label: "描述", prop: "description", minWidth: 200 },
  {
    label: "封面",
    prop: "cover",
    width: 100,
    slot: "cover"
  },
  { label: "照片数", prop: "photo_count", width: 80 },
  { label: "排序", prop: "sort", width: 80 },
  {
    label: "创建时间",
    prop: "created_at",
    minWidth: 170,
    formatter: ({ created_at }) =>
      created_at?.replace("T", " ").slice(0, 19) ?? ""
  },
  {
    label: "修改时间",
    prop: "updated_at",
    minWidth: 170,
    formatter: ({ updated_at }) =>
      updated_at?.replace("T", " ").slice(0, 19) ?? ""
  },
  { label: "操作", fixed: "right", width: 250, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    dataList.value = await getAlbums();
  } finally {
    loading.value = false;
  }
}

function openDialog(title: string, row?: AlbumItem) {
  dialogTitle.value = title;
  if (row) {
    form.value = {
      id: row.id,
      title: row.title,
      description: row.description || "",
      cover: row.cover || "",
      sort: row.sort ?? 0
    };
  } else {
    form.value = { id: 0, title: "", description: "", cover: "", sort: 0 };
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  try {
    if (form.value.id) {
      await updateAlbum(form.value.id, {
        title: form.value.title,
        description: form.value.description,
        cover: form.value.cover,
        sort: form.value.sort
      });
      message("相册更新成功", { type: "success" });
    } else {
      await createAlbum({
        title: form.value.title,
        description: form.value.description,
        cover: form.value.cover,
        sort: form.value.sort
      });
      message("相册创建成功", { type: "success" });
    }
    dialogVisible.value = false;
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "操作失败", { type: "error" });
  }
}

async function handleDeleteAlbum(row: AlbumItem) {
  try {
    await deleteAlbum(row.id);
    message("删除成功", { type: "success" });
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "删除失败", { type: "error" });
  }
}

// ========== 照片管理 ==========
const drawerVisible = ref(false);
const currentAlbum = ref<AlbumItem | null>(null);
const photos = ref<PhotoItem[]>([]);
const {
  pagination: photoPagination,
  pageItems: photoPageItems,
  showPagination: showPhotoPagination,
  resetPage: resetPhotoPage,
  handlePageSizeChange: handlePhotoPageSizeChange
} = useLocalPagination(photos);
const photosLoading = ref(false);
const uploading = ref(false);
let photoRequest = 0;

async function openPhotos(row: AlbumItem) {
  currentAlbum.value = row;
  photos.value = [];
  resetPhotoPage();
  drawerVisible.value = true;
  await loadPhotos(row.id);
}

async function loadPhotos(albumId: number) {
  const request = ++photoRequest;
  photosLoading.value = true;
  try {
    const result = await getAlbumPhotos(albumId);
    if (request === photoRequest && currentAlbum.value?.id === albumId) {
      photos.value = result;
    }
  } catch (error: any) {
    if (request === photoRequest) {
      message(error?.message || "照片加载失败，请重新打开相册重试", {
        type: "error"
      });
    }
  } finally {
    if (request === photoRequest) photosLoading.value = false;
  }
}

/** 压缩/缩放图片：最大 2000px 宽/高，保持原格式（GIF 跳过压缩） */
function compressImage(file: File): Promise<File> {
  // GIF 不压缩，保留动画
  if (file.type === "image/gif") return Promise.resolve(file);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = outputType === "image/png" ? undefined : 0.8;

  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 2000;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        // PNG 保留透明通道：不填充背景
        if (outputType !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => {
            if (!blob) return resolve(file);
            const ext = outputType === "image/png" ? "png" : "jpg";
            const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
            resolve(new File([blob], name, { type: outputType }));
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function handleUpload(uploadFile: any) {
  const file = uploadFile.raw || uploadFile.file || uploadFile;
  if (!file || !currentAlbum.value) return;
  const albumId = currentAlbum.value.id;

  uploading.value = true;
  try {
    const compressed = await compressImage(file);
    const res = await uploadImage(compressed);
    await createPhoto({
      album_id: albumId,
      url: res.url,
      orientation: res.orientation,
      caption: file.name?.replace(/\.[^.]+$/, "") || ""
    });
    message("上传成功", { type: "success" });
    if (drawerVisible.value && currentAlbum.value?.id === albumId) {
      await loadPhotos(albumId);
    }
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "上传失败", { type: "error" });
  } finally {
    uploading.value = false;
  }
}

async function handleDeletePhoto(photo: PhotoItem) {
  try {
    await deletePhoto(photo.id);
    message("删除成功", { type: "success" });
    if (currentAlbum.value) {
      await loadPhotos(currentAlbum.value.id);
      onSearch();
    }
  } catch (e: any) {
    message(e?.message ?? "删除失败", { type: "error" });
  }
}

onMounted(() => onSearch());
</script>

<template>
  <div class="p-4">
    <!-- 相册列表 -->
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-medium">我的相册</span>
          <el-button
            type="primary"
            :icon="useRenderIcon('ri:add-circle-line')"
            @click="openDialog('新增相册')"
          >
            新增相册
          </el-button>
        </div>
      </template>

      <el-alert
        class="mb-4"
        type="info"
        :closable="false"
        title="在这里添加自己的相册和照片，发布网站后会展示到博客照片墙。下方的博客内置图库单独展示；这里没有相册，不代表博客没有照片。"
      />

      <pure-table
        :data="albumPageItems"
        :columns="columns"
        :loading="loading"
        :pagination="showAlbumPagination ? albumPagination : {}"
        align-whole="center"
        row-key="id"
        table-layout="auto"
        @page-size-change="handleAlbumPageSizeChange"
      >
        <template #cover="{ row }">
          <el-image
            v-if="row.cover"
            :src="row.cover"
            :preview-src-list="[row.cover]"
            fit="cover"
            class="w-12 h-12 rounded"
          />
          <span v-else class="text-gray-400 text-xs">无</span>
        </template>

        <template #operation="{ row }">
          <el-button
            link
            type="primary"
            :icon="useRenderIcon('ri:image-add-line')"
            @click="openPhotos(row)"
          >
            管理照片
          </el-button>
          <el-button
            link
            type="primary"
            :icon="useRenderIcon('ri:edit-line')"
            @click="openDialog('修改相册', row)"
          >
            修改
          </el-button>
          <el-popconfirm
            :title="`确认删除相册「${row.title}」及其所有照片？`"
            @confirm="handleDeleteAlbum(row)"
          >
            <template #reference>
              <el-button
                link
                type="danger"
                :icon="useRenderIcon('ri:delete-bin-line')"
              >
                删除
              </el-button>
            </template>
          </el-popconfirm>
        </template>
      </pure-table>
    </el-card>

    <el-card shadow="never" class="mt-4">
      <template #header>
        <span class="font-medium">博客内置图库 · 仅供查看</span>
      </template>
      <p class="mb-3 text-sm text-gray-500">
        这些是博客自带的文章封面和游戏图片。上传自己的照片，请使用上方“我的相册”。
      </p>
      <details
        v-for="album in builtInAlbums"
        :key="album.title"
        class="mb-3 rounded border border-gray-200 p-3 dark:border-gray-700"
      >
        <summary class="cursor-pointer font-medium">
          {{ album.title }}
          <span class="text-xs text-gray-400"
            >（{{ album.photos.length }} 张）</span
          >
        </summary>
        <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div
            v-for="photo in album.pages.pageItems.value"
            :key="photo.id"
            class="min-w-0"
          >
            <a
              :href="photo.sourceUrl || photo.url"
              target="_blank"
              rel="noopener noreferrer"
              :title="photo.sourceUrl ? '打开图片来源' : '打开图片'"
            >
              <img
                :src="photo.url"
                :alt="photo.caption"
                loading="lazy"
                class="aspect-video w-full rounded object-cover"
              />
            </a>
            <p
              class="mt-1 truncate text-xs text-gray-500"
              :title="photo.caption"
            >
              {{ photo.caption || photo.id }}
            </p>
          </div>
        </div>
        <el-pagination
          v-if="album.pages.showPagination.value"
          v-model:current-page="album.pages.pagination.currentPage"
          v-model:page-size="album.pages.pagination.pageSize"
          class="mt-4 flex-wrap gap-2"
          :total="album.pages.pagination.total"
          :page-sizes="album.pages.pagination.pageSizes"
          :pager-count="5"
          layout="prev, pager, next, sizes"
          @size-change="album.pages.handlePageSizeChange"
        />
      </details>
    </el-card>

    <!-- 新增/编辑相册对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="相册名称" prop="title">
          <el-input v-model="form.title" placeholder="请输入相册名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            placeholder="相册描述（可选）"
          />
        </el-form-item>
        <el-form-item label="封面 URL">
          <el-input v-model="form.cover" placeholder="封面图片 URL（可选）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 照片管理抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="`管理照片 — ${currentAlbum?.title ?? ''}`"
      size="60%"
      destroy-on-close
    >
      <!-- 上传区域 -->
      <el-upload
        drag
        multiple
        :show-file-list="false"
        :http-request="async () => undefined"
        :before-upload="() => false"
        :on-change="handleUpload"
        accept="image/*"
        class="mb-4"
      >
        <div class="flex flex-col items-center justify-center py-4">
          <el-icon v-if="!uploading" class="text-3xl text-gray-400 mb-2">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
            </svg>
          </el-icon>
          <el-icon v-else class="text-3xl text-blue-500 mb-2 is-loading">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z" />
            </svg>
          </el-icon>
          <span class="text-sm text-gray-500">
            {{ uploading ? "上传中..." : "将图片拖到此处，或点击上传" }}
          </span>
          <span class="text-xs text-gray-400 mt-1">
            支持 jpg / png / webp / gif（含动图），最大 10MB
          </span>
        </div>
      </el-upload>

      <!-- 照片网格 -->
      <div v-loading="photosLoading">
        <el-empty
          v-if="!photos.length && !photosLoading"
          description="暂无照片"
        />
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div
            v-for="photo in photoPageItems"
            :key="photo.id"
            class="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <el-image
              :src="photo.url"
              fit="cover"
              class="w-full aspect-square"
              lazy
              :preview-src-list="[photo.url]"
            />
            <div
              class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1.5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span class="truncate flex-1 mr-2">
                {{ photo.caption || "无标题" }}
              </span>
              <el-popconfirm
                title="确认删除此照片？"
                @confirm="handleDeletePhoto(photo)"
              >
                <template #reference>
                  <el-button
                    size="small"
                    type="danger"
                    circle
                    :icon="useRenderIcon('ri:delete-bin-line')"
                  />
                </template>
              </el-popconfirm>
            </div>
            <!-- 方向标签 -->
            <el-tag
              :type="photo.orientation === 'landscape' ? undefined : 'warning'"
              size="small"
              class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {{ photo.orientation === "landscape" ? "横" : "竖" }}
            </el-tag>
          </div>
        </div>
        <el-pagination
          v-if="showPhotoPagination"
          class="mt-4 justify-end"
          :total="photoPagination.total"
          :page-size="photoPagination.pageSize"
          :current-page="photoPagination.currentPage"
          :page-sizes="photoPagination.pageSizes"
          background
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePhotoPageSizeChange"
          @current-change="photoPagination.currentPage = $event"
        />
      </div>
    </el-drawer>
  </div>
</template>
