import { Router } from "express";
import { formatChinaTime } from "./china-time.js";

const CARDS = [
  { key: "queue", label: "待发版", value: "—", unit: "单" },
  { key: "centers", label: "业务中心", value: "6", unit: "个" },
  { key: "session", label: "登录保持", value: "7", unit: "天" },
  { key: "theme", label: "页面风格", value: "跟随顶栏", unit: "" }
];

const NOTICES = [
  { title: "发版闸门", text: "上线只走版本发布中心。点「通过」才落地，禁止插队。" },
  { title: "经营数据", text: "看板在数据中心。本页只做工作台，不重复画指标大盘。" },
  { title: "组织与账号", text: "花名册在组织中心，资料和密码在个人中心。" }
];

const ENTRIES = [
  { href: "/data/overview", label: "数据总揽", hint: "看经营指标" },
  { href: "/releases", label: "版本发布中心", hint: "待放行单据" },
  { href: "/people", label: "组织中心", hint: "花名册与店权" },
  { href: "/me", label: "个人中心", hint: "资料与改密" },
  { href: "/agents", label: "甄选智能体", hint: "对话与接入" },
  { href: "/academy/courses", label: "培训课程", hint: "商学院课件" }
];

export function homeRouter() {
  const router = Router();
  router.get("/summary", (_req, res) => {
    res.json({
      ok: true,
      module: "home",
      title: "首页",
      greeting: "欢迎回到运营工作台",
      now: formatChinaTime(new Date()),
      cards: CARDS.map((card) => ({ ...card })),
      notices: NOTICES.map((row) => ({ ...row })),
      entries: ENTRIES.map((row) => ({ ...row }))
    });
  });
  return router;
}
