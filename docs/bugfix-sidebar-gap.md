# 侧边栏间距设置不生效问题

## 问题描述

在 Halo 后台 `设置 → 侧边栏 → 桌面侧边栏间距` 修改 `desktop_offset` 后，页面布局未响应新值，侧边栏与正文间距保持不变。

## 根因

### 主要原因：SPA 路由 `syncHtmlElement` 未同步 `style` 属性

**文件：** `src/components/client-router.ts`，`syncHtmlElement()` 函数

```typescript
function syncHtmlElement(newDoc: Document): void {
  const oldHtml = document.documentElement;
  const newHtml = newDoc.documentElement;

  oldHtml.className = newHtml.className;   // ✅ 同步了 class
  oldHtml.classList.toggle('dark', isDark);
  oldHtml.classList.toggle('reduce-motion', isReduceMotion);

  if (newHtml.lang) oldHtml.lang = newHtml.lang;  // ✅ 同步了 lang
  // ❌ style 属性未同步
}
```

**调用链：**
1. `layout.html` 通过 `th:style` 将 `desktop_offset` 写入 `<html>` 的 inline style：`style="--layout-sidebar-gap:Xrem"`
2. `global.css` 的 `:root` 块中 `--layout-sidebar-gap-safe` 引用 `var(--layout-sidebar-gap)` 来计算布局位置
3. SPA 导航时 `swapContent()` → `syncHtmlElement()` 只同步了 `className` 和 `lang`，忽略了 `style`

**影响范围：** 用户保存设置后，SPA 导航（点击链接）到任何页都不会更新间距。只有硬刷新（F5）才能看到新值。

### 次要问题：`layout.html` 对 number 字段使用了 `#strings.isEmpty`

**文件：** `templates/modules/layout.html:28`

```html
sidebarDesktopOffset=${theme.config.sidebar != null
  and !#strings.isEmpty(theme.config.sidebar.desktop_offset)
  ? theme.config.sidebar.desktop_offset : 11.25}
```

`desktop_offset` 是 `$formkit: number` 字段，`#strings.isEmpty()` 是字符串工具方法。虽然 Thymeleaf 会 toString 转换，但用 `!= null` 做空值检查更稳健、语义更清晰。

### 附带说明：CSS 钳位下限

`global.css` 中 `--layout-sidebar-gap-safe` 的 `max(1rem, min(...))` 意味着设置为 0~1rem 之间的值会被钳位到 1rem。这是有意的保护（防止间距过小），但用户需要知晓。

## 修复方案

### 修复 1：`syncHtmlElement` 同步 `--layout-sidebar-gap`

在 `syncHtmlElement` 中，从新页面 `<html>` 的 style 中读取 `--layout-sidebar-gap` 值并应用到当前页面：

```typescript
// Sync layout sidebar gap from the new page
const newGap = newHtml.style.getPropertyValue('--layout-sidebar-gap');
if (newGap) {
  oldHtml.style.setProperty('--layout-sidebar-gap', newGap);
}
```

只同步这一个 CSS 变量，不影响 JS 运行时设置的其他 style 属性（如 `--un-preset-theme-colors-*`）。

### 修复 2：`layout.html` 改用 `!= null` 检查

```html
sidebarDesktopOffset=${theme.config.sidebar?.desktop_offset != null
  ? theme.config.sidebar.desktop_offset : 11.25}
```

## 验证

1. `pnpm run build-only` 确认编译通过
2. 在 Halo 后台修改 `desktop_offset`，保存后 SPA 导航到其他页面，确认间距更新
3. 硬刷新后确认间距与设置一致
4. 设置为极端值（0、20）确认布局正常
