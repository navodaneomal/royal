# ADR-0008 — Runtime `config.json` instead of build-time lock-in

**Status:** accepted (v2)

## Context

v1 read `VITE_STORY_ORIGIN` at build time. A drag-and-drop bundle could not
be re-pointed at a different stories project without rebuilding — and
Cloudflare may append a suffix to a taken project name.

## Decision

The app fetches `/config.json` at boot (`{ storyOrigin, supabaseUrl?,
supabaseAnonKey?, githubRepo?, githubBranch?, publishWorkflow? }`), with a
3-second budget and the service worker serving it network-first. The pure
`resolveConfig` validates every field, refuses placeholders, and refuses — with
a warning — any key that looks like a secret, because `config.json` is public.
`VITE_STORY_ORIGIN` still overrides (that is how `npm run dev` works).

## Consequences

- One build, many deployments: the audit serves the same `dist/` twice, once
  single-origin and once with a config pointing at a separate story origin.
- Secrets can never be "configured" into the app by accident.
- The deploy bundler writes `config.json`; the Android wrapper writes its own.
