<script setup lang="ts">
import { computed } from "vue";
import {
  coverContourPaths,
  coverContourLayers
} from "../../../../../../lib/cover-contours";
import "../../../../../../lib/cover-contour-preview.css";
import iconNodes from "./blog-setting-icons.json";
import "@/assets/blog-font-samples/samples.css";
import { fontStyles } from "../../../../../../lib/appearance";
const props = defineProps<{
  field: { key: string; label: string; range?: [number, number, number?] };
  value: unknown;
  previewColors?: {
    primary: string;
    tertiary: string;
    surface: string;
    card: string;
  };
  options?: Record<string, string>;
}>();
const emit = defineEmits<{ change: [value: unknown] }>();
// Use the same Lucide geometry as the public blog.
const icons = iconNodes as unknown as Record<
  string,
  [string, Record<string, string>][]
>;
const grid = computed(() =>
  ["texture", "readingLayout", "fontStyle", "coverEffect"].includes(
    props.field.key
  )
);
const descriptions: Record<string, string> = {
  background: "这里设置正文区域后面的背景，不改变顶部封面。",
  readingLayout: "文章与项目正文共用；小屏幕自动适配。",
  articleHoverFrame:
    "提示线与虚线框可分别开关，帮助定位当前阅读块；文章与项目正文共用。",
  navigationScroll:
    "首页回到顶部封面，项目、文章、归档等导航直接定位到内容区。平滑滚动会自动带你滑到内容；暂停界面动画时使用直接跳转。",
  language: "切换网站界面，文章正文和内容名称保留原文。",
  subtitleEffect: "淡入和上浮每 5 秒换一句；暂停界面动画时显示静态文字。",
  welcomeEnabled:
    "开启后每次浏览器会话显示一次；关闭后直接进入页面，也可在欢迎画面右上角跳过。",
  waveLayerStyle:
    "前景是最下方靠近正文的一层，后景是上方叠在一起的几层。两项都为0%时隐藏波浪。",
  opacity: "100%时卡片完全不透明；调低后才会透出下方背景。",
  fontStyle:
    "标题和正文一起切换；左上标志和代码字体保持原样。首次切换请稍候字体加载。",
  live2dCharacter: "轻触角色切换表情，暂停界面动画时保持静止。手机端隐藏。"
};
const readingDescriptions: Record<string, string> = {
  default: "默认采用较宽的正文区域，保留两侧栏。",
  narrow: "收窄页面宽度，保留正文与两侧栏。",
  custom: "分别调整页面和正文的最大宽度。",
  focus: "隐藏两侧工具栏，正文居中；项目目录仍可展开。"
};
</script>
<template>
  <div class="setting-control">
    <template v-if="options">
      <p class="control-label">{{ field.label }}</p>
      <div
        :class="[
          'control-options',
          {
            'control-grid': grid,
            'control-textures': field.key === 'texture',
            'control-fonts': field.key === 'fontStyle',
            'control-contours': field.key === 'coverEffect'
          }
        ]"
        role="group"
        :aria-label="field.label"
      >
        <button
          v-for="(label, key) in options"
          :key="key"
          type="button"
          :aria-pressed="String(value) === key"
          @click="emit('change', key)"
        >
          <svg
            v-if="
              icons[key] && ['texture', 'readingLayout'].includes(field.key)
            "
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <component
              :is="node[0]"
              v-for="node in icons[key]"
              :key="node[1].key"
              v-bind="node[1]"
            />
          </svg>
          <div
            v-if="field.key === 'coverEffect'"
            class="contour-sample"
            :style="
              previewColors
                ? {
                    '--ui-primary': previewColors.primary,
                    '--ui-tertiary': previewColors.tertiary,
                    '--ui-surface': previewColors.surface,
                    '--ui-card': previewColors.card
                  }
                : undefined
            "
          >
            <div
              class="cover-contour-preview"
              :data-effect="key"
              aria-hidden="true"
            >
              <div class="cover-wave-layers">
                <svg
                  v-for="layer in coverContourLayers()"
                  :key="layer"
                  :class="`page-cover-wave page-cover-wave-${layer}`"
                  viewBox="0 0 2880 100"
                  preserveAspectRatio="none"
                  focusable="false"
                >
                  <path
                    v-for="offset in [0, 1440]"
                    :key="offset"
                    :transform="`translate(${offset} 0)`"
                    :d="`${coverContourPaths[key as keyof typeof coverContourPaths]} V100 H0 Z`"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>
          </div>
          <span>{{ label }}</span>
          <template v-if="field.key === 'fontStyle'"
            ><strong :class="`font-sample-${key}`"
              >山间有风，<br />生活有光。</strong
            ><small>{{
              fontStyles[key as keyof typeof fontStyles].name
            }}</small></template
          >
          <span
            v-if="grid && String(value) === key"
            class="control-check"
            aria-hidden="true"
            >✓</span
          >
        </button>
      </div>
      <p v-if="field.key === 'readingLayout'" class="control-help">
        {{ readingDescriptions[String(value)] }}
      </p>
    </template>
    <label v-else-if="field.range" class="control-range"
      >{{ field.label
      }}<span
        >{{ value
        }}{{
          [
            "readingPageWidth",
            "readingContentWidth",
            "focusContentWidth"
          ].includes(field.key)
            ? "px"
            : field.key === "heroInterval"
              ? "秒"
              : field.key === "waveLayers"
                ? "层"
                : "%"
        }}</span
      ><input
        type="range"
        :aria-label="field.label"
        :min="field.range[0]"
        :max="field.range[1]"
        :step="field.range[2] || 1"
        :value="Number(value)"
        :style="{
          background: `linear-gradient(to right, var(--blog-accent) ${((Number(value) - field.range[0]) / (field.range[1] - field.range[0])) * 100}%, var(--el-border-color) ${((Number(value) - field.range[0]) / (field.range[1] - field.range[0])) * 100}%)`
        }"
        @input="
          emit('change', Number(($event.target as HTMLInputElement).value))
        "
    /></label>
    <button
      v-else-if="typeof value === 'boolean'"
      class="control-switch"
      type="button"
      role="switch"
      :aria-label="field.label"
      :aria-checked="field.key === 'reduceMotion' ? !value : value"
      @click="emit('change', !value)"
    >
      <span>{{ field.label }}</span
      ><strong>{{
        (field.key === "reduceMotion" ? !value : value) ? "开启" : "关闭"
      }}</strong>
    </button>
    <p v-if="descriptions[field.key]" class="control-help">
      {{ descriptions[field.key] }}
    </p>
  </div>
