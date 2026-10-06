<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import {
  colorStyles,
  defaultAppearance,
  resolveAppearance,
  type AppearancePreferences
} from "../../../../../../lib/appearance";
import {
  homeCardHue,
  resolveHomeCardAppearance
} from "../../../../../../lib/home-card-colors";
import BlogColorPicker from "./BlogColorPicker.vue";
const props = defineProps<{
  preferences: AppearancePreferences;
  scope?: "theme" | "card";
  hideOpacity?: boolean;
  theme: "light" | "dark" | "system";
}>();
const emit = defineEmits<{
  change: [patch: Partial<AppearancePreferences>];
  theme: [value: "light" | "dark" | "system"];
}>();
const systemDark = ref(
  window.matchMedia("(prefers-color-scheme: dark)").matches
);
const query = window.matchMedia("(prefers-color-scheme: dark)");
function updateDark() {
  systemDark.value = query.matches;
}
onMounted(() => query.addEventListener("change", updateDark));
onBeforeUnmount(() => query.removeEventListener("change", updateDark));
const dark = computed(
  () => props.theme === "dark" || (props.theme === "system" && systemDark.value)
);
const themeScheme = computed(() =>
  resolveAppearance(props.preferences, dark.value)
);
const themeRoles = computed(() => themeScheme.value.roles);
const cardRoles = computed(
  () => resolveHomeCardAppearance(props.preferences, dark.value).roles
);
const cardMode = computed(() =>
  props.preferences.homeCardColor === "theme"
    ? "theme"
    : ["solid", "white", "black"].includes(props.preferences.homeCardColor)
      ? "solid"
      : "custom"
);
const cardHex = computed(() =>
  props.preferences.homeCardColor === "white"
    ? "#ffffff"
    : props.preferences.homeCardColor === "black"
      ? "#000000"
      : props.preferences.homeCardHex
);
const cardHue = computed(() => homeCardHue(props.preferences));
const themeSamples = computed(() =>
  props.preferences.themeColorMode === "free"
    ? {}
    : Object.fromEntries(
        Object.keys(colorStyles).map(style => [
          style,
          resolveAppearance(
            {
              ...defaultAppearance,
              hue: props.preferences.hue,
              colorSpec: props.preferences.colorSpec,
              colorStyle: style as AppearancePreferences["colorStyle"]
            },
            dark.value
          ).roles
        ])
      )
);
const cardSamples = computed(() =>
  cardMode.value !== "custom"
    ? {}
    : Object.fromEntries(
        Object.keys(colorStyles).map(style => [
          style,
          resolveHomeCardAppearance(
            {
              ...defaultAppearance,
              homeCardColor: "custom",
              homeCardHue: cardHue.value,
              homeCardTone: props.preferences.homeCardTone,
              colorSpec: props.preferences.colorSpec,
              homeCardStyle: style as AppearancePreferences["homeCardStyle"]
            },
            dark.value
          ).roles
        ])
      )
);
function changeCardMode(mode: "theme" | "custom" | "solid") {
  emit("change", {
    homeCardColor: mode,
    ...(mode === "custom"
      ? { homeCardHue: cardHue.value }
      : mode === "solid"
        ? { homeCardHex: cardHex.value }
        : {})
  });
}
</script>
<template>
  <div class="blog-palette">
    <section v-if="scope !== 'card'">
      <h3>主题配色<i :style="{ background: themeRoles.primary }" /></h3>
      <p class="blog-label">主题选色方式</p>
      <div class="blog-options" role="group" aria-label="主题选色方式">
        <button
          type="button"
          :aria-pressed="preferences.themeColorMode === 'palette'"
          @click="emit('change', { themeColorMode: 'palette' })"
        >
          色相调色板</button
        ><button
          type="button"
          :aria-pressed="preferences.themeColorMode === 'free'"
          @click="emit('change', { themeColorMode: 'free' })"
        >
          自由选色
        </button>
      </div>
      <template v-if="preferences.themeColorMode === 'palette'">
        <label class="blog-range"
          >主题色相<span>{{ Math.round(preferences.hue) }}°</span
          ><input
            class="blog-hue"
            aria-label="主题色相"
            type="range"
            min="0"
            max="360"
            :value="preferences.hue"
            @input="
              emit('change', {
                hue: Number(($event.target as HTMLInputElement).value)
              })
            "
        /></label>
        <p>
          色相决定主色，颜色风格决定鲜艳程度与配色关系。先选主色，再看下面的实时预览。
        </p>
      </template>
      <template v-else
        ><BlogColorPicker
          label="主题基准色"
          :value="preferences.themeHex"
          @change="themeHex => emit('change', { themeHex })"
        />
        <p>
          以所选颜色生成全站搭配，按钮和背景会按明暗自动适配；卡片需要精确底色时，使用首页卡片自由选色。
        </p></template
      >
      <p class="blog-label">颜色风格</p>
      <div class="blog-style-grid" role="group" aria-label="颜色风格">
        <button
          v-for="(style, key) in colorStyles"
          :key="key"
          type="button"
          :aria-pressed="preferences.colorStyle === key"
          @click="emit('change', { colorStyle: key })"
        >
          <span
            v-if="themeSamples[key]"
            class="blog-swatches"
            aria-hidden="true"
            ><i
              v-for="(color, index) in [
                themeSamples[key].primary,
                themeSamples[key].secondary,
                themeSamples[key].tertiary
              ]"
              :key="index"
              :style="{ background: color }" /></span
          >{{ style.label
          }}<span v-if="preferences.colorStyle === key" class="blog-check"
            >✓</span
          >
        </button>
      </div>
      <button
        type="button"
        class="blog-switch"
        role="switch"
        aria-label="主题色扩散"
        :aria-checked="preferences.themeColorSpread"
        @click="
          emit('change', { themeColorSpread: !preferences.themeColorSpread })
        "
      >
        <span>主题色扩散</span
        ><strong>{{ preferences.themeColorSpread ? "开启" : "关闭" }}</strong>
      </button>
      <p>
        开启后，主题色会轻轻染入卡片、面板与页面底色；关闭则保留原来的配色。壁纸和图片不变色。
      </p>
      <p>主题色扩散只影响跟随主题的区域；首页独立配色始终优先。</p>
      <p class="blog-label">配色规范</p>
      <div class="blog-options" role="group" aria-label="配色规范">
        <button
          type="button"
          :aria-pressed="preferences.colorSpec === '2021'"
          @click="emit('change', { colorSpec: '2021' })"
        >
          MD3 · 2021</button
        ><button
          type="button"
          :aria-pressed="preferences.colorSpec === '2025'"
          @click="emit('change', { colorSpec: '2025' })"
        >
          Expressive · 2025
        </button>
      </div>
      <div
        class="blog-preview blog-theme-preview"
        aria-label="实时配色预览"
        :style="{
          background: themeRoles.card,
          color: themeRoles.onSurface,
          borderColor: themeRoles.outline
        }"
      >
        <div>
          <strong>阅读与记录</strong>
          <p :style="{ color: themeRoles.muted }">文字、卡片和按钮一起配色</p>
        </div>
        <span
          :style="{
            background: themeRoles.primary,
            color: themeRoles.onPrimary
          }"
          >主色</span
        >
      </div>
      <p
        v-if="themeScheme.effectiveSpec !== preferences.colorSpec"
        class="blog-help"
      >
        此风格由颜色引擎沿用2021算法；柔和、鲜艳、表现力和中性支持2025算法。
      </p>
      <p class="blog-label">默认明暗模式</p>
      <div class="blog-options" role="group" aria-label="默认明暗模式">
        <button
          v-for="(label, value) in {
            light: '浅色',
            dark: '深色',
            system: '跟随设备'
          }"
          :key="value"
          type="button"
          :aria-pressed="theme === value"
          @click="emit('theme', value)"
        >
          {{ label }}
        </button>
      </div>
    </section>
    <section v-if="scope !== 'theme'">
      <h3>首页卡片配色</h3>
      <p>只改变首页卡片，不改变全站主题</p>
      <div class="blog-options" role="group" aria-label="卡片配色方式">
        <button
          v-for="(label, value) in {
            theme: '跟随主题',
            custom: '独立调色板',
            solid: '自由选色'
          }"
          :key="value"
          type="button"
          :aria-pressed="cardMode === value"
          @click="changeCardMode(value)"
        >
          {{ label }}
        </button>
      </div>
      <template v-if="cardMode !== 'theme'">
        <template v-if="cardMode === 'custom'">
          <label class="blog-range"
            >卡片色相<span>{{ Math.round(cardHue) }}°</span
            ><input
              class="blog-hue"
              aria-label="卡片色相"
              type="range"
              min="0"
              max="360"
              :value="cardHue"
              @input="
                emit('change', {
                  homeCardHue: Number(
                    ($event.target as HTMLInputElement).value
                  ),
                  homeCardColor: 'custom'
                })
              "
          /></label>
          <p class="blog-label">卡片明暗</p>
          <div class="blog-options" role="group" aria-label="卡片明暗">
            <button
              v-for="(label, value) in {
                theme: '跟随主题',
                light: '浅色',
                dark: '深色'
              }"
              :key="value"
              type="button"
              :aria-pressed="preferences.homeCardTone === value"
              @click="emit('change', { homeCardTone: value })"
            >
              {{ label }}
            </button>
          </div>
        </template>
        <template v-else
          ><p>
            自由选择准确的卡片底色，包括黑色、白色。文字自动匹配；100%不透明度时底色与色值一致。
          </p>
          <BlogColorPicker
            label="卡片底色"
            :value="cardHex"
            @change="
              homeCardHex =>
                emit('change', { homeCardColor: 'solid', homeCardHex })
            "
        /></template>
        <p class="blog-label">卡片颜色风格</p>
        <div class="blog-style-grid" role="group" aria-label="卡片颜色风格">
          <button
            v-for="(style, key) in colorStyles"
            :key="key"
            type="button"
            :aria-pressed="preferences.homeCardStyle === key"
            @click="emit('change', { homeCardStyle: key })"
          >
            <span
              v-if="cardSamples[key]"
              class="blog-swatches"
              aria-hidden="true"
              ><i
                v-for="(color, index) in [
                  cardSamples[key].primary,
                  cardSamples[key].secondary,
                  cardSamples[key].tertiary
                ]"
                :key="index"
                :style="{ background: color }" /></span
            >{{ style.label
            }}<span v-if="preferences.homeCardStyle === key" class="blog-check"
              >✓</span
            >
          </button>
        </div>
        <p v-if="cardMode === 'solid'">
          风格只调整按钮与链接的搭配，保留你选定的卡片底色。
        </p>
        <div
          class="blog-preview"
          aria-label="首页卡片配色预览"
          :style="{
            background: cardRoles.card,
            color: cardRoles.onSurface,
            borderColor: cardRoles.outline
          }"
        >
          <strong>配色预览</strong>
          <p :style="{ color: cardRoles.muted }">这是卡片文字的显示效果。</p>
          <div class="blog-color-sample">
            <i :style="{ background: cardRoles.primary }" /><span
              >按钮与链接颜色</span
            >
          </div>
        </div>
      </template>
      <p>
        {{
          cardMode === "theme"
            ? "跟随全站主题，也跟随主题色扩散。"
            : "独立配色优先，主题色扩散不会覆盖这里的颜色。"
        }}
      </p>
      <label v-if="!hideOpacity" class="blog-range"
        >卡片不透明度<span>{{ preferences.opacity }}%</span
        ><input
          aria-label="卡片不透明度"
          type="range"
          min="88"
          max="100"
          :value="preferences.opacity"
          @input="
            emit('change', {
              opacity: Number(($event.target as HTMLInputElement).value)
            })
          "
      /></label>
      <p v-if="!hideOpacity">100%时卡片完全不透明；调低后才会透出下方背景。</p>
    </section>
  </div>
