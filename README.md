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

## Workspace controls

- Switch between Preview, Graph, and Code with the persistent tabs. Graph and Code keep a floating preview; drag its title to move it or its lower-right corner to resize it. Arrow keys on either handle also work.
- Open multiple sections in Node controls, or search by node or parameter name. Selecting a graph node opens its controls. Reset restores the node definition's default value.
- Mouse mode: wheel to zoom, blank-canvas or middle-button drag to pan. Trackpad mode: two-finger scroll to pan and pinch to zoom. Both support Space + drag to pan and Shift + drag to select.
- Select a wire and choose Disconnect, press Delete/Backspace, or use its context menu. Drag a wire endpoint to reconnect; dropping an output onto an occupied input replaces the old wire. Invalid or cancelled drops retain the original connection.
- Undo/Redo retain up to 100 edits during the session. A slider gesture or node drag is one edit. Use Cmd/Ctrl + Z, Shift + Cmd/Ctrl + Z, or Ctrl + Y outside text inputs.
- Saved locally confirms IndexedDB storage succeeded. Save failed offers retry and a `.dgmb.json` backup. Importing or choosing a recipe clears undo history; preview geometry and input-device preferences stay on this browser.

The Flame UI summary still shows the first five published controls. Full page/column inspection is deferred.

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
npm run test:e2e
```

Browser validation is an early check, not proof of Flame rendering. Release templates must also pass `shader_builder` and render tests on macOS and Linux Flame 2025.2.7 workstations.

## Licensing

Application source is MIT licensed. Matchbox code exported by the builder uses MIT; generated preview media and documentation use CC BY 4.0. Autodesk and Flame are trademarks of Autodesk, Inc. This project is independent and is not endorsed by Autodesk.
