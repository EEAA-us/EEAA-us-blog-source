<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import { message } from "@/utils/message";
import {
  adminAppearance,
  updateAdminAppearance,
  resetAdminAppearance
} from "@/lib/admin-appearance";
import defaultPoster from "@/assets/blog-background.webp";
import { blogPhotoAlbums } from "@/lib/blog-media";
import Film from "~icons/ri/film-line";
import Picture from "~icons/ri/image-line";
import Palette from "~icons/ri/palette-line";
import { validHeroMediaUrl } from "../../../../../../lib/appearance";
import { getMediaCatalog, type MediaCatalog } from "@/api/siteConfig";
import { adminMediaPreview } from "@/lib/admin-hero-media";
import { useLocalPagination } from "@/lib/use-local-pagination";
const catalog = ref<MediaCatalog>({ version: 1, categories: [], items: [] });
const mediaLoading = ref(false),
  mediaError = ref("");
const mediaCategory = ref("");
const customAddress = ref("");
function useCustomMedia() {
  const url = customAddress.value.trim();
  if (!url || !validHeroMediaUrl(url)) {
    message("请输入HTTPS媒体地址或本站素材路径。", { type: "warning" });
    return;
  }
  change(
    adminAppearance.mediaKind === "video"
      ? { videoUrl: url, videoPoster: defaultPoster }
      : { gifUrl: url, gifPoster: defaultPoster }
  );
  customAddress.value = "";
}
const visibleMedia = computed(() =>
  catalog.value.items
    .filter(
      item =>
        item.enabled &&
        item.kind === adminAppearance.mediaKind &&
        catalog.value.categories.some(
          category => category.id === item.category && category.enabled
        ) &&
        (!mediaCategory.value || item.category === mediaCategory.value)
    )
    .sort((a, b) => a.order - b.order)
);
const mediaPages = useLocalPagination(visibleMedia);
const selectedMedia = computed(() =>
  catalog.value.items.find(
    item =>
      item.kind === adminAppearance.mediaKind &&
      item.url ===
        (adminAppearance.mediaKind === "gif"
          ? adminAppearance.gifUrl
          : adminAppearance.videoUrl)
  )
);
const currentPoster = computed(
  () =>
    adminMediaPreview(
      adminAppearance.mediaKind === "gif"
        ? adminAppearance.gifPoster
        : adminAppearance.videoPoster
    ) || defaultPoster
);
async function loadMedia() {
  mediaLoading.value = true;
  mediaError.value = "";
  try {
    catalog.value = await getMediaCatalog();
  } catch {
    mediaError.value = "动态素材读取失败，请重试。";
  } finally {
    mediaLoading.value = false;
  }
}
function selectDynamic(item: MediaCatalog["items"][number]) {
  change(
    item.kind === "video"
      ? { videoUrl: item.url, videoPoster: item.poster }
      : { gifUrl: item.url, gifPoster: item.poster }
  );
}
function setMediaKind(mediaKind: string) {
  customAddress.value = "";
  mediaCategory.value = "";
  mediaPages.resetPage();
  change({ mediaKind });
}
onMounted(loadMedia);
const selectedAlbum = ref(0);
const openGallery = ref(false);
const photos = computed(
  () => blogPhotoAlbums[selectedAlbum.value]?.photos ?? []
);
const photoPages = useLocalPagination(photos);
watch(selectedAlbum, photoPages.resetPage);
const backgroundModes = [
  { value: "video", label: "动态背景", detail: "视频与GIF动图", icon: Film },
  {
    value: "image",
    label: "静态图片",
    detail: "从图库或本机选择",
    icon: Picture
  },
  {
    value: "none",
    label: "纯色背景",
    detail: "使用后台主题底色",
    icon: Palette
  }
];
function setMode(mode: string) {
  openGallery.value = false;
  change({ mode });
}
function change(patch: Parameters<typeof updateAdminAppearance>[0]) {
  try {
    updateAdminAppearance(patch);
  } catch {
    message("无法保存设置：浏览器存储空间不足，请换一张较小的图片。", {
      type: "error"
    });
  }
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  ) {
    message("请选择 2MB 以内的 JPG、PNG 或 WebP 静态图片。", {
      type: "warning"
    });
    return;
  }
  const reader = new FileReader();
  reader.onload = () =>
    change({ wallpaper: String(reader.result), mode: "image" });
  reader.onerror = () => message("图片读取失败，请重试。", { type: "error" });
  reader.readAsDataURL(file);
}
</script>
<template>
  <section class="blog-appearance-settings">
    <div class="appearance-intro">
      <span>个人博客 / 我的工作空间</span>
      <h3>把后台调成喜欢的样子</h3>
      <p>只调整你当前浏览器里的管理后台，不会修改博客默认外观。</p>
      <p>访客仍可在博客里独立调整背景、颜色和字体，这里的设置不会限制他们。</p>
    </div>
    <div class="appearance-section">
      <h3>后台背景</h3>
      <p class="appearance-hint">
        选择管理页面后面的背景；图片和视频分开设置。
      </p>
      <div class="weight-options background-options">
        <button
          v-for="item in backgroundModes"
          :key="item.value"
          :aria-pressed="adminAppearance.mode === item.value"
          @click="setMode(item.value)"
        >
          <component :is="item.icon" aria-hidden="true" />
          <strong>{{ item.label }}</strong>
          <small>{{ item.detail }}</small>
          <span
            v-if="adminAppearance.mode === item.value"
            class="choice-check"
            aria-hidden="true"
            >✓</span
          >
        </button>
      </div>
      <div v-if="adminAppearance.mode === 'video'" class="background-detail">
        <div class="weight-options">
          <button
            :aria-pressed="adminAppearance.mediaKind === 'video'"
            @click="setMediaKind('video')"
          >
            循环视频</button
          ><button
            :aria-pressed="adminAppearance.mediaKind === 'gif'"
            @click="setMediaKind('gif')"
          >
            GIF动图
          </button>
        </div>
        <div class="wallpaper-current">
          <img
            :src="currentPoster"
            :alt="selectedMedia?.name || '当前动态背景封面'"
          />
          <span
            >{{
              selectedMedia?.name ||
              (adminAppearance.mediaKind === "gif" && !adminAppearance.gifUrl
                ? "尚未选择动图"
                : "自定义动态背景")
            }}
            ·
            {{
              adminAppearance.mediaKind === "video" ? "循环视频" : "GIF动图"
            }}</span
          >
        </div>
        <p class="appearance-hint">
          {{
            selectedMedia ? "上图是素材封面。" : "上图为占位封面。"
          }}动态画面在后台背景播放。下方只显示当前类型的素材，选中即可更换后台背景。
        </p>
        <p class="appearance-hint">
          默认视频使用4K原文件；其他素材使用博客已有原文件。开启系统“减少动态”时显示对应封面。
        </p>
        <label class="appearance-label">{{
          adminAppearance.mediaKind === "video" ? "博客视频库" : "博客动图库"
        }}</label>
        <p v-if="mediaLoading" class="appearance-hint" role="status">
          正在读取动态素材…
        </p>
        <p v-else-if="mediaError" class="appearance-hint" role="alert">
          {{ mediaError }}<el-button link @click="loadMedia">重试</el-button>
        </p>
        <template v-else>
          <el-select
            v-model="mediaCategory"
            aria-label="动态素材分类"
            placeholder="全部分类"
            @change="mediaPages.resetPage"
            ><el-option label="全部分类" value="" /><el-option
              v-for="category in catalog.categories.filter(
                item => item.enabled
              )"
              :key="category.id"
              :label="category.name"
              :value="category.id"
          /></el-select>
          <div class="wallpaper-grid dynamic-grid">
            <button
              v-for="item in mediaPages.pageItems.value"
              :key="item.id"
              :aria-label="`使用${item.kind === 'video' ? '视频' : '动图'}背景：${item.name}`"
              :aria-pressed="selectedMedia?.id === item.id"
              @click="selectDynamic(item)"
            >
              <img
                :src="adminMediaPreview(item.poster)"
                :alt="item.name"
                loading="lazy"
              /><span>{{ item.name }}</span>
            </button>
          </div>
          <p v-if="!visibleMedia.length" class="appearance-hint">
            此分类暂无该类型素材。可在“博客封面与素材”添加，对应素材会显示在这里。
          </p>
          <el-pagination
            v-if="mediaPages.showPagination.value"
            v-model:current-page="mediaPages.pagination.currentPage"
            :page-size="mediaPages.pagination.pageSize"
            :total="mediaPages.pagination.total"
            layout="prev, pager, next"
          />
        </template>
        <label class="appearance-label">{{
          adminAppearance.mediaKind === "video"
            ? "使用自己的视频"
            : "使用自己的动图"
        }}</label>
        <div class="custom-media-address">
          <el-input
            v-model="customAddress"
            :aria-label="
              adminAppearance.mediaKind === 'video'
                ? '后台视频地址'
                : '后台动图地址'
            "
            :placeholder="
              adminAppearance.mediaKind === 'video'
                ? '粘贴视频直链'
                : '粘贴GIF动图直链'
            "
          /><el-button @click="useCustomMedia">使用</el-button>
        </div>
        <p class="appearance-hint">
          仅用作当前浏览器的后台背景；不会添加到博客照片墙。
        </p>
        <el-button
          v-if="
            adminAppearance.mediaKind === 'gif' &&
            adminAppearance.gifUrl &&
            !selectedMedia
          "
          link
          @click="change({ gifUrl: '' })"
          >清除自定义动图</el-button
        >
      </div>
      <div
        v-else-if="adminAppearance.mode === 'image'"
        class="background-detail"
      >
        <div class="wallpaper-current">
          <img
            :src="
              adminAppearance.wallpaper === 'none'
                ? defaultPoster
                : adminAppearance.wallpaper
            "
            alt="当前后台静态背景"
          />
          <span>当前后台静态背景</span>
        </div>
        <p class="appearance-hint">
          下方选图只用于后台静态背景，不会添加到照片墙，也不会修改博客首页封面。
        </p>
        <div class="appearance-actions">
          <el-button @click="openGallery = !openGallery">{{
            openGallery ? "收起图库" : "博客图片库"
          }}</el-button
          ><label class="file-choice"
            >选择本机图片<input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="chooseFile"
          /></label>
        </div>
        <p class="appearance-hint">
          本机图片仅保存到此浏览器，支持 2MB 以内的
          JPG、PNG、WebP，不作为动态视频或动图上传。
        </p>
        <div v-if="openGallery" class="wallpaper-gallery">
          <el-select v-model="selectedAlbum" aria-label="背景图片分类"
            ><el-option
              v-for="(album, index) in blogPhotoAlbums"
              :key="album.title"
              :label="album.title"
              :value="index"
          /></el-select>
          <div class="wallpaper-grid">
            <button
              v-for="photo in photoPages.pageItems.value"
              :key="photo.id"
              :aria-label="`使用背景：${photo.caption}`"
              :title="photo.caption"
              :aria-pressed="adminAppearance.wallpaper === photo.url"
              @click="change({ wallpaper: photo.url })"
            >
              <img :src="photo.url" :alt="photo.caption" loading="lazy" />
            </button>
          </div>
          <el-pagination
            v-if="photoPages.showPagination.value"
            v-model:current-page="photoPages.pagination.currentPage"
            :page-size="photoPages.pagination.pageSize"
            :total="photoPages.pagination.total"
            layout="prev, pager, next"
          />
        </div>
      </div>
      <div v-else class="background-detail solid-preview">
        <Palette aria-hidden="true" />
        <strong>跟随后台明暗主题</strong>
        <p class="appearance-hint">
          不显示图片或视频。已选的静态图片会保留，切回静态图片即可继续使用。
        </p>
      </div>
      <template v-if="adminAppearance.mode !== 'none'">
        <label class="appearance-label"
          >背景淡化 <span>{{ adminAppearance.veil }}%</span></label
        >
        <el-slider
          aria-label="背景淡化"
          :model-value="adminAppearance.veil"
          :min="0"
          :max="100"
          @update:model-value="value => change({ veil: Number(value) })"
        />
        <p class="appearance-hint">
          越高背景越淡；100%时完全遮住图片或视频，动态背景也会暂停。
        </p>
      </template>
    </div>
    <div class="appearance-section">
      <h3>后台文字</h3>
      <label class="appearance-label">字体</label>
      <div class="weight-options font-options">
        <button
          v-for="item in [
            { label: '清晰黑体', value: 'sans' },
            { label: '书卷宋体', value: 'serif' },
            { label: '手札楷体', value: 'kai' }
          ]"
          :key="item.value"
          :aria-pressed="adminAppearance.font === item.value"
          @click="change({ font: item.value })"
        >
          {{ item.label }}
        </button>
      </div>
      <p class="appearance-hint">
        使用设备已有字体；没有对应字体时自动使用系统替代字体。
      </p>
      <label class="appearance-label"
        >界面字号 <span>{{ adminAppearance.scale }}%</span></label
      >
      <el-slider
        aria-label="后台文字大小"
        :model-value="adminAppearance.scale"
        :min="90"
        :max="125"
        :step="5"
        @update:model-value="value => change({ scale: Number(value) })"
      />
      <label class="appearance-label">正文粗细</label>
      <div class="weight-options">
        <button
          v-for="item in [
            { label: '原样', value: 400 },
            { label: '稍粗', value: 500 },
            { label: '加粗', value: 600 }
          ]"
          :key="item.value"
          :aria-pressed="adminAppearance.weight === item.value"
          @click="change({ weight: item.value })"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="admin-type-preview">
        <strong>记录的另一面</strong>
        <p>整理内容，也留一点时间给生活。</p>
        <small>仅预览后台文字，不改变文章正文。</small>
      </div>
    </div>
    <el-button text @click="resetAdminAppearance()"
      >恢复后台背景与文字</el-button
    >
  </section>
