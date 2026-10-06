<script setup lang="ts">
import { projects } from "../../../../../app/projects/projectsData";
import { getBlogMediaUrl } from "@/lib/blog-media";
import { onMounted, ref } from "vue";
import { getProjectCovers, saveProjectCovers } from "@/api/siteConfig";
import { uploadImage } from "@/api/album";
import { blogPhotoAlbums } from "@/lib/blog-media";
import { message } from "@/utils/message";
import { useLocalPagination } from "@/lib/use-local-pagination";
defineOptions({ name: "ProjectIndex" });

const covers = ref<Record<string, string>>({});
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const choosing = ref<string | null>(null);
const dirty = ref(false);
const selectedAlbum = ref(0);
const projectPages = useLocalPagination(() => projects);
const galleryPages = useLocalPagination(
  () => blogPhotoAlbums[selectedAlbum.value]?.photos ?? []
);
const uploadInput = ref<HTMLInputElement>();
const uploadTarget = ref("");
const uploading = ref(false);
function openUpload(projectId: string) {
  uploadTarget.value = projectId;
  uploadInput.value?.click();
}
onMounted(async () => {
  try {
    covers.value = (await getProjectCovers()).covers;
  } catch (error: any) {
    loadError.value = error?.message || "封面配置加载失败，无法保存";
  } finally {
    loading.value = false;
  }
});
function selectCover(projectId: string, url: string) {
  covers.value = { ...covers.value, [projectId]: url };
  dirty.value = true;
  choosing.value = null;
}
async function uploadCover(projectId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    message("请选择 10 MB 以内的 JPG、PNG 或 WebP 图片", { type: "warning" });
    input.value = "";
    return;
  }
  try {
    uploading.value = true;
    selectCover(projectId, (await uploadImage(file)).url);
  } catch (error: any) {
    message(error?.message || "图片上传失败", { type: "error" });
  } finally {
    uploading.value = false;
    input.value = "";
  }
}
async function saveDraft() {
  if (
    saving.value ||
    uploading.value ||
    loading.value ||
    loadError.value ||
    !dirty.value
  )
    return;
  const snapshot = { ...covers.value };
  saving.value = true;
  try {
    const saved = (await saveProjectCovers({ covers: snapshot })).covers;
    if (JSON.stringify(covers.value) === JSON.stringify(snapshot)) {
      covers.value = saved;
      dirty.value = false;
      message("项目封面已保存", { type: "success" });
    } else {
      message("先前的项目封面已保存，后续调整仍保留在草稿中", {
        type: "success"
      });
    }
  } catch (error: any) {
    message(error?.message || "保存失败", { type: "error" });
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <section class="blog-project-directory">
    <input
      ref="uploadInput"
      type="file"
      hidden
      accept="image/jpeg,image/png,image/webp"
      @change="uploadCover(uploadTarget, $event)"
    />
    <header>
      <div>
        <span>时光博客 / 项目与学习</span>
        <h1>项目图片</h1>
        <p>
          修改博客项目列表和详情页的封面。选择后先预览，保存后可在这台电脑的博客预览中查看；发布网站后更新到线上。项目正文在文章列表编辑。
        </p>
      </div>
      <router-link to="/post/index" class="project-edit-link"
        >管理项目文章 ↗</router-link
      >
      <el-button
        type="primary"
        :disabled="loading || !!loadError || !dirty || uploading"
        :loading="saving"
        @click="saveDraft"
        >保存项目图片</el-button
      >
    </header>
    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      :closable="false"
      class="mb-4"
    />
    <article v-for="project in projectPages.pageItems.value" :key="project.id">
      <img
        :src="getBlogMediaUrl(covers[project.id] || project.coverImage)"
        :alt="project.name"
        loading="lazy"
      />
      <div class="project-directory-content">
        <div class="cover-editor">
          <strong>项目封面</strong>
          <span>{{
            dirty ? "有图片调整尚未保存" : "完整封面预览，不裁切图片"
          }}</span>
          <el-button
            class="change-cover-button"
            :disabled="loading || !!loadError || uploading"
            @click="choosing = choosing === project.id ? null : project.id"
            >{{
              choosing === project.id ? "收起图库" : "更换项目图片"
            }}</el-button
          >
          <div v-if="choosing === project.id" class="cover-picker">
            <div class="upload-cover-row">
              <el-button
                type="primary"
                plain
                :loading="uploading"
                @click="openUpload(project.id)"
                >上传自己的图片</el-button
              >
              <span
                >JPG、PNG、WebP · 最大 10 MB<br />上传后预览，点击“保存项目图片”确认</span
              >
            </div>
            <p>或者从博客图库选择</p>
            <el-select
              v-model="selectedAlbum"
              aria-label="项目图库分类"
              @change="galleryPages.resetPage"
              ><el-option
                v-for="(album, index) in blogPhotoAlbums"
                :key="album.title"
                :label="album.title"
                :value="index"
            /></el-select>
            <div class="cover-gallery">
              <button
                v-for="photo in galleryPages.pageItems.value"
                :key="photo.id"
                type="button"
                :title="photo.caption"
                :disabled="uploading"
                :class="{
                  selected:
                    (covers[project.id] || project.coverImage) ===
                    photo.originalUrl
                }"
                @click="selectCover(project.id, photo.originalUrl)"
              >
                <img :src="photo.url" :alt="photo.caption" loading="lazy" />
              </button>
            </div>
            <el-pagination
              v-if="galleryPages.showPagination.value"
              v-model:current-page="galleryPages.pagination.currentPage"
              :page-size="galleryPages.pagination.pageSize"
              :page-sizes="galleryPages.pagination.pageSizes"
              :total="galleryPages.pagination.total"
              layout="prev, pager, next, sizes"
              @size-change="galleryPages.handlePageSizeChange"
            />
          </div>
        </div>
        <div class="project-kicker">
          {{ project.statusLabel }} · {{ project.updatedAt }}
        </div>
        <h2>{{ project.name }}</h2>
        <p>{{ project.longDescription }}</p>
        <div class="project-tech">
          <span v-for="tech in project.techStack" :key="tech">{{ tech }}</span>
        </div>
        <details v-if="project.outline?.length">
          <summary>
            文章目录 · {{ project.outline.filter(item => item.slug).length }} 篇
          </summary>
          <ul>
            <li v-for="item in project.outline" :key="item.id">
              <strong>{{ item.title }}</strong
              ><span>{{ item.description }}</span>
            </li>
          </ul>
        </details>
      </div>
    </article>
    <el-pagination
      v-if="projectPages.showPagination.value"
      v-model:current-page="projectPages.pagination.currentPage"
      :page-size="projectPages.pagination.pageSize"
      :page-sizes="projectPages.pagination.pageSizes"
      :total="projectPages.pagination.total"
      layout="prev, pager, next, sizes"
      @size-change="projectPages.handlePageSizeChange"
    />
  </section>
</template>
<style scoped>
.blog-project-directory {
  padding: 24px;
}
header {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 24px;
  border: 1px solid var(--blog-border);
  border-radius: 22px;
  background: var(--blog-panel);
}
header span,
.project-kicker {
  color: var(--blog-accent);
  font-size: 12px;
}
h1 {
  font-size: calc(26px * var(--admin-text-scale));
  margin: 8px 0;
}
p {
  color: var(--blog-muted);
  line-height: 1.8;
}
.project-edit-link {
  white-space: nowrap;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 13px;
}
article {
  display: grid;
  grid-template-columns: minmax(240px, 32%) minmax(0, 1fr);
  margin-bottom: 20px;
  background: var(--blog-panel);
  border: 1px solid var(--blog-border);
  border-radius: 22px;
  overflow: hidden;
}
.cover-editor {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
  color: var(--blog-muted);
  font-size: 12px;
}
.change-cover-button {
  justify-self: start;
  margin: 2px 0;
  border-radius: 10px;
}
.upload-cover-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--blog-border);
}
.upload-cover-row span {
  line-height: 1.7;
}
.cover-editor > span {
  overflow-wrap: anywhere;
}
.cover-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
  padding: 3px;
}
.cover-gallery h3 {
  grid-column: 1 / -1;
  margin-top: 12px;
  color: var(--blog-accent);
}
.cover-picker {
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid var(--blog-border);
  border-radius: 14px;
  background: var(--el-color-primary-light-9);
}
.cover-picker :deep(.el-pagination) {
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.cover-gallery button {
  height: 54px;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}
.cover-gallery button.selected {
  border-color: var(--el-color-primary);
}
.cover-gallery img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
article > img {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 10;
  align-self: center;
  padding: 12px;
  object-fit: contain;
  background: var(--el-color-primary-light-9);
}
.project-directory-content {
  padding: 24px;
}
h2 {
  font-size: calc(22px * var(--admin-text-scale));
  margin: 8px 0;
}
.project-tech {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0;
}
.project-tech span {
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 4px 10px;
  font-size: 12px;
}
summary {
  cursor: pointer;
  padding-top: 12px;
  border-top: 1px solid var(--blog-border);
  color: var(--blog-accent);
}
ul {
  list-style: none;
  padding: 10px 0 0;
}
li {
  padding: 10px 0;
  border-bottom: 1px solid var(--blog-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
li span {
  color: var(--blog-muted);
  font-size: 12px;
}
@media (max-width: 700px) {
  header {
    flex-direction: column;
  }
  article {
    grid-template-columns: 1fr;
  }
  article > img {
    height: 180px;
    min-height: 0;
  }
  .blog-project-directory {
    padding: 12px;
  }
}
</style>
