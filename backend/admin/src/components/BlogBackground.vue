<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { adminAppearance } from "@/lib/admin-appearance";
import {
  adminDynamicMediaUrl,
  adminMediaPreview
} from "@/lib/admin-hero-media";
import defaultPoster from "@/assets/blog-background.webp";
const ready = ref(false);
let loadTimer: ReturnType<typeof setTimeout>;
const video = ref<HTMLVideoElement>();
const visible = ref(!document.hidden);
const reduced = ref(false);
const failed = ref(false);
const poster = computed(
  () =>
    adminMediaPreview(
      adminAppearance.mediaKind === "gif"
        ? adminAppearance.gifPoster
        : adminAppearance.videoPoster
    ) || defaultPoster
);
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const playing = computed(
  () =>
    adminAppearance.mode === "video" &&
    ready.value &&
    visible.value &&
    !reduced.value &&
    adminAppearance.veil < 100 &&
    (adminAppearance.mediaKind === "video" || !!adminAppearance.gifUrl) &&
    !failed.value
);
function sync() {
  if (!video.value) return;
  if (playing.value)
    video.value.play().catch(() => {
      /* Poster remains visible when autoplay is blocked. */
    });
  else video.value.pause();
}
function updateVisibility() {
  visible.value = !document.hidden;
}
function updateMotion() {
  reduced.value = motionPreference.matches;
}
watch(playing, sync, { flush: "post" });
watch(
  () => [
    adminAppearance.mediaKind,
    adminAppearance.videoUrl,
    adminAppearance.gifUrl
  ],
  () => {
    failed.value = false;
  },
  { flush: "post" }
);
onMounted(() => {
  loadTimer = setTimeout(() => {
    ready.value = true;
  }, 500);
  updateMotion();
  document.addEventListener("visibilitychange", updateVisibility);
  motionPreference.addEventListener("change", updateMotion);
  sync();
});
onBeforeUnmount(() => {
  clearTimeout(loadTimer);
  video.value?.pause();
  document.removeEventListener("visibilitychange", updateVisibility);
  motionPreference.removeEventListener("change", updateMotion);
});
</script>
<template>
  <div
    v-if="adminAppearance.mode === 'video'"
    class="admin-motion-background"
    aria-hidden="true"
  >
    <video
      v-if="adminAppearance.mediaKind === 'video'"
      ref="video"
      :src="ready ? adminDynamicMediaUrl(adminAppearance.videoUrl) : undefined"
      :poster="poster"
      muted
      loop
      playsinline
      :preload="playing ? 'auto' : 'metadata'"
      @canplay="sync"
      @error="failed = true"
    />
    <img
      v-else
      :src="playing ? adminDynamicMediaUrl(adminAppearance.gifUrl) : poster"
      alt=""
      @error="failed = true"
    />
    <div class="admin-motion-veil" />
  </div>
</template>
<style scoped>
.admin-motion-background {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--blog-bg);
}
video,
img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.admin-motion-veil {
  position: absolute;
  inset: 0;
  background: rgba(247, 246, 252, var(--admin-veil));
}
:global(html.dark) .admin-motion-veil {
  background: rgba(24, 27, 39, var(--admin-veil));
}
</style>