</template>
<style scoped>
.blog-appearance-settings {
  color: var(--blog-ink);
}
.appearance-intro {
  padding: 18px;
  background: linear-gradient(
    130deg,
    var(--el-color-primary-light-9),
    var(--blog-surface)
  );
  border: 1px solid var(--blog-border);
  border-radius: 18px;
  margin-bottom: 22px;
}
.appearance-intro span {
  font-size: 11px;
  color: var(--blog-accent);
  letter-spacing: 0.08em;
}
.appearance-intro h3 {
  margin: 8px 0;
  font-size: 18px;
}
.appearance-intro p,
.appearance-hint {
  color: var(--blog-muted);
  font-size: 12px;
  line-height: 1.8;
}
.appearance-section {
  border-bottom: 1px solid var(--blog-border);
  margin-bottom: 20px;
  padding-bottom: 20px;
}
.appearance-section h3 {
  font-size: 16px;
  font-weight: 650;
  margin: 0 0 14px;
}
.wallpaper-current {
  aspect-ratio: 16 / 9;
  position: relative;
  border-radius: 16px;
  background-color: var(--blog-bg);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  margin-bottom: 12px;
}
.wallpaper-current img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.wallpaper-current span {
  position: absolute;
  bottom: 0;
  left: 0;
  padding: 6px 12px;
  background: #222a;
  color: white;
  font-size: 12px;
  border-radius: 0 10px 0 0;
}
.appearance-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.file-choice {
  border: 1px solid var(--blog-border);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
}
.file-choice input {
  width: 1px;
  height: 1px;
  opacity: 0;
  position: absolute;
}
.file-choice:focus-within {
  outline: 2px solid var(--blog-accent);
}
.wallpaper-gallery {
  margin-top: 12px;
}
.background-detail > .weight-options {
  margin-bottom: 12px;
}
.custom-media-address {
  display: flex;
  gap: 8px;
}
.custom-media-address .el-input {
  min-width: 0;
}
.wallpaper-grid.dynamic-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-height: 320px;
}
.wallpaper-grid.dynamic-grid button {
  height: auto;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color);
}
.wallpaper-grid.dynamic-grid img {
  height: 78px;
}
.wallpaper-grid.dynamic-grid span {
  padding: 7px 5px;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--blog-ink);
}
.wallpaper-grid.dynamic-grid button[aria-pressed="true"] {
  background: var(--el-color-primary-light-9);
}
.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-height: 270px;
  overflow-y: auto;
  margin-top: 12px;
}
.wallpaper-grid button {
  border: 2px solid transparent;
  padding: 0;
  border-radius: 9px;
  height: 65px;
  overflow: hidden;
  cursor: pointer;
}
.wallpaper-grid button[aria-pressed="true"] {
  border-color: var(--blog-accent);
}
.wallpaper-grid img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.appearance-label {
  display: flex;
  justify-content: space-between;
  margin: 14px 0 8px;
  font-size: 13px;
  font-weight: 600;
}
.appearance-label span {
  color: var(--blog-muted);
  font-weight: 400;
}
.weight-options {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--el-fill-color);
  border-radius: 12px;
}
.weight-options button {
  min-width: 0;
  flex: 1;
  padding: 8px;
  border: 0;
  background: transparent;
  border-radius: 9px;
  color: var(--blog-ink);
  cursor: pointer;
}
.weight-options button[aria-pressed="true"] {
  background: var(--blog-accent);
  color: white;
}
.background-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: transparent;
  padding: 0;
  gap: 8px;
}
.background-options button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 5px;
  background: var(--el-fill-color);
  border: 1px solid transparent;
  border-radius: 16px;
  font-size: 12px;
}
.background-options button svg {
  font-size: 21px;
}
.background-options button small {
  font-size: 10px;
  line-height: 1.5;
  color: var(--blog-muted);
}
.background-options button[aria-pressed="true"] {
  background: var(--el-color-primary-light-9);
  color: var(--blog-accent);
  border-color: var(--blog-accent);
}
.choice-check {
  position: absolute;
  top: 6px;
  right: 8px;
}
.background-detail {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--blog-border);
  border-radius: 18px;
  background: var(--blog-surface);
}
.solid-preview {
  display: flex;
  align-items: center;
  flex-direction: column;
  text-align: center;
  gap: 10px;
  padding: 24px 14px;
}
.solid-preview svg {
  font-size: 24px;
  color: var(--blog-accent);
}
.appearance-actions {
  flex-wrap: wrap;
}
.admin-type-preview {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--blog-border);
  border-radius: 14px;
  background: var(--blog-surface);
}
.admin-type-preview p {
  font-size: calc(14px * var(--admin-text-scale));
  margin: 8px 0;
}
.admin-type-preview small {
  color: var(--blog-muted);
  font-size: 11px;
}
</style>
