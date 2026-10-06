import { siteConfig } from "@/router/enums";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/site-config",
  name: "SiteConfig",
  component: Layout,
  redirect: "/site-config/index",
  meta: {
    icon: "ri:settings-3-line",
    title: "博客封面与素材",
    rank: siteConfig
  },
  children: [
    {
      path: "/site-config/index",
      name: "SiteConfigIndex",
      component: () => import("@/views/site-config/index.vue"),
      meta: {
        title: "博客封面与素材"
      }
    }
  ]
} satisfies RouteConfigsTable;
