# 甄选未来桌面 App

独立 Electron 客户端直接连接 `https://zx.xingmaierp.cc`，沿用网站账号、权限、业务页面和接口。App 专用样式和窗口控件打包在客户端中，不修改网站页面样式。

- Windows 11 22H2 及以上使用系统 Acrylic；macOS 使用系统 under-window vibrancy。材料呈现窗口后方的实际内容，没有静态背景图片。其他 Windows 版本回退到实色。
- 默认窗口按当前屏幕工作区居中，最大 1380 × 880 逻辑像素，支持最小化、最大化、关闭和恢复居中。
- 左侧导航独立保留宽度；有模块标题时隐藏外层重复标题；底部导航保持单行并预留空间。
- 底部是个人快捷栏：从左侧图标或全部菜单拖入添加，横向拖动排序，右键或编辑模式中的 × 移除；按账号保存在本设备。已失去权限的入口不会显示或跳转。
- 左侧和底部共用液态玻璃选中效果：胶囊沿切换方向拉伸移动，轻微越过目标再回弹，保留细高光；尊重系统减少动态效果设置。
- `assets/logo-transparent.png` 为透明 PNG，`icon.ico` 和 `icon.icns` 使用同一素材转换。
- 只向页面暴露四个窗口操作；无 Node.js 页面权限，开启沙箱和上下文隔离，校验 IPC 主框架和公司站点来源。

## 开发与打包

在本目录执行：

```powershell
pnpm install --frozen-lockfile
node node_modules/electron/install.js
pnpm test
pnpm dev
pnpm pack:win
```

Windows 免安装可执行文件位于 `dist/ZhenxuanFuture-0.2.0-win-x64.exe`。
Mac 包须在 macOS 上执行 `pnpm pack:mac`，正式分发需要公司的 Apple 签名和公证配置；未在 Mac 真机上验证。
此目录不生成 Android 或 iOS 原生包。

开发可设置 `XM_DESKTOP_PREVIEW=http://127.0.0.1:端口` 使用本地服务；`XM_DESKTOP_LOGIN_PREVIEW=1` 打开登录页。打包后的应用忽略这些环境变量，固定连接正式公司站点。不要在客户端中加入管理员密码或会话。

桌面二进制与网站的 `0.1.N` 发版单独管理。若修改原网站下载入口或任何 `apps/xingmai` 文件，仍须按仓库发布闸门交单；构建本地客户端本身不覆盖服务器文件。
