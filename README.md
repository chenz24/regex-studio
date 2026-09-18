<div align="center">

# RegexStudio

**A modern, visual, debuggable workbench for regular expressions**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-ef4444.svg)](https://tanstack.com/start)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646cff.svg)](https://vitejs.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

**English** · [简体中文](./README_zh.md)

[Features](#features) · [Quick Start](#quick-start) · [Development](#development) · [Contributing](#contributing) · [License](#license)

</div>

---

## Introduction

**RegexStudio** is an open-source regular-expression workbench that aims to make writing, understanding, debugging and sharing regex effortless through a modern UI and rich visualizations.

Beyond the basics like live matching and capture-group inspection, RegexStudio offers multiple visual perspectives — **railroad diagrams**, a **node-based editor**, and **plain-language explanations** — so you can understand any regex from every angle.

> 📝 The project is under active development.

![Screenshot](public/og.png)

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
- ✅ **Test-case panel** — Assert match / no-match, exact counts, texts, ranges, captures and replacement output; save expectations and compare failures
- ⚠️ **Compatibility warnings** — Static checks that flag features unsupported by your target engine

### Multi-flavor & Code Generation

- 🌐 **Execution engines** — Native JavaScript and PCRE2 10.47 (WebAssembly); Python, Java, Go, .NET and Rust are independent static compatibility targets and do not change execution
- 🛠️ **Code generator** — One-click snippets for **10 languages**: JavaScript / TypeScript, Python, Java, Go, Rust, C# (.NET), PHP, Ruby, Swift, Kotlin

### PCRE2 execution

Select **PCRE2** to run matching, captures, replacements and test cases with the
real PCRE2 10.47 engine. The Worker and WASM load on demand; JavaScript users do
not download them. PCRE2 supports `\K`, recursion, atomic groups, possessive
quantifiers, and the `g/i/m/s/u/x/U/J` controls. `g` enables global iteration.

- Matching uses 16-bit code units, with exact UTF-16 capture offsets. This is
  not a PHP runtime: PHP uses an 8-bit library. `u` enables UTF and UCP here.
- Replacement syntax: `$0`, `$1`, `${name}`, `$$`. An empty replacement deletes matches.
- Worker execution has a 2-second budget, plus PCRE2 backtracking/memory limits.
  First-time engine loading has a separate 15-second budget; failures can be retried.
- PCRE2 has a bounded, independent visual parser: railroad diagrams, explanations
  and AST views cover common groups, `\K`, possessive quantifiers, inline options,
  recursion, branch-reset groups, assertion conditions and common long-form groups. Unsupported visual syntax
  shows a notice while native matching and tracing continue to work.
- The debugger records native PCRE2 callouts for the **first match**, in a separate
  Worker. Checkpoints expose source positions, backtracking flags and captures.
  Native optimizations remain enabled, so a trace is not an event per character.
  Recording is capped at 2,000 checkpoints / 50,000 capture slots; matching continues
  after recording stops, and the final step uses the native result.
- Click literal text, a character class, or a repetition badge to edit it. Edits
  preserve surrounding source and are compiled in a separate PCRE2 Worker before
  being applied. Literal input is escaped automatically; repetition applies to
  the entire selected text. Other constructs can be changed in the main editor.
- PCRE2 cross-engine compatibility checks are not yet available.
- Execution engines and compatibility targets are selected independently. Checks
  cover only some syntax; changing a target never changes matching or execution flags.
- Old v1/v2 share links migrate to v3 with their actual execution flags preserved.
  Previously display-only language options remain informational.
- The generated runtime is checked in, so `pnpm build` needs no C compiler.
  See [runtime build instructions](src/vendor/pcre2/README.md) and the
  [PCRE2 licence](src/vendor/pcre2/LICENSE.md).

### Test-case expectations

Open **Tests → Expectations & results** to enable assertions or **Set current result as expected**.
The latter saves counts, texts, UTF-16 ranges and captures; enable **Replacement output** first
if you also want to save the current substitution result. Editing an expected value creates a
draft: click **Save expectation** to apply it. All enabled expectations must pass.

- Match texts, ranges and capture lists are ordered JSON arrays, one item per match.
  Ranges are `[start, end)` in UTF-16 units. Capture objects contain `index`, `name`,
  `value`, `start`, `end`; `null` with `-1/-1` denotes an unmatched group, while `""`
  denotes a participating empty group. Captures may precede a full match after `\K`.
- Pending, timed-out, invalid, failed or incomplete executions cannot become passing
  expectations. At most 10,000 matches are counted; an extra match marks the count
  incomplete. Details retain up to 100 matches per case within a shared batch budget.
  Complete counts can still be checked when only details are capped.
- Filter failed or inconclusive cases, or compare results with a baseline kept while the
  panel stays open. A failing case can be loaded into the main text editor.
- **Export JSON / Import JSON** moves test cases and expectations. Imports append cases
  with new IDs and use the current workspace settings, up to 1,000 total cases.
  Large exported inputs and assertions can be imported without a separate file-size limit.
  Use **Share** for the complete engine/pattern/flags/replacement workspace.
  New v3 links preserve assertions; v1/v2 links keep their original match/no-match behavior.

### Linked result inspection

Select a match or capture in **Matches** to highlight its native text range and source.
Captures also highlight their railroad group; a full match highlights the whole expression.
Click highlighted test text to open its match, or select source text / click a railroad node
to locate the corresponding syntax. **Show source / Show test text** brings that editor into view.

- Offsets use UTF-16 `[start, end)`. Empty matches and captures have position markers;
  unmatched groups stay visible. Lookbehind and `\K` captures retain their actual ranges.
- Branch-reset groups can have multiple source definitions: all candidates are highlighted
  with an explanation. If visual parsing is unavailable, capture-to-source navigation is
  disabled; native matching and text ranges still work.
- In **Debugger**, enable **Follow steps in editors** or use the location buttons for a
  single step. PCRE2 uses native callout source offsets, including positions at the end
  of the expression, even when the railroad parser cannot represent the syntax.
- Editing the expression, flags, engine or test text clears stale selections. Narrow screens
  stack the editors and tools, with section navigation that does not focus the text editor.

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

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | [React 19](https://react.dev) + [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) |
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
git clone https://github.com/chenz24/regex-studio.git
cd regex-studio

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

The dev server starts at [http://localhost:5173](http://localhost:5173) by default.

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
| `pnpm test` | Run the unit tests and component tests (Vitest) |
| `pnpm verify:content` | Check every challenge and lesson reference solution |
| `pnpm verify:codegen` | Compile and run the generated snippets (needs the toolchains) |
| `pnpm verify:debugger` | Compare debugger results and captures with native RegExp (fixed seed; override with `REGEX_FUZZ_SEED`) |
| `pnpm test:e2e` | Build and run five real-browser regression projects |
| `pnpm test:e2e:built` | Run browser tests against an existing build |
| `pnpm test:watch` | Run the unit tests in watch mode |
| `pnpm check` | Run typecheck + lint + tests together |

### Browser regression tests

Install browsers with `pnpm exec playwright install chromium firefox webkit`
(add `--with-deps` on Linux CI). `pnpm test:e2e` starts an isolated production
preview on port 4187 and runs Chromium, Firefox, WebKit, mobile Chrome and mobile
WebKit emulation. Matching uses real Workers and WASM; resource request routing
exercises loading delays and network failures. Mobile emulation does not replace
real-device checks for the software keyboard and text selection.
Failure screenshots and traces are saved in `test-results/`. GitHub Actions runs
checks for pull requests, pushes to main, and manual dispatches.

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
   - 💡 **Feature requests**: describe the use case and value
2. **Submit a Pull Request**
   1. Fork the repo and create a feature branch off `main`
   2. Run `pnpm check` before pushing to ensure lint, type-check and tests pass
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

See the [official AGPL-3.0 page](https://www.gnu.org/licenses/agpl-3.0.html) for the full text.

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

---

<div align="center">

If RegexStudio helps you, please consider giving it a ⭐ Star!

</div>
