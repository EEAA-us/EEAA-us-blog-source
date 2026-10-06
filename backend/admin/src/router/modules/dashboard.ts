import { dashboard } from "@/router/enums";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/dashboard",
  name: "Dashboard",
  component: Layout,
  redirect: "/dashboard/index",
  meta: {
    icon: "ri:dashboard-3-line",
    title: "博客工作台",
    rank: dashboard,
    showLink: false
  },
  children: [
    {
      path: "/dashboard/index",
      name: "DashboardIndex",
      component: () => import("@/views/dashboard/index.vue"),
      meta: {
        title: "博客工作台"
      }
    }
  ]
} satisfies RouteConfigsTable;
