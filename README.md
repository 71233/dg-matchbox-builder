# DG Matchbox Builder

A visual, local-first builder for Autodesk Flame Matchbox shaders targeting Flame 2025.1 and later.

## Implemented public-beta surface

- Six working recipes and a 26-node verified catalogue
- Shared `ProjectV1` model with structural validation
- Dual GLSL 430 and GLSL ES 3.00 generation
- Live WebGL 2 before/after preview with local image input
- Read-only generated GLSL and Matchbox XML
- IndexedDB autosave and `.dgmb.json` import
- Deterministic ZIP export with thumbnail, English documentation, licenses, and safe validation helpers
- English-only builder, gallery, learning, account, and moderation surfaces
- Optional Supabase Auth, RLS, immutable revisions, favorites, and review functions
- GitHub Pages and backend deployment workflows

## Local development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` to connect a Supabase project. The builder and demo gallery remain usable without Supabase.

## Verification

```sh
npm run typecheck
npm test
npm run lint
npm run build
```

Browser validation is an early check, not proof of Flame rendering. Release templates must also pass `shader_builder` and render tests on macOS and Linux Flame 2025.2.7 workstations.

## Licensing

Application source is MIT licensed. Matchbox code exported by the builder uses MIT; generated preview media and documentation use CC BY 4.0. Autodesk and Flame are trademarks of Autodesk, Inc. This project is independent and is not endorsed by Autodesk.
