# Retypeset for Halo

[简体中文](./README.zh.md)

A typography-focused blog theme for [Halo](https://www.halo.run/), adapted from [astro-theme-retypeset](https://github.com/radishzzz/astro-theme-retypeset). Reviving the beauty of typography with a paper book-like reading experience.

## Preview

![Desktop Preview](https://raw.githubusercontent.com/radishzzz/astro-theme-retypeset/refs/heads/master/assets/images/v1/retypeset-en-desktop.webp)
![Mobile Preview](https://raw.githubusercontent.com/radishzzz/astro-theme-retypeset/refs/heads/master/assets/images/v1/retypeset-en-mobile.webp)

## About

This project is a **Halo theme adaptation** of the original [Retypeset](https://github.com/radishzzz/astro-theme-retypeset) Astro theme created by [radishzz](https://github.com/radishzzz). It preserves the original theme's elegant typography design while adapting it to work natively with the Halo blogging platform.

### Differences from the Original

- **Platform**: Halo (Thymeleaf templates) instead of Astro (static site generator)
- **Rendering**: Server-side rendering via Halo's template engine
- **Routing**: Custom client-side router with View Transitions API for SPA-like experience
- **Styling**: UnoCSS with Vite build pipeline (same as original)
- **Editor Support**: Compatible with Halo's default editor and markdown editor plugins (Vditor, ByteMD, etc.)

## Features

- Light / Dark mode with system preference detection
- Custom light and dark color settings
- Configurable sidebar navigation and footer sections
- Elegant page transition animations with element morphing
- Optimized CJK typography via [heti](https://github.com/sivan/heti)
- Table of Contents generation
- Image zoom
- LaTeX math rendering
- Responsive design
- SEO friendly

## Installation

1. Download the latest release from [Releases](https://github.com/picsky/halo-theme-retypeset/releases) page.
2. Go to your Halo admin panel → **Appearance** → **Themes** → **Install**.
3. Upload the `.zip` file and activate the theme.

## Development

```bash
# Clone the repository
git clone https://github.com/picsky/halo-theme-retypeset.git

# Navigate to the project directory
cd halo-theme-retypeset

# Install dependencies
pnpm install

# Build the theme
pnpm build
```

The built theme package will be at `dist/theme-retypeset-*.zip`.

## Credits

This project would not be possible without the following:

- [Retypeset](https://github.com/radishzzz/astro-theme-retypeset) - Original Astro theme by [radishzz](https://github.com/radishzzz)
- [Typography](https://github.com/moeyua/astro-theme-typography) - Inspiration for the original theme
- [heti](https://github.com/sivan/heti) - CJK typography optimization
- [EarlySummerSerif](https://github.com/GuiWonder/EarlySummerSerif) - Chinese serif font
- [Halo](https://github.com/halo-dev/halo) - The blogging platform

## License

This project is licensed under the [MIT License](./LICENSE).

Original theme Copyright (c) 2025 [radishzz](https://github.com/radishzzz).
Halo adaptation Copyright (c) 2025 [picsky](https://github.com/picsky).
Secondary development Copyright (c) 2026 paimon.
