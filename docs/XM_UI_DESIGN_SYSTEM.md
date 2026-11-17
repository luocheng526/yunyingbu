# 星迈业务页面 UI 设计系统

本规范仅适用于系统的 **Main Content 业务内容区**。它不重置页面基础样式，不修改 Header、Sidebar、全局导航、路由、权限或数据接口。

## 1. 接入方式

壳子已经加载 `/shared/xm-ui.css` 和 `/shared/xm-ui.js`。业务页不要再引一次，也不要改这两个文件。登录页不加载这套组件。

业务模块只在自己挂进 `#xm-content` 的根节点上加 `xm-ui-scope`。没有这层 class 时，现有页面样子不变。

```html
<div class="xm-ui-scope">
  <div id="business-content"></div>
</div>
```

```js
const ui = window.XmUI;
```

所有 Token 定义在 `.xm-ui-scope` 上，所有组件选择器均以 `.xm-ui-scope` 开头。禁止把这些 Token 移到 `:root`，也禁止在共享文件中添加 `body`、`button`、`table` 等全局重置。

公共组件、设计变量和本文件只由主框架维护。业务对话只改自己的页面，不要同时改 `xm-ui.css`、`xm-ui.js` 或本规范。要新增通用组件，交给主框架按本规范加进 `window.XmUI`。

## 2. Design Tokens

### 色彩

| Token | 值 | 用途 |
| --- | --- | --- |
| `--xm-ui-bg` | `#f2f6fd` | Main Content 背景 |
| `--xm-ui-surface` | `#ffffff` | 卡片、输入框、弹层 |
| `--xm-ui-border` | `#e4ebf5` | 默认分隔线 |
| `--xm-ui-text` | `#17233d` | 标题和正文 |
| `--xm-ui-text-secondary` | `#52617a` | 说明文字 |
| `--xm-ui-text-muted` | `#8b98ad` | 辅助信息 |
| `--xm-ui-primary` | `#1677ff` | 主要操作、选中态、图表主色 |
| `--xm-ui-green` | `#12b76a` | 成功、增长 |
| `--xm-ui-orange` | `#f79009` | 等待、提醒 |
| `--xm-ui-purple` | `#7a5af8` | 草稿、课程分类 |
| `--xm-ui-red` | `#e5484d` | 失败、危险 |

图表优先使用蓝色作为主序列，绿色、橙色、紫色作为后续序列。网格线使用 `--xm-ui-border`；Tooltip 使用深蓝黑背景和白色文字。

### 圆角、阴影和间距

- 小型控件圆角：`8px`
- 内容卡片圆角：`12px`
- 大型弹层圆角：`16px`
- 卡片阴影：`0 6px 20px rgba(31, 70, 120, 0.07)`
- 间距按 `4 / 8 / 12 / 16 / 20 / 24 / 32px` 递增
- 页面内容区建议四周留白 `24–32px`，卡片间距 `16px`

## 3. 排版规则

- 页面标题：`28px / 1.25`，只出现一个 `h1`
- 模块标题：`16px / 1.35`，左侧使用 `4px` 蓝色竖线
- 正文：`14px / 1.5`
- 辅助信息：`12–13px`
- KPI 数字：`27px`、加粗；单位紧随数字并降至 `13px`

## 4. 公共组件

公共组件由 `/shared/xm-ui.js` 暴露在 `window.XmUI`：

| 组件 | 用途 |
| --- | --- |
| `PageContentHeader` | 页面标题、说明和页面级操作 |
| `StatCard` | KPI 图标、数值、单位和趋势 |
| `ContentCard` | 统一白色内容容器 |
| `SectionTitle` | 蓝色竖线模块标题 |
| `FilterToolbar` | Tab、筛选器和搜索框 |
| `DataTable` | 业务数据表格 |
| `StatusBadge` | 语义状态标签 |
| `ChartCard` | 图例、图表和 Tooltip 容器 |
| `ProgressCard` | 课程、任务和学习进度 |
| `EmptyState` | 空数据说明与下一步操作 |

组件返回 HTML 字符串，适合当前项目的原生 JavaScript 架构：

```js
const ui = window.XmUI;

document.querySelector("#content").innerHTML =
  ui.PageContentHeader({
    title: "订单管理",
    description: "查看和处理全部业务订单",
    actions: [{ label: "新建订单" }]
  }) +
  ui.StatCard({
    label: "待处理",
    value: "28",
    unit: "单",
    icon: "file",
    tone: "orange"
  });
```

## 5. 组件细则

### 页面标题与按钮

页面标题区使用左右布局：左侧是标题和一行说明，右侧只放页面级操作。主要按钮为蓝底白字，次要按钮为白底描边；同一区域只保留一个主要按钮。

### 卡片与 KPI

卡片使用白色背景、`12px` 圆角和浅阴影。KPI 卡片最小高度 `104px`，图标容器 `48px`，图标颜色通过 `blue / green / orange / purple` tone 控制。不要仅用颜色表达涨跌，必须保留文字或符号。

### 筛选、Tab 与搜索

筛选栏保持单行优先，窄屏自动换行。Tab 选中态使用白底、蓝字和轻阴影。搜索框必须有可访问名称，输入控件聚焦时使用蓝色描边和半透明焦点环。

### 数据表格

表头高度 `42px`、数据行高度 `52px`。表头使用浅灰蓝背景，行之间使用细分隔线。窄屏允许水平滚动，不压缩关键数据。状态列统一使用 `StatusBadge`。

### 课程与进度

课程卡片由封面、语义标签、标题、元数据、进度条和操作组成。进度值限制在 `0–100`；未开始也显示 0% 轨道，保持布局稳定。

### 弹窗、抽屉、空状态与加载

- 弹窗：白色卡片、`12px` 圆角、深色半透明遮罩，危险操作必须二次确认。
- 抽屉：右侧进入，标题和底部操作固定，内容区独立滚动。
- 空状态：图标、标题、说明、单一下一步操作；不要用空白区域代替。
- 加载状态：优先使用骨架屏，形状应接近最终内容；遵守系统“减少动态效果”设置。

## 6. 可访问性与响应式

- 所有可交互元素使用原生 `button`、`input`、`select`。
- 键盘焦点清晰可见，不能只依赖 hover。
- 文字和背景保持至少 WCAG AA 对比度。
- `1100px` 以下 KPI 改为两列，`760px` 以下改为单列。
- 动画在 `prefers-reduced-motion: reduce` 下关闭。

## 7. 展示页

视觉验收页位于 `/ui-design-system.html`。它独立存在，不加入系统导航，不替换任何业务页面，也不调用业务接口。