</template>
<style>
.blog-palette {
  max-width: 960px;
  margin: auto;
  font-size: 14px;
  color: var(--blog-ink);
}
.blog-palette section {
  padding: 24px;
  border: 1px solid var(--blog-border);
  border-radius: 22px;
  background: var(--blog-panel);
  margin-bottom: 20px;
}
.blog-palette button {
  border: 0;
  font: inherit;
  color: inherit;
}
.blog-palette button:focus-visible {
  outline: 2px solid var(--blog-accent);
  outline-offset: 3px;
}
.blog-palette h3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 14px;
}
.blog-palette h3 i,
.blog-color-sample i {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
}
.blog-palette p {
  font-size: 13px;
  color: var(--blog-muted);
  line-height: 1.8;
  margin: 12px 0;
}
.blog-palette .blog-label {
  font-weight: 700;
  color: var(--blog-ink);
  margin-top: 22px;
}
.blog-options {
  display: flex;
  gap: 5px;
  padding: 5px;
  background: var(--el-fill-color);
  border-radius: 14px;
  flex-wrap: wrap;
}
.blog-options button {
  flex: 1;
  padding: 12px 8px;
  white-space: nowrap;
  border-radius: 10px;
  cursor: pointer;
}
.blog-options button[aria-pressed="true"] {
  background: var(--blog-accent);
  color: #fff;
  font-weight: 600;
}
.blog-style-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.blog-style-grid button {
  position: relative;
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 16px 8px;
  background: var(--el-fill-color);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}
