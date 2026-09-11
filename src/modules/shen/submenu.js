export const SHEN_SUBMENUS = [
  { slug: "product/xuanpin", href: "/shen/product/xuanpin", label: "选品" },
  { slug: "product/youhua", href: "/shen/product/youhua", label: "优化" },
  { slug: "product/chengzhang", href: "/shen/product/chengzhang", label: "产品成长" },
  { slug: "product", href: "/shen/product", label: "产品中心" },
  { slug: "paid", href: "/shen/paid", label: "付费中心" },
  { slug: "training", href: "/shen/training", label: "培训系统" },
  { slug: "tasks", href: "/shen/tasks", label: "任务管理" }
];

/** Retired and pinyin paths → current sider paths */
export const SHEN_LEGACY_REDIRECTS = [
  { from: "/shen/selection", to: "/shen/product/xuanpin" },
  { from: "/shen/growth", to: "/shen/product/chengzhang" },
  { from: "/shen/xuanpin", to: "/shen/product/xuanpin" },
  { from: "/shen/chengzhang", to: "/shen/product/chengzhang" },
  { from: "/shen/fufei", to: "/shen/paid" },
  { from: "/shen/peixun", to: "/shen/training" },
  { from: "/shen/renwu", to: "/shen/tasks" }
];
