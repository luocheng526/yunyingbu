export const SHEN_SUBMENUS = [
  { slug: "selection", href: "/shen/selection", label: "选品中心" },
  { slug: "growth", href: "/shen/growth", label: "商品成长" },
  { slug: "paid", href: "/shen/paid", label: "实时付费" },
  { slug: "training", href: "/shen/training", label: "培训系统" },
  { slug: "tasks", href: "/shen/tasks", label: "任务管理" }
];

/** Old pinyin paths → official sider paths */
export const SHEN_LEGACY_REDIRECTS = [
  { from: "/shen/xuanpin", to: "/shen/selection" },
  { from: "/shen/chengzhang", to: "/shen/growth" },
  { from: "/shen/fufei", to: "/shen/paid" },
  { from: "/shen/peixun", to: "/shen/training" },
  { from: "/shen/renwu", to: "/shen/tasks" }
];