.blog-style-grid button[aria-pressed="true"] {
  border-color: var(--blog-accent);
  background: var(--el-color-primary-light-9);
}
.blog-swatches {
  display: flex;
  gap: 4px;
}
.blog-swatches i {
  display: block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.blog-check {
  position: absolute;
  right: 10px;
  top: 6px;
  color: var(--blog-accent);
}
.blog-range {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 14px;
  font-weight: 600;
  margin: 22px 0;
}
.blog-range span {
  color: var(--blog-muted);
}
.blog-palette input[type="range"] {
  appearance: none;
  width: 100%;
  height: 12px;
  border-radius: 20px;
  cursor: pointer;
  background: var(--el-border-color);
  margin: 0;
}
.blog-palette input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 3px solid var(--blog-panel);
  border-radius: 50%;
  background: var(--blog-accent);
  box-shadow: 0 0 0 1px var(--blog-accent);
}
.blog-palette input[type="range"].blog-hue {
  background: linear-gradient(
    90deg,
    #ef8888,
    #e4c371,
    #92cf86,
    #6acabd,
    #81a8e8,
    #bc91df,
    #ee87a8
  );
}
.blog-palette input[type="range"].blog-brightness {
  background: linear-gradient(90deg, #000, #fff);
}
.blog-switch {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  background: var(--el-fill-color);
  margin-top: 22px;
  cursor: pointer;
}
.blog-switch strong {
  color: var(--blog-accent);
}
.blog-preview {
  padding: 20px;
  border: 1px solid;
  border-radius: 18px;
  margin-top: 20px;
}
.blog-theme-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.blog-theme-preview > span {
  border-radius: 14px;
  padding: 14px;
  font-weight: 600;
}
.blog-color-sample {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.blog-color-editor {
  padding: 20px;
  border: 1px solid var(--blog-border);
  border-radius: 20px;
  margin-top: 16px;
  background: var(--el-fill-color-lighter);
}
.blog-color-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.blog-color-heading > i {
  height: 44px;
  width: 44px;
  border-radius: 14px;
  border: 1px solid var(--blog-border);
  flex-shrink: 0;
}
.blog-color-heading > div {
  flex: 1;
  min-width: 0;
}
.blog-color-heading strong {
  font-size: 17px;
}
.blog-color-heading small {
  display: block;
  font-size: 12px;
  color: var(--blog-muted);
  margin-top: 4px;
}
.blog-color-heading > span {
  font-size: 11px;
  color: var(--blog-muted);
}
.blog-color-shortcuts {
  display: flex;
  gap: 12px;
}
.blog-color-shortcuts button {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--blog-border);
  border-radius: 14px;
  background: var(--blog-panel);
  cursor: pointer;
  white-space: nowrap;
}
.blog-color-shortcuts i {
  width: 24px;
  height: 24px;
  border: 1px solid #aaa;
  border-radius: 50%;
  flex-shrink: 0;
}
.blog-color-editor details {
  margin-top: 18px;
  color: var(--blog-muted);
  font-size: 12px;
}
.blog-color-editor summary {
  cursor: pointer;
}
.blog-hex-form {
  display: flex;
  gap: 8px;
  align-items: end;
  margin-top: 12px;
  flex-wrap: wrap;
}
.blog-hex-form input {
  display: block;
  background: var(--blog-panel);
  border: 1px solid var(--blog-border);
  padding: 8px;
  border-radius: 8px;
  max-width: 150px;
}
.blog-hex-form button {
  padding: 8px;
  border-radius: 8px;
  background: var(--blog-accent);
  color: #fff;
  cursor: pointer;
}
@media (max-width: 600px) {
  .blog-palette section {
    padding: 14px;
  }
  .blog-color-editor {
    padding: 14px;
  }
  .blog-color-heading {
    flex-wrap: wrap;
  }
  .blog-color-heading > span {
    margin-left: auto;
  }
  .blog-swatches i {
    width: 21px;
    height: 21px;
  }
}
</style>
