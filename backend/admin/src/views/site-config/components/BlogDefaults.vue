<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { http } from "@/utils/http";
import { message } from "@/utils/message";
import {
  defaultAppearance,
  normalizeAppearance,
  fontStyles,
  textures,
  coverEffects,
  resolveAppearance,
  validHeroMediaUrl
} from "../../../../../../lib/appearance";
import { siteConfig } from "../../../../../../siteConfig";
import { getAlbums, getAlbumPhotos, type AlbumItem } from "@/api/album";
import BlogPalette from "./BlogPalette.vue";
import BlogSettingField from "./BlogSettingField.vue";
import { getBlogMediaUrl } from "@/lib/blog-media";
import { adminMediaPreview } from "@/lib/admin-hero-media";
import { useLocalPagination } from "@/lib/use-local-pagination";
import {
  blogFallingEffects,
  readBlogAppearanceDefaults
} from "../../../../../../lib/blog-appearance-defaults";
import { getMediaCatalog, type MediaCatalogItem } from "@/api/siteConfig";
import { blogPhotoAlbums } from "@/lib/blog-media";
const draft = ref(readBlogAppearanceDefaults(null));
const loading = ref(true),
  saving = ref(false),
  error = ref("");
const media = ref<MediaCatalogItem[]>([]);
const selectedTab = ref("主题与字体");
const galleryOpen = ref(false);
const albumIndex = ref(0);
const gallerySource = ref<"wall" | "builtin">("wall");
const galleryTarget = ref("background");
const serverAlbums = ref<AlbumItem[]>([]);
const serverPhotos = ref<
  { id: string; caption: string; url: string; originalUrl: string }[]
>([]);
const galleryLoading = ref(false),
  galleryError = ref("");
let galleryRequest = 0;
const galleryAlbums = computed(() =>
  gallerySource.value === "builtin"
    ? [
        {
          title: "原有封面",
          photos: siteConfig.heroImageLibrary.map(item => ({
            id: item.url,
            caption: item.name,
            originalUrl: item.url,
            url: getBlogMediaUrl(item.url)
          }))
        }
      ]
    : [
        ...blogPhotoAlbums,
        ...serverAlbums.value.map(album => ({
          title: album.title,
          photos: serverPhotos.value
        }))
      ]
);
const photos = computed(
  () => galleryAlbums.value[albumIndex.value]?.photos ?? []
);
async function loadSelectedAlbum() {
  const album = serverAlbums.value[albumIndex.value - blogPhotoAlbums.length];
  const request = ++galleryRequest;
  serverPhotos.value = [];
  galleryError.value = "";
  if (gallerySource.value !== "wall" || !album) {
    galleryLoading.value = false;
    return;
  }
  galleryLoading.value = true;
  try {
    const data = await getAlbumPhotos(album.id);
    if (request === galleryRequest)
      serverPhotos.value = data.map(photo => ({
        id: String(photo.id),
        caption: photo.caption || "我的照片",
        originalUrl: photo.url,
        url: getBlogMediaUrl(photo.url)
      }));
  } catch {
    if (request === galleryRequest)
      galleryError.value = "相册读取失败，请重试。";
  } finally {
    if (request === galleryRequest) galleryLoading.value = false;
  }
}
watch([albumIndex, gallerySource], () => {
  photoPages.resetPage();
  void loadSelectedAlbum();
});
async function openGallery(target: string) {
  galleryTarget.value = target;
  gallerySource.value = "wall";
  albumIndex.value = 0;
  galleryOpen.value = true;
  galleryError.value = "";
  try {
    serverAlbums.value = await getAlbums();
  } catch {
    galleryError.value = "个人相册读取失败，仍可选择内置图库；重新打开可重试。";
  }
}
function chooseGalleryImage(url: string) {
  if (galleryTarget.value === "background") draft.value.background.image = url;
  else if (galleryTarget.value === "add") {
    const slides = [...new Set([...draft.value.preferences.heroSlides, url])];
    if (slides.length > 50) {
      coverError.value = "最多选择50张图片，请先移除一些。";
      return;
    }
    setValue("heroSlides", slides);
  } else {
    const slides = [...draft.value.preferences.heroSlides];
    const targetIndex = slides.indexOf(galleryTarget.value),
      existingIndex = slides.indexOf(url);
    if (targetIndex < 0) return;
    if (existingIndex >= 0)
      [slides[targetIndex], slides[existingIndex]] = [
        slides[existingIndex],
        slides[targetIndex]
      ];
    else slides[targetIndex] = url;
    setValue("heroSlides", slides);
  }
  coverError.value = "";
  galleryOpen.value = false;
}
const slideAddress = ref(""),
  mediaAddress = ref(""),
  mediaName = ref(""),
  coverError = ref("");