</template>
<style scoped>
.setting-control {
  margin: 20px 0;
  color: var(--blog-ink);
}
.control-label {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
}
.control-options {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--el-fill-color);
}
button {
  border: 0;
  font: inherit;
  cursor: pointer;
  color: inherit;
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--blog-accent);
  outline-offset: 3px;
}
.control-options button {
  flex: 1;
  min-width: 0;
  position: relative;
  border-radius: 10px;
  padding: 11px 8px;
  background: transparent;
}
.control-options button[aria-pressed="true"] {
  background: var(--blog-accent);
  color: #fff;
}
.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0;
  gap: 8px;
  background: transparent;
}
.control-grid button {
  display: flex;
  gap: 7px;
  justify-content: center;
  align-items: center;
  background: var(--el-fill-color);
  border: 1px solid transparent;
  border-radius: 12px;
}
.control-grid button[aria-pressed="true"] {
  color: var(--blog-accent);
  background: var(--el-color-primary-light-9);
  border-color: var(--blog-accent);
}
.control-textures {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.control-textures button {
  flex-direction: column;
  padding: 18px 8px;
}
.control-check {
  position: absolute;
  right: 8px;
  top: 6px;
}
.control-help {
  font-size: 13px;
  color: var(--blog-muted);
  line-height: 1.8;
  margin: 12px 0;
}
.control-switch {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: var(--el-fill-color);
  text-align: left;
}
.control-switch strong {
  color: var(--blog-accent);
}
.control-range {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 14px;
  font-size: 14px;
}
.control-range span {
  color: var(--blog-muted);
}
.control-range input {
  appearance: none;
  width: 100%;
  height: 10px;
  border-radius: 20px;
  background: var(--el-border-color);
  accent-color: var(--blog-accent);
  cursor: pointer;
}
.control-range input::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--blog-accent);
  border: 2px solid var(--blog-panel);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--blog-accent);
}
.control-fonts button {
  flex-direction: column;
  align-items: start;
  text-align: left;
  padding: 20px;
}
.control-fonts strong {
  font-size: 24px;
  font-weight: 500;
  line-height: 1.5;
}
.control-fonts small {
  opacity: 0.7;
}
.font-sample-modern {
  font-family: "Noto Sans SC", sans-serif;
}
.font-sample-book {
  font-family: "Noto Serif SC", "SimSun", serif;
}
.font-sample-handwritten {
  font-family: "LXGW WenKai TC", "KaiTi", serif;
}
.font-sample-rounded {
  font-family: "ZCOOL KuaiLe", "Microsoft YaHei", sans-serif;
}
.control-contours button {
  flex-direction: column;
  overflow: hidden;
  padding: 0 0 14px;
}
.contour-sample {
  height: 84px;
  width: 100%;
  position: relative;
  background: linear-gradient(
    155deg,
    color-mix(
      in srgb,
      var(--ui-primary, var(--blog-accent)) 28%,
      var(--ui-surface, var(--blog-panel))
    ),
    color-mix(
      in srgb,
      var(--ui-tertiary, var(--blog-accent)) 15%,
      var(--ui-surface, var(--blog-panel))
    )
  );
  overflow: hidden;
}

@media (max-width: 600px) {
  .control-options {
    flex-wrap: wrap;
  }
  .control-options button {
    flex-basis: 80px;
  }
  .control-fonts button {
    padding: 14px;
  }
  .control-fonts strong {
    font-size: 20px;
  }
}
</style>
