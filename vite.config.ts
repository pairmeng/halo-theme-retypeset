import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Preset } from 'unocss';
import UnoCSS from 'unocss/vite';
import {
  presetAttributify,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';
import presetTheme from 'unocss-preset-theme';

export default defineConfig({
  plugins: [
    UnoCSS({
      content: {
        filesystem: ['templates/**/*.html'],
      },
      presets: [
        presetWind3(),
        presetAttributify(),
        presetTheme({
          theme: {
            dark: {
              colors: {
                primary: 'oklch(92% 0.005 298)',
                secondary: 'oklch(77% 0.005 298)',
                background: 'oklch(22% 0.005 298)',
                highlight: 'oklch(0.93 0.195089 103.2532 / 0.2)',
                note: 'oklch(70.7% 0.165 254.624 / 0.8)',
                tip: 'oklch(76.5% 0.177 163.223 / 0.8)',
                important: 'oklch(71.4% 0.203 305.504 / 0.8)',
                warning: 'oklch(82.8% 0.189 84.429 / 0.8)',
                caution: 'oklch(70.4% 0.191 22.216 / 0.8)',
              },
            },
          },
        }) as Preset<object>,
      ],
      theme: {
        colors: {
          primary: 'oklch(25% 0.005 298)',
          secondary: 'oklch(40% 0.005 298)',
          background: 'oklch(96% 0.005 298)',
          highlight: 'oklch(0.93 0.195089 103.2532 / 0.5)',
          note: 'oklch(48.8% 0.243 264.376 / 0.8)',
          tip: 'oklch(50.8% 0.118 165.612 / 0.8)',
          important: 'oklch(49.6% 0.265 301.924 / 0.8)',
          warning: 'oklch(55.5% 0.163 48.998 / 0.8)',
          caution: 'oklch(50.5% 0.213 27.518 / 0.8)',
        },
        fontFamily: {
          title: ['Snell-Black', 'EarlySummer-Subset', 'EarlySummer', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
          navbar: ['STIX-Italic', 'EarlySummer-Subset', 'EarlySummer', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
          time: ['Snell-Bold', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
          serif: ['STIX', 'EarlySummer', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        },
      },
      safelist: [
        'ml-4', 'ml-8', 'no-heti',
        'toc-links-h2', 'toc-links-h3', 'toc-links-h4',
      ],
      rules: [
        ['scrollbar-hidden', {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
        }],
      ],
      shortcuts: {
        'uno-desktop-column': 'fixed w-14rem',
        'uno-decorative-line': 'mb-4.5 h-0.25 w-10 bg-secondary/25 lg:(mb-6 w-11)',
        'uno-round-border': 'border border-secondary/5 rounded border-solid',
      },
      variants: [
        (matcher) => {
          if (!matcher.startsWith('cjk:')) {
            return matcher;
          }
          return {
            matcher: matcher.slice(4),
            selector: (s: string) => `${s}:is(:lang(zh), :lang(ja), :lang(ko))`,
          };
        },
        (matcher) => {
          if (!matcher.startsWith('layout-left:')) {
            return matcher;
          }
          return {
            matcher: matcher.slice(12),
            selector: (s: string) => `[data-layout="left"] ${s}`,
          };
        },
      ],
      transformers: [
        transformerDirectives(),
        transformerVariantGroup(),
      ],
    }),
  ],
  build: {
    outDir: fileURLToPath(new URL("./templates/assets/dist", import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "main",
      fileName: "main",
      formats: ["iife"],
      cssFileName: "style",
    },
  },
});
