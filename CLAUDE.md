# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test runner is configured yet.

## Architecture

This is a **Next.js 16 App Router** project with TypeScript and Tailwind CSS v4.

- `src/app/` — App Router directory. `layout.tsx` is the root layout; `page.tsx` is the home route.
- Path alias `@/*` maps to `src/*` (e.g., `import Foo from "@/components/Foo"`).
- Styling uses Tailwind CSS v4 (configured via `postcss.config.mjs`, no `tailwind.config` file needed).
- Fonts: Geist Sans and Geist Mono loaded via `next/font/google` in `layout.tsx`.

The project is at the initial scaffold stage — `src/app/page.tsx` is the only page and contains only boilerplate content.
