<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { hexToHsl, hslToHex } from "../../../../../../lib/color-picker";
const props = defineProps<{ label: string; value: string }>();
const emit = defineEmits<{ change: [hex: string] }>();
const color = ref({ hex: props.value, ...hexToHsl(props.value) });
const code = ref(props.value);
let emitted = props.value;
let frame: number | null = null;
watch(
  () => props.value,
  value => {
    code.value = value;
    if (value !== emitted) {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      emitted = value;
      color.value = { hex: value, ...hexToHsl(value) };
    }
  }
);
function update(
  patch: Partial<ReturnType<typeof hexToHsl>>,
  immediate = false
) {
  const next = { ...color.value, ...patch };
  const hex = hslToHex(next);
  color.value = { ...next, hex };
  code.value = emitted = hex;
  if (frame !== null) cancelAnimationFrame(frame);
  if (immediate) {
    frame = null;
    emit("change", hex);
  } else
    frame = requestAnimationFrame(() => {
      frame = null;
      emit("change", hex);
    });
}
function hue(event: Event) {
  update({
    h: Number((event.target as HTMLInputElement).value),
    s: color.value.s || 70,
    l: color.value.l === 0 || color.value.l === 100 ? 50 : color.value.l
  });
}
function applyCode() {
  if (/^#[0-9a-f]{6}$/i.test(code.value)) update(hexToHsl(code.value), true);
}
onBeforeUnmount(() => {
  if (frame !== null) cancelAnimationFrame(frame);
});
</script>
<template>
  <div class="blog-color-editor">
    <div class="blog-color-heading">
      <i :style="{ background: color.hex }" />
      <div>
        <strong>{{ label }}</strong
        ><small>拖动下方滑块选色，即时预览</small>
      </div>
      <span>{{ color.hex.toUpperCase() }}</span>
    </div>
    <label class="blog-range"
      >色相<span>{{ Math.round(color.h) }}°</span
      ><input
        :aria-label="`${label} 色相`"
        class="blog-hue"
        type="range"
        min="0"
        max="360"
        :value="color.h"
        @input="hue"
    /></label>
    <label class="blog-range"
      >鲜艳程度<span>{{ Math.round(color.s) }}%</span
      ><input
        :aria-label="`${label} 鲜艳程度`"
        type="range"
        min="0"
        max="100"
        :value="color.s"
        :style="{
          background: `linear-gradient(to right, #888, hsl(${color.h} 100% 50%))`
        }"
        @input="
          update({ s: Number(($event.target as HTMLInputElement).value) })
        "
    /></label>
    <label class="blog-range"
      >颜色亮度<span>{{ Math.round(color.l) }}%</span
      ><input
        :aria-label="`${label} 颜色亮度`"
        class="blog-brightness"
        type="range"
        min="0"
        max="100"
        :value="color.l"
        @input="
          update({ l: Number(($event.target as HTMLInputElement).value) })
        "
    /></label>
    <div
      class="blog-color-shortcuts"
      role="group"
      :aria-label="`${label} 快速选择黑白`"
    >
      <button type="button" @click="update({ l: 0 }, true)">
        <i style="background: #000" />选黑色</button
      ><button type="button" @click="update({ l: 100 }, true)">
        <i style="background: #fff" />选白色
      </button>
    </div>
    <details>
      <summary>精确颜色代码（可选）</summary>
      <form class="blog-hex-form" @submit.prevent="applyCode">
        <label
          >颜色代码<input
            v-model="code"
            :aria-label="`${label} 颜色代码`"
            pattern="#[0-9a-fA-F]{6}"
            maxlength="7"
            required
            spellcheck="false" /></label
        ><button type="submit">应用颜色</button>
      </form>
    </details>
  </div>
</template>