const customMedia = computed(() =>
  draft.value.preferences.heroCustomMedia.filter(
    item => item.kind === draft.value.preferences.heroMediaKind
  )
);
function usableAddress(url: string) {
  return !!url && url.length <= 1500 && validHeroMediaUrl(url);
}
function addSlides() {
  const urls = slideAddress.value
    .split(/\r?\n/)
    .map(url => url.trim())
    .filter(Boolean);
  if (
    !urls.length ||
    urls.some(url => !usableAddress(url) || /\.(mp4|webm)(\?|$)/i.test(url))
  ) {
    coverError.value = "请填写图片直链或本站图片路径，每行一张。";
    return;
  }
  const slides = [...new Set([...draft.value.preferences.heroSlides, ...urls])];
  if (slides.length > 50) {
    coverError.value = "最多选择50张图片，请先移除一些。";
    return;
  }
  setValue("heroSlides", slides);
  slideAddress.value = "";
  coverError.value = "";
}
function removeSlide(url: string) {
  if (draft.value.preferences.heroSlides.length > 1)
    setValue(
      "heroSlides",
      draft.value.preferences.heroSlides.filter(slide => slide !== url)
    );
}
function selectSlide(url: string) {
  if (draft.value.preferences.heroMode === "fixed")
    setValue("heroSlides", [
      url,
      ...draft.value.preferences.heroSlides.filter(slide => slide !== url)
    ]);
  else removeSlide(url);
}
function addCustomMedia() {
  const url = mediaAddress.value.trim(),
    kind = draft.value.preferences.heroMediaKind;
  if (!usableAddress(url)) {
    coverError.value = "请输入素材HTTPS直链或本站文件路径。";
    return;
  }
  if (
    (kind === "gif" && /\.(mp4|webm)(\?|$)/i.test(url)) ||
    (kind === "video" && /\.(gif|webp|png|jpg|jpeg)(\?|$)/i.test(url))
  ) {
    coverError.value = "地址与素材类型不一致，请切换上方的视频／动图选项。";
    return;
  }
  const existing = draft.value.preferences.heroCustomMedia.find(
    item => item.url === url
  );
  if (!existing && draft.value.preferences.heroCustomMedia.length >= 50) {
    coverError.value = "素材库已满，请先删除一些素材。";
    return;
  }
  const item = {
    id: existing?.id ?? crypto.randomUUID(),
    name:
      mediaName.value.trim() || (kind === "video" ? "我的视频" : "我的动图"),
    url,
    kind
  };
  setValue("heroCustomMedia", [
    ...draft.value.preferences.heroCustomMedia.filter(
      entry => entry.url !== url
    ),
    item
  ]);
  setValue("heroMediaUrl", url);
  mediaAddress.value = "";
  mediaName.value = "";
  coverError.value = "";
}
function removeCustomMedia(id: string, url: string) {
  setValue(
    "heroCustomMedia",
    draft.value.preferences.heroCustomMedia.filter(item => item.id !== id)
  );
  if (draft.value.preferences.heroMediaUrl === url)
    setValue(
      "heroMediaUrl",
      media.value.find(
        item => item.kind === draft.value.preferences.heroMediaKind
      )?.url ?? ""
    );
}
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const systemDark = ref(darkQuery.matches);
function updateDark() {
  systemDark.value = darkQuery.matches;
}
darkQuery.addEventListener("change", updateDark);
onBeforeUnmount(() => darkQuery.removeEventListener("change", updateDark));
const previewColors = computed(
  () =>
    resolveAppearance(
      draft.value.preferences,
      draft.value.theme === "dark" ||
        (draft.value.theme === "system" && systemDark.value)
    ).roles
);
const photoPages = useLocalPagination(photos);
const mediaCategory = ref("");
const mediaCategories = ref<{ id: string; name: string }[]>([]);
const availableCategories = computed(() =>
  mediaCategories.value.filter(category =>
    media.value.some(
      item =>
        item.category === category.id &&
        item.kind === draft.value.preferences.heroMediaKind
    )
  )
);
const activeCategory = computed(() =>
  availableCategories.value.some(c => c.id === mediaCategory.value)
    ? mediaCategory.value
    : (media.value.find(
        item =>
          item.url === draft.value.preferences.heroMediaUrl &&
          item.kind === draft.value.preferences.heroMediaKind
      )?.category ?? availableCategories.value[0]?.id)
);
const visibleMedia = computed(() =>
  media.value.filter(
    item =>
      item.kind === draft.value.preferences.heroMediaKind &&
      item.category === activeCategory.value
  )
);
const mediaPages = useLocalPagination(visibleMedia);
const selectedMedia = computed(() =>
  media.value.find(item => item.url === draft.value.preferences.heroMediaUrl)
);
const backgroundUrl = ref("");
function useBackgroundUrl() {
  const url = backgroundUrl.value.trim();
  if (
    (url.startsWith("/") && !url.startsWith("//")) ||
    /^https:\/\//i.test(url)
  ) {
    draft.value.background.image = url;
    backgroundUrl.value = "";
  } else message("请输入HTTPS图片直链或本站路径。", { type: "warning" });
}
const enumOptions: Record<string, Record<string, string>> = {
  fontStyle: Object.fromEntries(
    Object.entries(fontStyles).map(([k, v]) => [k, v.label])
  ),
  texture: textures,
  coverEffect: coverEffects,
  layout: { list: "列表", grid: "网格" },
  background: { image: "背景图片", solid: "主题底色" },
  homeTextWeight: { default: "原样", medium: "稍粗", bold: "加粗" },
  articleTextWeight: { default: "原样", medium: "稍粗", bold: "加粗" },
  navigationTextWeight: { default: "原样", medium: "稍粗", bold: "加粗" },
  coverTextWeight: { default: "原样", medium: "稍粗", bold: "加粗" },
  heroMediaKind: { video: "循环视频", gif: "GIF / 动态图片" },
  heroMode: { fixed: "固定图片", slideshow: "自动切图", animated: "动态封面" },
  waveLayerStyle: { layered: "逐层变淡", uniform: "每层相同" },
  readingLayout: {
    default: "原始布局",
    narrow: "窄屏阅读",
    custom: "自定义宽度",
    focus: "专注阅读"
  },
  navigationScroll: { smooth: "平滑滚动", instant: "直接跳转" },
  language: { zh: "简体中文", en: "English", ja: "日本語" },
  subtitleLanguage: {
    auto: "跟随界面",
    zh: "简体中文",
    en: "English",
    ja: "日本語"
  },
  subtitleEffect: {
    typewriter: "逐字打字",
    fade: "柔和淡入",
    rise: "轻盈上浮",
    static: "静态文字"
  },
  live2dCharacter: {
    cyrene: "昔涟 · Q版（Spine）",
    firefly: "流萤 · Q版（Live2D）",
    furina: "芙宁娜 · Q版（Spine）",
    march7thQ: "三月七 · Q版（Spine）",
    silverwolf: "银狼 · Q版（Spine）",
    herta: "黑塔 · Q版（Spine）",
    off: "关闭"
  }
};
type Field = {
  key: keyof typeof defaultAppearance;
  label: string;
  range?: [number, number, number?];
};
const groups: Record<string, Field[]> = {
  封面与图片: [
    { key: "heroMode", label: "全站封面模式" },
    { key: "heroInterval", label: "轮播间隔（秒）", range: [0.5, 10, 0.5] },
    { key: "coverEffect", label: "封面衔接特效" },
    { key: "waveLayerStyle", label: "后景各层的浓度" },
    { key: "waveSpeed", label: "移动速度（%）", range: [40, 300, 5] },
    { key: "waveOpacity", label: "前景不透明度（%）", range: [0, 100, 5] },
    { key: "waveBackOpacity", label: "后景不透明度（%）", range: [0, 100, 5] },
    { key: "waveAmplitude", label: "轮廓幅度（%）", range: [60, 150, 5] },
    { key: "waveLayers", label: "波浪层数", range: [1, 5] },
    { key: "reduceMotion", label: "界面动画" },
    { key: "welcomeEnabled", label: "入站欢迎动画" },
    { key: "live2dCharacter", label: "选择看板娘" }
  ],
  主题与字体: [
    { key: "fontStyle", label: "字体风格" },
    { key: "homeTextScale", label: "首页文字大小", range: [100, 115] },
    { key: "homeTextWeight", label: "首页文字粗细" },
    { key: "articleTextScale", label: "文章正文大小", range: [100, 150] },
    { key: "articleTextWeight", label: "文章正文粗细" },
    { key: "navigationTextScale", label: "导航文字大小", range: [100, 110] },
    { key: "navigationTextWeight", label: "导航文字粗细" },
    { key: "coverTitleScale", label: "封面标题字号（%）", range: [70, 140, 5] },
    {
      key: "coverSubtitleScale",
      label: "封面副标题字号（%）",
      range: [80, 150, 5]
    },
    { key: "coverTextWeight", label: "封面文字粗细" },
    { key: "readingLayout", label: "阅读布局模式" },
    {
      key: "readingPageWidth",
      label: "阅读页面最大宽度",
      range: [1100, 1920, 4]
    },
    {
      key: "readingContentWidth",
      label: "正文最大宽度",
      range: [640, 1120, 16]
    },
    { key: "focusContentWidth", label: "正文最大宽度", range: [640, 1440, 16] },
    { key: "articleHoverGuide", label: "正文悬停提示线" },
    { key: "articleHoverFrame", label: "正文悬停虚线框" }
  ],
  页面与背景: [
    { key: "layout", label: "首页文章布局" },
    { key: "background", label: "页面背景" },
    { key: "texture", label: "背景纹理" },
    { key: "textureOpacity", label: "纹理强度", range: [5, 25] },
    { key: "navigationScroll", label: "导航定位方式" },
    { key: "language", label: "界面语言" },
    { key: "subtitleLanguage", label: "首页副标题语言" },
    { key: "subtitleEffect", label: "副标题效果" }
  ]
};
const typography = groups["主题与字体"];
const layoutFields = groups["页面与背景"];
const coverFields = groups["封面与图片"];
groups["文章阅读"] = typography.splice(
  typography.findIndex(f => f.key === "readingLayout")
);
groups["语言与入站"] = layoutFields.filter(f =>
  ["language", "subtitleLanguage", "subtitleEffect"].includes(f.key)
);
groups["语言与入站"].push(coverFields.find(f => f.key === "welcomeEnabled")!);
groups["页面跳转"] = layoutFields.filter(f => f.key === "navigationScroll");
groups["动画与特效"] = coverFields.filter(f =>
  ["reduceMotion", "live2dCharacter"].includes(f.key)
);
groups["页面与背景"] = layoutFields.filter(f =>
  ["layout", "background", "texture", "textureOpacity"].includes(f.key)
);
groups["封面与图片"] = coverFields.filter(
  f => !["welcomeEnabled", "reduceMotion", "live2dCharacter"].includes(f.key)
);
groups["页面与背景"].push(
  { key: "opacity", label: "卡片不透明度", range: [88, 100] },
  ...groups["文章阅读"]
);
delete groups["文章阅读"];
const headings: Partial<Record<Field["key"], string>> = {
  homeTextScale: "首页卡片文字",
  articleTextScale: "文章与项目正文",
  navigationTextScale: "顶部导航文字",
  coverTitleScale: "顶部封面文字",
  readingLayout: "文章阅读",
  live2dCharacter: "游戏看板娘",
  coverEffect: "封面衔接"
};
groups["页面与背景"].sort((a, b) => {
  const order = [
    "background",
    "layout",
    "texture",
    "textureOpacity",
    "opacity",
    "readingLayout",
    "readingPageWidth",
    "readingContentWidth",
    "focusContentWidth",
    "articleHoverGuide",
    "articleHoverFrame"
  ];
  return order.indexOf(a.key) - order.indexOf(b.key);
});
const sectionOrder = [
  "主题与字体",
  "封面与图片",
  "页面与背景",
  "动画与特效",
  "页面跳转",
  "语言与入站"
];
const fields = computed(() =>
  groups[selectedTab.value].filter(field => {
    const preferences = draft.value.preferences;
    if (field.key === "heroInterval")
      return preferences.heroMode === "slideshow";
    if (field.key === "readingPageWidth" || field.key === "readingContentWidth")
      return preferences.readingLayout === "custom";
    if (field.key === "focusContentWidth")
      return preferences.readingLayout === "focus";
    if (field.key === "textureOpacity") return preferences.texture !== "none";
    return true;
  })
);
function setValue(key: Field["key"], value: unknown) {
  if (key === "heroMode" || key === "heroMediaKind") {
    coverError.value = "";
    slideAddress.value = "";
    mediaAddress.value = "";
    mediaName.value = "";
  }
  if (
    key === "heroMediaKind" &&
    value !== draft.value.preferences.heroMediaKind
  ) {
    draft.value.preferences.heroMediaUrl =
      media.value.find(item => item.kind === value)?.url ?? "";
    mediaCategory.value = "";
    mediaPages.resetPage();
  }
  draft.value.preferences = normalizeAppearance({
    ...draft.value.preferences,
    [key]: value
  });
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await http.request(
      "get",
      "/api/site-config/appearance-defaults"
    );
    draft.value = readBlogAppearanceDefaults(result);
    slideAddress.value = "";
    mediaAddress.value = "";
    mediaName.value = "";
    coverError.value = "";
  } catch {
    error.value = "默认外观读取失败，请重新读取后再保存。";
  } finally {
    loading.value = false;
  }
}
const preferencesTooLarge = computed(
  () =>
    new TextEncoder().encode(JSON.stringify(draft.value.preferences)).length >
    48 * 1024
);
async function save() {
  if (saving.value || loading.value) return;
  if (preferencesTooLarge.value) {
    message("封面地址等设置总量超过48KiB，请缩短地址或移除部分素材后再保存。", {
      type: "warning"
    });
    return;
  }
  saving.value = true;
  const snapshot = JSON.stringify(draft.value);
  try {
    const preferences = { ...normalizeAppearance(draft.value.preferences) };
    delete (preferences as Partial<typeof preferences>).live2dPosition;
    const saved = readBlogAppearanceDefaults(
      await http.request("put", "/api/site-config/appearance-defaults", {
        data: { ...draft.value, preferences }
      })
    );
    if (JSON.stringify(draft.value) !== snapshot) {
      message(
        "先前的默认外观已保存；保存期间的新调整仍留在草稿中，请再次保存。",
        { type: "success" }
      );
      return;
    }
    draft.value = saved;
    message("默认外观已保存；刷新博客预览，线上需要重新发布。", {
      type: "success"
    });
  } catch {
    message("保存失败，设置未确认，请重试。", { type: "error" });
  } finally {
    saving.value = false;
  }
}
onMounted(() => {
  load();
  getMediaCatalog()
    .then(catalog => {
      mediaCategories.value = catalog.categories
        .filter(c => c.enabled)
        .map(({ id, name }) => ({ id, name }));
      media.value = catalog.items.filter(
        item =>
          item.enabled &&
          catalog.categories.some(
            category => category.id === item.category && category.enabled
          )
      );
    })
    .catch(() =>
      message("封面素材读取失败，可稍后重进页面。", { type: "warning" })
    );
});
</script>
<template>
  <section v-loading="loading" class="blog-defaults">
    <header>
      <div>
        <span>个人博客 / 博客默认外观</span>
        <h1>给小站一个初始模样</h1>
        <p>
          访客第一次进入，或点击“恢复默认”时使用。访客自己的配色、字体和背景设置仍然优先，不会被强制覆盖。
        </p>
        <p>
          这里修改博客，右上角“后台外观”只修改你自己的管理界面。保存后可在未设置个人外观的浏览器中预览；线上需要重新发布。
        </p>
      </div>
      <div class="actions">
        <el-button :disabled="saving" @click="load">重新读取</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="loading || !!error || preferencesTooLarge"
          @click="save"
          >保存默认外观</el-button
        >
      </div>
    </header>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
    /><el-alert
      v-if="preferencesTooLarge"
      title="封面地址等设置总量超过48KiB，请缩短地址或移除部分素材后再保存。"
      type="warning"
      :closable="false"
    />
    <div class="defaults-body">
      <nav class="settings-sections" aria-label="外观设置分类">
        <button
          v-for="name in sectionOrder"
          :key="name"
          type="button"
          :aria-pressed="selectedTab === name"
          @click="selectedTab = name"
        >
          {{ name }}
        </button>
      </nav>
      <div class="settings-content">
        <h2>{{ selectedTab }}</h2>
        <BlogPalette
          v-if="selectedTab === '页面与背景'"
          scope="card"
          hide-opacity
          :preferences="draft.preferences"
          :theme="draft.theme"
          @change="
            patch =>
              (draft.preferences = normalizeAppearance({
                ...draft.preferences,
                ...patch
              }))
          "
          @theme="value => (draft.theme = value)"
        />
        <section v-if="selectedTab === '动画与特效'">
          <h3>博客特效</h3>
          <p class="control-help">
            按喜好组合轻量特效；不会挡住点击，暂停“界面动画”时会统一停止。
          </p>
          <BlogSettingField
            v-for="(label, key) in {
              clickEffect: '点击彩屑',
              mouseTrail: '鼠标星轨',
              sparkleEffect: '文字闪光'
            }"
            :key="key"
            :field="{ key, label }"
            :value="draft.effects[key]"
            @change="value => (draft.effects[key] = Boolean(value))"
          />
          <BlogSettingField
            :field="{ key: 'fallingEffect', label: '选择动态场景' }"
            :value="draft.effects.fallingEffect"
            :options="blogFallingEffects"
            @change="
              value =>
                (draft.effects.fallingEffect =
                  value as keyof typeof blogFallingEffects)
            "
          />
          <p class="control-help">
            “流萤星网”会在背景中缓慢连线，并轻柔避让鼠标；其他选项保留飘落效果。
          </p>
        </section>
        <template v-for="field in fields" :key="field.key">
          <h3 v-if="headings[field.key]" class="subsection-heading">
            {{ headings[field.key] }}
          </h3>
          <BlogSettingField
            :field="field"
            :value="draft.preferences[field.key]"
            :options="enumOptions[field.key]"
            :preview-colors="previewColors"
            @change="value => setValue(field.key, value)"
          />
          <section
            v-if="
              field.key === 'background' &&
              draft.preferences.background === 'image'
            "
            class="background-editor"
          >
            <h3>背景图片</h3>
            <button
              type="button"
              class="gallery-trigger"
              @click="openGallery('background')"
            >
              从照片墙选择背景</button
            ><img
              :src="getBlogMediaUrl(draft.background.image)"
              alt="当前背景图片预览"
              class="background-preview"
            />
            <p class="control-help">当前背景：{{ draft.background.image }}</p>
            <label
              >图片直链或本站路径<input
                v-model="backgroundUrl"
                placeholder="https://… 或 /images/…"
                @keydown.enter="useBackgroundUrl" /></label
            ><button
              type="button"
              class="gallery-trigger"
              @click="useBackgroundUrl"
            >
              添加并使用背景
            </button>
            <label class="background-range"
              >背景模糊度 <span>{{ draft.background.blur }}px</span
              ><input
                v-model.number="draft.background.blur"
                aria-label="背景模糊度"
                type="range"
                min="0"
                max="20"
            /></label>
          </section>
          <section v-if="field.key === 'heroMode'" class="cover-picker">
            <p class="control-help">
              首页、项目、文章、收藏等页面共用这套封面设置。离开首屏或切到其他浏览器标签时暂停；自定义地址需要能直接访问图片或视频文件。
            </p>
            <p v-if="draft.preferences.reduceMotion" class="control-help">
              界面动画已暂停，自动切图和动态封面也会暂停。
            </p>
            <template v-if="draft.preferences.heroMode === 'animated'"
              ><BlogSettingField
                :field="{ key: 'heroMediaKind', label: '动态素材类型' }"
                :value="draft.preferences.heroMediaKind"
                :options="enumOptions.heroMediaKind"
                @change="value => setValue('heroMediaKind', value)" />
              <p class="control-help">
                选择下面的素材即可播放。切换类型会选用对应的视频或真正的动图。
              </p>
              <div
                class="media-categories"
                role="group"
                aria-label="动态封面素材分类"
              >
                <button
                  v-for="category in availableCategories"
                  :key="category.id"
                  type="button"
                  :aria-pressed="activeCategory === category.id"
                  @click="
                    mediaCategory = category.id;
                    mediaPages.resetPage();
                  "
                >
                  {{ category.name }}
                </button>
              </div>
              <h3>选择动态封面素材</h3>
              <p v-if="selectedMedia" class="control-help">
                当前：{{ selectedMedia.name }}
                <a
                  v-if="selectedMedia.sourceUrl"
                  :href="selectedMedia.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  >素材来源</a
                ><a
                  v-if="selectedMedia.licenseUrl"
                  :href="selectedMedia.licenseUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  >授权说明</a
                >
              </p>
              <p v-if="!visibleMedia.length" class="control-help">
                暂无可选素材，可添加自定义地址。
              </p>
              <div
                class="asset-grid"
                role="group"
                aria-label="选择动态封面素材"
              >
                <button
                  v-for="item in mediaPages.pageItems.value"
                  :key="item.id"
                  type="button"
                  :aria-pressed="draft.preferences.heroMediaUrl === item.url"
                  @click="
                    setValue('heroMediaUrl', item.url);
                    setValue('heroMediaKind', item.kind);
                  "
                >
                  <img
                    :src="adminMediaPreview(item.poster)"
                    :alt="item.name"
                    loading="lazy"
                  /><span>{{ item.name }}</span
                  ><small>{{
                    draft.preferences.heroMediaUrl === item.url
                      ? "使用中"
                      : item.kind === "video"
                        ? "循环视频"
                        : "GIF / 动态图片"
                  }}</small>
                </button>
              </div>
              <el-pagination
                v-if="mediaPages.showPagination.value"
                v-model:current-page="mediaPages.pagination.currentPage"
                v-model:page-size="mediaPages.pagination.pageSize"
                :page-sizes="[20, 40, 80]"
                :total="mediaPages.pagination.total"
                layout="prev,pager,next,sizes"
                @size-change="mediaPages.handlePageSizeChange"
            /></template>
            <template v-else>
              <h3>静态封面 / 轮播图片</h3>
              <p class="control-help">
                {{
                  draft.preferences.heroMode === "fixed"
                    ? "选择一张作为全站封面。"
                    : `已选 ${draft.preferences.heroSlides.length} 张，按选择顺序轮播。`
                }}
              </p>
              <button
                type="button"
                class="gallery-trigger"
                @click="
                  openGallery(
                    draft.preferences.heroMode === 'fixed'
                      ? draft.preferences.heroSlides[0] || 'add'
                      : 'add'
                  )
                "
              >
                {{
                  draft.preferences.heroMode === "fixed"
                    ? "从照片墙替换封面"
                    : "从照片墙添加图片"
                }}
              </button>
              <div
                class="asset-grid slide-library"
                role="group"
                aria-label="封面图片"
              >
                <div
                  v-for="(url, index) in draft.preferences.heroSlides"
                  :key="url"
                  class="slide-item"
                >
                  <button
                    type="button"
                    :aria-label="`选择第 ${index + 1} 张封面`"
                    :aria-pressed="
                      draft.preferences.heroMode === 'fixed'
                        ? index === 0
                        : true
                    "
                    @click="selectSlide(url)"
                  >
                    <img
                      :src="getBlogMediaUrl(url)"
                      :alt="`封面 ${index + 1}`"
                      loading="lazy"
                    /><span>第 {{ index + 1 }} 张</span
                    ><small>{{
                      draft.preferences.heroMode === "fixed"
                        ? index === 0
                          ? "使用中"
                          : "点击使用"
                        : "轮播中"
                    }}</small>
                  </button>
                  <div class="slide-actions">
                    <button
                      type="button"
                      :aria-label="`替换第 ${index + 1} 张图片`"
                      @click="openGallery(url)"
                    >
                      替换
                    </button>
                    <button
                      v-if="draft.preferences.heroSlides.length > 1"
                      type="button"
                      :aria-label="`移除第 ${index + 1} 张图片`"
                      @click="removeSlide(url)"
                    >
                      移除
                    </button>
                  </div>
                </div>
              </div>
              <form class="cover-address-form" @submit.prevent="addSlides">
                <label for="default-slide-address">添加自己的图片</label>
                <textarea
                  id="default-slide-address"
                  v-model="slideAddress"
                  rows="2"
                  placeholder="图片 HTTPS 直链或 /images/…，每行一个"
                />
                <button type="submit" class="gallery-trigger">
                  加入图片库
                </button>
              </form>
            </template>
            <template v-if="draft.preferences.heroMode === 'animated'">
              <div
                v-if="customMedia.length"
                class="custom-media-list"
                role="group"
                aria-label="我的动态素材"
              >
                <h3>我的素材</h3>
                <div
                  v-for="item in customMedia"
                  :key="item.id"
                  class="custom-media-item"
                >
                  <button
                    type="button"
                    :aria-pressed="draft.preferences.heroMediaUrl === item.url"
                    @click="setValue('heroMediaUrl', item.url)"
                  >
                    {{ item.name
                    }}<small>{{
                      draft.preferences.heroMediaUrl === item.url
                        ? "使用中"
                        : "点击使用"
                    }}</small>
                  </button>
                  <button
                    type="button"
                    :aria-label="`删除素材 ${item.name}`"
                    @click="removeCustomMedia(item.id, item.url)"
                  >
                    删除
                  </button>
                </div>
              </div>
              <form class="cover-address-form" @submit.prevent="addCustomMedia">
                <label for="default-media-address"
                  >添加自己的{{
                    draft.preferences.heroMediaKind === "video"
                      ? "视频"
                      : "动图"
                  }}</label
                >
                <input
                  v-model="mediaName"
                  aria-label="素材名称"
                  maxlength="60"
                  placeholder="给素材起个名字（可选）"
                />
                <input
                  id="default-media-address"
                  v-model="mediaAddress"
                  :placeholder="
                    draft.preferences.heroMediaKind === 'video'
                      ? 'MP4 / WebM 的 HTTPS 直链或 /videos/…'
                      : 'GIF / 动态 WebP 的 HTTPS 直链'
                  "
                />
                <button type="submit" class="gallery-trigger">
                  加入草稿并使用
                </button>
              </form>
            </template>
            <p v-if="coverError" role="alert" class="cover-error">
              {{ coverError }}
            </p>
            <p class="control-help">
              默认每 {{ defaultAppearance.heroInterval }} 秒自动切图。<button
                type="button"
                class="gallery-trigger"
                @click="
                  draft.preferences = normalizeAppearance({
                    ...draft.preferences,
                    heroMode: 'slideshow',
                    heroInterval: defaultAppearance.heroInterval,
                    heroSlides: [...defaultAppearance.heroSlides]
                  })
                "
              >
                恢复默认轮播
              </button>
            </p>
          </section>
        </template>
        <BlogPalette
          v-if="selectedTab === '主题与字体'"
          scope="theme"
          :preferences="draft.preferences"
          :theme="draft.theme"
          @change="
            patch =>
              (draft.preferences = normalizeAppearance({
                ...draft.preferences,
                ...patch
              }))
          "
          @theme="value => (draft.theme = value)"
        />
      </div>
      <el-dialog
        v-model="galleryOpen"
        :title="
          galleryTarget === 'background'
            ? '从照片墙选择背景'
            : galleryTarget === 'add'
              ? '选择要加入的图片'
              : '替换封面图片'
        "
        width="min(880px,calc(100vw - 24px))"
        ><template v-if="galleryOpen"
          ><div class="media-categories" role="group" aria-label="选图来源">
            <button
              type="button"
              :aria-pressed="gallerySource === 'wall'"
              @click="
                gallerySource = 'wall';
                albumIndex = 0;
              "
            >
              照片墙</button
            ><button
              type="button"
              :aria-pressed="gallerySource === 'builtin'"
              @click="
                gallerySource = 'builtin';
                albumIndex = 0;
              "
            >
              原有封面
            </button>
          </div>
          <p v-if="galleryLoading" role="status">正在加载相册…</p>
          <p v-if="galleryError" role="alert">
            {{ galleryError }}
            <button
              type="button"
              @click="
                serverAlbums[albumIndex - blogPhotoAlbums.length]
                  ? loadSelectedAlbum()
                  : openGallery(galleryTarget)
              "
            >
              重试
            </button>
          </p>
          <el-select
            v-model="albumIndex"
            aria-label="图片库分类"
            @change="photoPages.resetPage"
            ><el-option
              v-for="(album, index) in galleryAlbums"
              :key="album.title"
              :label="album.title"
              :value="index"
          /></el-select>
          <div class="asset-grid" role="group" aria-label="图片库">
            <button
              v-for="photo in photoPages.pageItems.value"
              :key="photo.id"
              type="button"
              @click="chooseGalleryImage(photo.originalUrl)"
            >
              <img
                :src="photo.url"
                :alt="photo.caption"
                loading="lazy"
              /><span>{{ photo.caption }}</span>
            </button>
          </div>
          <el-pagination
            v-if="photoPages.showPagination.value"
            v-model:current-page="photoPages.pagination.currentPage"
            v-model:page-size="photoPages.pagination.pageSize"
            :page-sizes="[20, 40, 80]"
            :total="photoPages.pagination.total"
            layout="prev,pager,next,sizes"
            @size-change="photoPages.handlePageSizeChange" /></template
      ></el-dialog>
      <p class="defaults-note">
        拖动只修改草稿；点击保存才成为博客默认外观。可随时重新读取已保存值。
      </p>
    </div>
  </section>
