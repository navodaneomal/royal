# ADR-0001 — npm workspaces; plain ESM + JSDoc for runtime packages; TypeScript for the app

**Status:** accepted

## Context

The blueprint demands one contract shared by three very different runtimes: the
browser app, a Node CLI, and a Deno edge function. Any build step between “the rules”
and “the thing enforcing the rules” is a place for drift.

## Decision

- One repository, npm workspaces (`packages/*`, `apps/*`) — no Nx/Turbo; the graph is
  small and `npm run` scripts are legible.
- `packages/protocol`, `bridge-host`, `story-sdk`, `story-cli`: **plain ESM JavaScript
  with JSDoc types and zod schemas**. Stock Node runs the CLI and the story host with
  zero compilation; the Deno function imports the identical files from
  `supabase/functions/_shared/protocol/`.
- `apps/web`: TypeScript + React + Vite — the app is where UI-state complexity lives
  and where TS pays for itself.
- zod schemas are the single source of truth for every wire shape; the reducer is one
  pure function used verbatim by the app's local commit path, the CLI's validator,
  and the server's trusted commit path.

## Consequences

- “Same rules everywhere” is literal: one reducer file, three importers (tested).
- No d.ts emission for the runtime packages; JSDoc keeps editor help without a build.
- The SDK still gets one esbuild pass — an IIFE stories can inline — but that is a
  packaging artifact, not a compile step for logic.
