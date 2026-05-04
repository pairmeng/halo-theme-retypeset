# 重新编排 - Halo 主题版

一款专注排版的博客主题，移植自 [astro-theme-retypeset](https://github.com/radishzzz/astro-theme-retypeset)，适配 [Halo](https://www.halo.run/) 博客平台。以纸质书般的阅读体验，重新唤醒排版之美。

## 预览

![桌面端预览](https://raw.githubusercontent.com/radishzzz/astro-theme-retypeset/refs/heads/master/assets/images/v1/retypeset-zh-desktop.webp)
![移动端预览](https://raw.githubusercontent.com/radishzzz/astro-theme-retypeset/refs/heads/master/assets/images/v1/retypeset-zh-mobile.webp)

## 关于

本项目是 [radishzz](https://github.com/radishzzz) 原创 [Retypeset](https://github.com/radishzzz/astro-theme-retypeset) Astro 主题的 **Halo 平台移植版**。保留了原主题优雅的排版设计，同时适配 Halo 博客平台的原生功能。

### 与原主题的区别

- **平台**：Halo（Thymeleaf 模板）替代 Astro（静态站点生成器）
- **渲染**：通过 Halo 模板引擎进行服务端渲染
- **路由**：自定义客户端路由 + View Transitions API，实现类 SPA 体验
- **样式**：UnoCSS + Vite 构建（与原主题一致）
- **编辑器**：兼容 Halo 默认编辑器及 Markdown 编辑器插件（Vditor、ByteMD 等）

## 功能特性

- 浅色 / 深色模式，支持跟随系统偏好
- 自定义浅色和深色配色
- 可配置侧边栏导航和底部信息
- 优雅的页面过渡动画与元素形变效果
- 基于 [heti](https://github.com/sivan/heti) 的中文排版优化
- 自动生成文章目录
- 图片缩放预览
- LaTeX 数学公式渲染
- 响应式设计
- SEO 友好

## 安装

1. 从 [Releases](https://github.com/pairmeng/halo-theme-retypeset/releases) 页面下载最新版本。
2. 进入 Halo 管理后台 → **外观** → **主题** → **安装**。
3. 上传 `.zip` 文件并启用主题。

## 开发

```bash
# 克隆仓库
git clone https://github.com/pairmeng/halo-theme-retypeset.git

# 进入项目目录
cd halo-theme-retypeset

# 安装依赖
pnpm install

# 构建主题
pnpm build
```

构建完成后，主题包位于 `dist/theme-retypeset-*.zip`。

更完整的代码结构、构建发布流程和当前布局问题记录见 [开发文档](./docs/development.md)。

## 致谢

本项目的诞生离不开以下项目：

- [Retypeset](https://github.com/radishzzz/astro-theme-retypeset) - [radishzz](https://github.com/radishzzz) 原创 Astro 主题
- [Typography](https://github.com/moeyua/astro-theme-typography) - 原主题的灵感来源
- [heti](https://github.com/sivan/heti) - 中文排版优化
- [初夏明朝体](https://github.com/GuiWonder/EarlySummerSerif) - 中文衬线字体
- [Halo](https://github.com/halo-dev/halo) - 博客平台

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。

原主题版权所有 (c) 2025 [radishzz](https://github.com/radishzzz)。
Halo 移植版版权所有 (c) 2025 [picsky](https://github.com/picsky)。
当前主题维护与二次开发版权所有 (c) 2026 paimon。