</template>
<style scoped>
.cover-address-form {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}
.cover-address-form input,
.cover-address-form textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--blog-border);
  border-radius: 14px;
  background: var(--blog-panel);
  color: inherit;
  font: inherit;
}
.cover-address-form button {
  justify-self: start;
}
.slide-item {
  min-width: 0;
}
.slide-item > button {
  width: 100%;
}
.slide-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.slide-actions button,
.custom-media-item button {
  padding: 9px 12px;
  border: 1px solid var(--blog-border);
  border-radius: 12px;
  background: var(--blog-panel);
  color: inherit;
  cursor: pointer;
}
.custom-media-item {
  display: flex;
  gap: 10px;
  margin: 10px 0;
}
.custom-media-item button:first-child {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}
.custom-media-item small {
  display: block;
  opacity: 0.7;
}
.custom-media-item button[aria-pressed="true"] {
  border-color: var(--blog-accent);
}
.cover-error {
  color: var(--el-color-danger);
}
.blog-defaults {
  padding: 24px;
}
header,
.defaults-body {
  padding: 24px;
  border: 1px solid var(--blog-border);
  border-radius: 22px;
  background: var(--blog-panel);
  margin-bottom: 20px;
}
header {
  display: flex;
  gap: 20px;
  justify-content: space-between;
}
h1 {
  font-size: 26px;
  margin: 8px 0;
}
p {
  color: var(--blog-muted);
  line-height: 1.8;
}
header span {
  color: var(--blog-accent);
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-content: start;
  flex-shrink: 0;
}
.actions .el-button {
  margin: 0;
}
.defaults-note {
  font-size: 13px;
}
@media (max-width: 800px) {
  .blog-defaults {
    padding: 0;
  }
  header,
  .defaults-body {
    padding: 14px;
  }
  header {
    flex-direction: column;
  }
}

