import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("../views/LoginView.vue"), meta: { guest: true } },
    { path: "/register", component: () => import("../views/RegisterView.vue"), meta: { guest: true } },
    {
      path: "/",
      component: () => import("../views/DashboardView.vue"),
      meta: { requiresAuth: true },
      children: [
        { path: "", redirect: "/links" },
        { path: "links", component: () => import("../views/LinksView.vue") },
        { path: "batch", component: () => import("../views/BatchView.vue") },
        { path: "stats", component: () => import("../views/StatsView.vue") },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn()) return "/login";
  if (to.meta.guest && auth.isLoggedIn()) return "/links";
});

export default router;
