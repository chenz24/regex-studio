<div align="center">

# RegexStudio

**A modern, visual, debuggable workbench for regular expressions**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-ef4444.svg)](https://tanstack.com/start)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646cff.svg)](https://vitejs.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

**English** · [简体中文](./README_zh.md)

[Features](#features) · [Quick Start](#quick-start) · [Development](#development) · [Roadmap](./FEATURES.md) · [Contributing](#contributing) · [License](#license)

</div>

---

## Introduction

**RegexStudio** is an open-source regular-expression workbench that aims to make writing, understanding, debugging and sharing regex effortless through a modern UI and rich visualizations.

Beyond the basics like live matching and capture-group inspection, RegexStudio offers multiple visual perspectives — **railroad diagrams**, a **node-based editor**, and **plain-language explanations** — so you can understand any regex from every angle.

> 📝 The project is under active development. The full feature blueprint lives in [`FEATURES.md`](./FEATURES.md).

---

## Features

### Editing & Visualization

- 🎨 **Syntax-highlighted editor** — Powered by CodeMirror 6 with live coloring, error hints and flag toggles
- 🔍 **Live match testing** — Multi-line test input with instant highlighting and detailed capture-group info
- 🚂 **Railroad diagram** — Render regex structure as a clean, intuitive railroad diagram
- 🧩 **Visual node editor** — Build and refactor regex by manipulating nodes — beginner-friendly
- 📖 **Plain-language explanations** — Automatically translate regex into a human-readable breakdown
- 🔁 **Replace preview** — See the before/after diff in real time

### Debugging & Testing

- � **Step-by-step debugger** — Walk through the matching process step by step, with backtracking visualization and capture-group snapshots
- ✅ **Test-case panel** — Manage multiple test strings with expected match / no-match outcomes and one-click batch run
- ⚠️ **Compatibility warnings** — Static checks that flag features unsupported by your target engine

### Multi-flavor & Code Generation

- 🌐 **Flavor selector** — Switch between JavaScript, PCRE, Python, Java, Go, .NET, Rust, Ruby and more
- 🛠️ **Code generator** — One-click snippets for **10 languages**: JavaScript / TypeScript, Python, Java, Go, Rust, C# (.NET), PHP, Ruby, Swift, Kotlin

### Learning

- 🎓 **Interactive tutorial** — Curated lessons covering basics, quantifiers, groups, lookaround and practical patterns, with live validation
- 🏆 **Challenges** — Bite-sized practice problems with automatic grading to sharpen your skills
- � **Pattern library** — Curated patterns for emails, URLs, IPs, dates and more
- 📋 **Quick reference** — Built-in cheat sheet so you never have to leave the page

### Sharing & UX

- 🔗 **Share links** — Encode regex, flags, test text and replacement into a shareable URL
- 🌍 **i18n** — Full English & Simplified Chinese UI powered by Paraglide; locale-aware routes
- 🌗 **Light & dark theme** — Follow system or toggle manually
- ⚡ **SSR-ready** — Built on TanStack Start for fast first paint, friendly to SEO and link sharing

For planned features (performance analyzer, regex diff, AI assist, file processing, …) see [`FEATURES.md`](./FEATURES.md).

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | [React 18](https://react.dev) + [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) |
| **Build** | [Vite 7](https://vitejs.dev) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) |
| **Editor** | [CodeMirror 6](https://codemirror.net) |
| **State** | [Zustand](https://zustand-demo.pmnd.rs) |
| **Icons** | [Lucide](https://lucide.dev) |
| **i18n** | [Inlang Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) |
| **Lint & Format** | [Biome](https://biomejs.dev) |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (recommended) or npm / yarn

### Install & Run

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/regex-studio.git
cd regex-studio

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

The dev server starts at [http://localhost:3000](http://localhost:3000) by default.

### Production Build

```bash
pnpm build      # build production bundle
pnpm preview    # preview the production bundle locally
```

---

## Development

### Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server (HMR + SSR) |
| `pnpm build` | Build production bundle |
| `pnpm build:dev` | Build in development mode (handy for debugging) |
| `pnpm preview` | Preview production bundle |
| `pnpm lint` | Run Biome lint |
| `pnpm format` | Format the codebase with Biome |
| `pnpm check:biome` | Run Biome check + fix |
| `pnpm typecheck` | Run TypeScript type-check |
| `pnpm check` | Run typecheck + lint together |

### Project Structure

```
regex-studio/
├── messages/                  # Paraglide i18n source (en.json, zh.json)
├── project.inlang/            # Inlang project config
├── public/                    # Static assets (favicon, sitemap, ...)
├── src/
│   ├── challenges/            # Challenge definitions & evaluator
│   ├── components/
│   │   ├── challenges/        # Challenges UI (catalog, runner, drawer)
│   │   ├── diagram/           # Railroad diagram & node editor
│   │   ├── editor/            # Regex input, flavor selector, compat warnings
│   │   ├── layout/            # Test area, tool panel, footer
│   │   ├── sidebar/           # Pattern library & quick reference
│   │   ├── tools/             # Debugger, code gen, explanation, replace, test cases
│   │   ├── tutorial/          # Tutorial UI (catalog, runner, hints, ...)
│   │   └── ui/                # shadcn/ui primitives
│   ├── hooks/                 # Custom hooks
│   ├── lib/                   # AST, i18n, share-link helpers
│   ├── paraglide/             # Paraglide compiled output (generated)
│   ├── routes/                # TanStack Router file-based routes
│   │   ├── __root.tsx         # Root route (with SSR shell)
│   │   ├── index.tsx          # Default locale entry
│   │   └── $locale/           # Locale-aware routes (en, zh)
│   ├── stores/                # Zustand stores (regex, tutorial, challenges)
│   ├── tutorial/              # Lessons, validators, registry
│   ├── utils/                 # Parser, matcher, diagram IR, codegen, ...
│   │   └── codegen/           # Code generators for 10 target languages
│   ├── ssr.tsx                # SSR entry
│   ├── router.tsx             # Router instance
│   └── index.css              # Global styles
├── FEATURES.md                # Feature blueprint & roadmap
├── biome.json                 # Biome config
├── vite.config.ts
└── package.json
```

---

## Contributing

Contributions of any kind are warmly welcomed — bug reports, feature suggestions, doc improvements and code patches all matter.

### How to Help

1. **Open an Issue**
   - 🐛 **Bug reports**: include reproduction steps, expected vs. actual behavior, and your environment
   - 💡 **Feature requests**: describe the use case and value; feel free to reference [`FEATURES.md`](./FEATURES.md) when discussing priority
2. **Submit a Pull Request**
   1. Fork the repo and create a feature branch off `main`
   2. Run `pnpm check` before pushing to ensure lint and type-check pass
   3. Keep commit messages clear; we recommend [Conventional Commits](https://www.conventionalcommits.org/)
   4. In the PR description, explain the motivation, scope and how you tested
3. **Spread the Word**
   - Share RegexStudio in your projects, blog posts or social media
   - A ⭐ on the repo is the most direct encouragement to the maintainers

### Conventions

- Code style is enforced by **Biome** (lint + format)
- Use **functional components + Hooks**; avoid class components
- Prefer **Tailwind utility classes**; fall back to CSS only when needed
- Manage business state with Zustand; keep UI-local state in `useState` / `useReducer`
- For UI strings, add entries to `messages/en.json` and `messages/zh.json` and consume them via Paraglide

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

- ✅ You are free to **use, modify and distribute** the source code
- ⚠️ If you **modify** the project and offer it as a **network service**, you **must** publish the full modified source under the same AGPL-3.0 license
- ⚠️ Derivative works must retain the original copyright notice and license

See [`LICENSE`](./LICENSE) or the [official AGPL-3.0 page](https://www.gnu.org/licenses/agpl-3.0.html) for the full text.

> 💼 **Commercial use**: If AGPL-3.0's network-service clause does not fit your company's use case, please reach out to discuss a commercial license.

---

## Related Projects

Other small, focused developer tools from the same author — you might find them handy:

- [**rename.tools**](https://rename.tools) — Batch-rename files right in your browser with live previews and regex rules
- [**crontab.cv**](https://crontab.cv) — Visualize, build and explain crontab expressions at a glance
- [**json.tools**](https://json.tools) — Format, validate, diff and query JSON without leaving the tab
- [**easing.tools**](https://easing.tools) — Craft and preview CSS / motion easing curves interactively
- [**open-awesome.com**](https://open-awesome.com) — Browse and discover curated "awesome-*" lists from the open-source community

---

## Acknowledgements

RegexStudio stands on the shoulders of giants. Special thanks to:

- [TanStack](https://tanstack.com) — for the modern full-stack Router / Start solution
- [CodeMirror](https://codemirror.net) — for a powerful editor core
- [shadcn/ui](https://ui.shadcn.com) & [Radix UI](https://www.radix-ui.com) — for elegant UI primitives
- [Tailwind CSS](https://tailwindcss.com) — for making styling enjoyable
- And all the pioneering tools mentioned in [`FEATURES.md`](./FEATURES.md) that inspired this project

---

<div align="center">

If RegexStudio helps you, please consider giving it a ⭐ Star!

</div>