.subsection-heading {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid var(--blog-border);
}
.settings-sections {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.settings-sections button {
  border: 0;
  border-radius: 12px;
  background: var(--el-fill-color);
  color: var(--blog-muted);
  font: inherit;
  padding: 12px 16px;
  cursor: pointer;
}
.settings-sections button[aria-pressed="true"] {
  color: #fff;
  background: var(--blog-accent);
}
.settings-content {
  max-width: 880px;
  margin: auto;
}
.settings-content h2 {
  font-size: 20px;
  font-weight: 700;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--blog-border);
}
.settings-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}
.background-editor {
  border: 1px solid var(--blog-border);
  border-radius: 18px;
  padding: 18px;
}
.background-preview {
  display: block;
  width: 100%;
  height: 190px;
  object-fit: cover;
  border-radius: 14px;
  margin: 14px 0;
}
.gallery-trigger {
  border: 1px solid var(--blog-border);
  border-radius: 12px;
  padding: 10px 14px;
  background: var(--blog-panel);
  color: var(--blog-accent);
  cursor: pointer;
}
.background-editor label {
  display: block;
  font-size: 13px;
}
.background-editor label input:not([type="range"]) {
  display: block;
  width: 100%;
  border: 1px solid var(--blog-border);
  padding: 12px;
  border-radius: 12px;
  margin: 10px 0;
  background: var(--blog-panel);
}
.background-range {
  margin-top: 22px;
}
.background-range span {
  float: right;
  color: var(--blog-muted);
}
.background-range input {
  width: 100%;
  accent-color: var(--blog-accent);
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.asset-grid > button,
.slide-item > button {
  border: 1px solid var(--blog-border);
  border-radius: 14px;
  padding: 0 0 12px;
  background: var(--blog-panel);
  color: var(--blog-ink);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
}
.asset-grid > button[aria-pressed="true"],
.slide-item > button[aria-pressed="true"] {
  border-color: var(--blog-accent);
  background: var(--el-color-primary-light-9);
}
.asset-grid img {
  width: 100%;
  height: 110px;
  object-fit: cover;
}
.asset-grid span,
.asset-grid small {
  display: block;
  padding: 8px 12px 0;
}
.asset-grid small {
  color: var(--blog-muted);
}
.control-help {
  font-size: 13px;
  color: var(--blog-muted);
}
@media (max-width: 600px) {
  .asset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .settings-sections button {
    padding: 10px;
    font-size: 13px;
  }
}
.media-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.media-categories button {
  border: 0;
  border-radius: 10px;
  padding: 10px;
  color: var(--blog-ink);
  background: var(--el-fill-color);
  cursor: pointer;
}
.media-categories button[aria-pressed="true"] {
  background: var(--blog-accent);
  color: #fff;
}
</style>
