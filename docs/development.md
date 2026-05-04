# 开发文档

本文档记录 `halo-theme-retypeset` 当前代码结构、构建流程、主题配置和已知问题，方便后续继续排查“修改后不起作用”和桌面布局调整问题。

## 项目信息

- 主题名称：重新编排
- Halo 主题标识：`theme-retypeset`
- 当前主题作者：`paimon`
- 当前仓库：`https://github.com/pairmeng/halo-theme-retypeset`
- Halo 最低版本：`>=2.21.0`
- 前端构建：Vite + TypeScript + UnoCSS
- 模板引擎：Halo Thymeleaf 模板

## 目录结构

| 路径 | 作用 |
| --- | --- |
| `theme.yaml` | Halo 主题元信息，包括作者、版本、仓库地址、设置名和配置名。 |
| `settings.yaml` | Halo 后台主题设置表单。 |
| `templates/` | Halo Thymeleaf 页面模板和模块。 |
| `templates/modules/layout.html` | 全站布局骨架，读取主题配置并输出 CSS 变量。 |
| `templates/modules/base-head.html` | `<head>`、主题配色初始化、资源引用和 JS 配置输出。 |
| `templates/modules/header.html` | 侧边栏站点标题区域。 |
| `templates/modules/navbar.html` | 侧边栏导航。 |
| `templates/modules/footer.html` | 侧边栏页脚和 Powered by 信息。 |
| `templates/assets/styles/` | 主题样式入口，最终由 Vite 打包到 `assets/dist/style.css`。 |
| `src/main.ts` | 浏览器端入口，初始化主题切换、TOC、图片预览、代码复制和 SPA 路由。 |
| `src/components/client-router.ts` | 页面过渡和类 SPA 导航实现。 |
| `src/components/mobile-toc.ts` | 移动端侧边目录。 |
| `src/components/image-zoom.ts` | 图片点击预览。 |
| `src/components/code-copy.ts` | 代码块复制按钮逻辑。 |
| `tests/` | Vitest 单元测试。 |
| `docs/spa-plugin-compatibility.md` | SPA 页面过渡与 Halo 插件兼容性说明。 |

## 构建与验证

Windows PowerShell 下建议使用 `pnpm.cmd`：

```powershell
pnpm.cmd install
pnpm.cmd exec tsc --noEmit
pnpm.cmd run test
pnpm.cmd run build
```

构建产物：

- 前端资源：`templates/assets/dist/`
- Halo 主题包：`dist/theme-retypeset-*.zip`

Halo 安装测试时需要确认上传的是最新生成的 zip，并在后台主题详情里确认版本号已经变化。主题资源引用带有 `?v=${theme.spec.version}`，版本号不变时浏览器或 Halo 资源缓存可能让 CSS/JS 看起来“没有生效”。

## 主题设置

核心设置来自 `settings.yaml`：

- `general.language`：界面语言，`zh` 或 `en`。
- `general.color_mode`：默认配色，支持跟随系统、深色、浅色。
- `general.font_style`：正文主要字体风格。
- `general.layout_direction`：侧边栏在左侧或右侧。
- `general.toc_desktop_mode`：桌面端目录模式，支持常显、收缩、关闭。
- `general.toc_mobile_mode`：移动端目录模式，支持顶部手风琴、侧边目录、关闭。
- `sidebar.desktop_offset`：桌面侧边栏与正文之间的水平距离，单位 `rem`。
- `sidebar.*`：控制侧边栏标题、导航、底部、社交、版权、ICP、Powered by 展示。
- `appearance.*`：自定义浅色和深色配色。
- `advanced.enable_transition`：是否启用页面过渡动画。
- `advanced.custom_css` / `advanced.custom_head`：用户自定义样式和 Head 内容。

## 桌面布局现状

桌面布局主要由 `templates/assets/styles/global.css` 的 CSS 变量控制：

- `.content-wrapper`：中间正文列。
- `.sidebar-column`：站点标题、导航、页脚所在的固定侧边栏列。
- `#toc-container`：文章页桌面目录列。
- `.layout-flip-buttons`：主题切换、搜索、回到顶部等按钮列。

当前实现把正文、目录和侧边栏建模为一组桌面列：

- 右侧栏：`TOC | content | sidebar`
- 左侧栏：`sidebar | content | TOC`

`sidebar.desktop_offset` 通过 `layout.html` 写入根节点 CSS 变量：

```html
th:style="${'--layout-sidebar-gap:' + sidebarDesktopOffset + 'rem'}"
```

注意：Halo 后台 number 设置读出后可能是字符串，不能在 Thymeleaf / SpEL 中直接写 `sidebarDesktopOffset / 2` 这类数学表达式，否则会触发 `String / Integer` 的 500 错误。

## 已知布局问题

状态：未修复。

用户反馈：修改 `sidebar.desktop_offset` 后，右侧侧边栏可以移动，但中间文章主体和左边目录没有按预期一起移动，视觉上仍不协调。前一次尝试把正文、目录和侧边栏建模为同一组桌面列，但实际部署验证后仍没有解决问题。

当前结论：不能再只围绕 `sidebar.desktop_offset` 调整右侧栏距离。下一轮需要重新审视桌面布局模型，重点确认 `.content-wrapper`、`#toc-container`、`.sidebar-column` 在真实 Halo 页面中最终生效的 CSS，以及 UnoCSS 生成规则和自定义 CSS 变量之间的优先级关系。

当前排查方向：

1. 先确认部署包是否真的是最新版本。
2. 确认 Halo 主题详情显示的版本号是否已经变化。
3. 检查浏览器 Network 中加载的 `style.css?v=版本号` 是否为最新版本。
4. 如果资源已更新但布局仍不对，需要重新设计桌面列的 CSS 变量，不再只把 `desktop_offset` 理解为“正文与侧边栏的间距”，而应提供更直接的“整体内容组偏移”或“正文位置”控制。
5. 如需更细控制，可以拆成多个设置：正文组偏移、目录间距、侧边栏间距、最小边距。

## 修改布局时的注意事项

- 不要在 Thymeleaf 表达式里对后台配置值直接做数学运算，优先把值作为 CSS 变量传给浏览器处理。
- `global.css` 中的 `@media (min-width: 1024px)` 控制桌面正文和侧边栏定位。
- `@media (min-width: 1536px)` 才启用桌面固定 TOC，因此 1536px 以下看不到桌面三列布局。
- UnoCSS 类写在模板中，CSS 变量写在 `global.css`；修改布局时两边都要检查。
- 构建后必须上传 `dist/theme-retypeset-*.zip`，直接改源码不会影响已安装到 Halo 的主题包。

## 发布检查清单

1. 修改 `package.json` 和 `theme.yaml` 的版本号。
2. 运行 `pnpm.cmd exec tsc --noEmit`。
3. 运行 `pnpm.cmd run test`。
4. 运行 `pnpm.cmd run build`。
5. 上传 `dist/theme-retypeset-*.zip` 到 Halo。
6. 在 Halo 后台确认主题版本、作者和配置项是否为最新。
7. 用无缓存刷新或隐私窗口检查前台页面。
