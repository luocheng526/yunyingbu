export const SHEN_SUBMENUS = [
  { slug: "product", href: "/shen/product", label: "产品中心" },
  { slug: "paid", href: "/shen/paid", label: "付费中心" },
  { slug: "training", href: "/shen/training", label: "培训系统" },
  { slug: "tasks", href: "/shen/tasks", label: "任务管理" }
];

/** Retired and pinyin paths → current sider paths */
export const SHEN_LEGACY_REDIRECTS = [
  { from: "/shen/selection", to: "/shen/product" },
  { from: "/shen/growth", to: "/shen/product" },
  { from: "/shen/xuanpin", to: "/shen/product" },
  { from: "/shen/chengzhang", to: "/shen/product" },
  { from: "/shen/fufei", to: "/shen/paid" },
  { from: "/shen/peixun", to: "/shen/training" },
  { from: "/shen/renwu", to: "/shen/tasks" }
];
