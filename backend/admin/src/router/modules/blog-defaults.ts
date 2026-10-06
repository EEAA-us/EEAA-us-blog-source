const Layout = () => import("@/layout/index.vue");
export default {
  path: "/blog-defaults",
  name: "BlogDefaults",
  component: Layout,
  redirect: "/blog-defaults/index",
  meta: { title: "博客默认外观", icon: "ri:paint-brush-line", rank: 10 },
  children: [
    {
      path: "/blog-defaults/index",
      name: "BlogDefaultsIndex",
      component: () =>
        import("@/views/site-config/components/BlogDefaults.vue"),
      meta: { title: "博客默认外观" }
    }
  ]
} satisfies RouteConfigsTable;
