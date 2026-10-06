<script setup lang="ts">
import { getConfig } from "@/config";
const title = getConfig("Title");
</script>
<template>
  <footer class="layout-footer">
    {{ title }} · 博客管理工作台 <span>内容在本机管理，发布后更新线上网站</span>
  </footer>
</template>
<style scoped>
.layout-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  justify-content: center;
  padding: 24px 16px;
  font-size: 12px;
  color: var(--blog-muted);
}
</style>
