<script setup lang="ts">
import { computed } from "vue";
import { usePermissionStoreHook } from "@/store/modules/permission";
import ManagementIcon0 from "~icons/ri/quill-pen-line";
import ManagementIcon1 from "~icons/ri/image-line";
import ManagementIcon2 from "~icons/ri/folder-3-line";
import ManagementIcon3 from "~icons/ri/bookmark-line";
import ManagementIcon5 from "~icons/ri/settings-3-line";
import ManagementIcon6 from "~icons/ri/stack-line";
import ManagementIcon7 from "~icons/ri/price-tag-3-line";
import ManagementIcon8 from "~icons/ri/footprint-line";
const catalog = [
  {
    path: "/blog-defaults",
    name: "博客默认外观",
    note: "首次访问与恢复默认的起点",
    icon: ManagementIcon5
  },
  {
    path: "/post",
    name: "文章与草稿",
    note: "写作、整理与发布",
    icon: ManagementIcon0
  },
  {
    path: "/album",
    name: "照片墙",
    note: "精选图库与自己的照片",
    icon: ManagementIcon1
  },
  {
    path: "/project",
    name: "项目图片",
    note: "设置博客项目卡片的封面",
    icon: ManagementIcon2
  },
  {
    path: "/bookmark",
    name: "收藏夹",
    note: "管理收藏的链接",
    icon: ManagementIcon3
  },
  {
    path: "/site-config",
    name: "博客封面与素材",
    note: "访客可选的动态封面目录",
    icon: ManagementIcon5
  },
  {
    path: "/category",
    name: "文章分类",
    note: "整理内容目录",
    icon: ManagementIcon6
  },
  {
    path: "/tag",
    name: "标签管理",
    note: "为记录添加关键词",
    icon: ManagementIcon7
  },
  {
    path: "/visitor",
    name: "本机访问记录",
    note: "开发与测试诊断",
    icon: ManagementIcon8
  }
];
const items = computed(() => {
  const allowed = new Set(
    usePermissionStoreHook()
      .wholeMenus.filter(menu => menu.meta?.showLink !== false)
      .map(menu => menu.path)
  );
  return catalog.filter(item => allowed.has(item.path));
});
</script>
<template>
  <section class="management-shortcuts">
    <div class="section-heading">
      <div>
        <h2>小站的每个角落</h2>
        <p>现有管理功能都在这里，点选进入。</p>
      </div>
      <span class="tools-count">{{ items.length }} 个管理入口</span>
    </div>
    <div class="management-grid">
      <router-link v-for="item in items" :key="item.path" :to="item.path"
        ><component :is="item.icon" width="22" height="22" /><span
          ><strong>{{ item.name }}</strong
          ><small>{{ item.note }}</small></span
        ><span aria-hidden="true" class="management-arrow">↗</span></router-link
      >
    </div>
  </section>
</template>
