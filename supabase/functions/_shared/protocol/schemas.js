/**
 * @storyframe/protocol — the single contract shared by the SDK, the host
 * bridge, the CLI, the edge functions, and the tests.
 *
 * Plain ESM JavaScript with Zod schemas so the same file runs on stock
 * Node (CLI, functions) and inside the bundled app without a build step.
 *
 * Blueprint references: §13 (package contract), §14 (bridge), §15 (progress).
 */
import { z } from 'zod'

/* ── protocol constants ─────────────────────────────────────────────── */
export const PROTOCOL_VERSION = '1.0'
export const SUPPORTED_PROTOCOLS = ['1.0']
export const MAX_MESSAGE_BYTES = 64 * 1024        // §14.5
export const MAX_SNAPSHOT_BYTES = 256 * 1024      // §15.1
export const SNAPSHOT_RETENTION = 10              // §15.5 rolling backups

export const CAPABILITIES = /** @type {const} */ ([
  'progress.read',
  'progress.write',
  'inventory.write',
  'achievement.unlock',
  'choice.commit',
  'ui.fullscreen',
  'ui.share',
])

const id = z.string().min(1).max(128)
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'semantic version required')
const checkpointId = z.string().regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/i, 'checkpoint ids are slash/dash slugs')

/* ── manifest: storyframe.v1 (§13.2) ────────────────────────────────── */
export const ManifestSchema = z.object({
  $schema: z.string().optional(),
  storyId: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: semver,
  protocolVersion: z.enum(['1.0']),
  stateSchemaVersion: z.number().int().positive(),
  title: z.string().min(1).max(120),
  tagline: z.string().max(240).optional(),
  entrypoint: z.string().min(1),
  languages: z.array(z.string().min(2)).min(1),
  defaultLanguage: z.string().min(2),
  capabilities: z.array(z.enum(CAPABILITIES)).default([]),
  content: z.object({
    rating: z.enum(['everyone', 'teen', 'mature']),
    warnings: z.array(z.string()).default([]),
    estimatedMinutes: z.object({
      firstSession: z.number().positive(),
      total: z.tuple([z.number().positive(), z.number().positive()]),
    }),
  }),
  accessibility: z.object({
    keyboard: z.boolean(),
    screenReader: z.boolean(),
    reducedMotion: z.boolean(),
    captions: z.boolean(),
    untimedMode: z.boolean(),
    nonAudioAlternative: z.boolean(),
  }),
  offline: z.object({
    eligible: z.boolean(),
    required: z.array(z.string()).default([]),
    optional: z.array(z.string()).default([]),
    maxBytes: z.number().int().positive().default(50 * 1024 * 1024),
  }),
  checkpoints: z.array(z.object({
    id: checkpointId,
    label: z.string().min(1).max(120),
    order: z.number().int().nonnegative(),
  })).min(1),
  items: z.array(z.object({
    id: id,
    name: z.string().min(1).max(120),
    description: z.string().max(400).default(''),
    alt: z.string().min(1).max(300),           // required alt text (§6.7)
    spoilerCheckpoint: checkpointId.optional() // hidden until reader passed it
  })).default([]),
  achievements: z.array(z.object({
    id: id,
    name: z.string().min(1).max(120),
    description: z.string().max(300).default(''),
    secret: z.boolean().default(false),
  })).default([]),
  choices: z.array(z.object({
    id: id,
    label: z.string().max(200).default(''),
    options: z.array(z.string()).min(2),
  })).default([]),
  endings: z.array(z.object({
    id: id,
    name: z.string().max(120),
  })).default([]),
  integrity: z.object({
    generatedAt: z.string(),
    files: z.string(),
  }).optional(),
})

/* ── reader preferences (§20.2) ─────────────────────────────────────── */
export const PreferencesSchema = z.object({
  colorScheme: z.enum(['light', 'dark', 'system']).default('system'),
  contrast: z.enum(['normal', 'more']).default('normal'),
  motion: z.enum(['full', 'reduced', 'none']).default('full'),
  textScale: z.number().min(0.8).max(2.0).default(1),
  lineHeight: z.enum(['compact', 'normal', 'relaxed']).default('normal'),
  fontMode: z.enum(['story', 'readable', 'dyslexia-friendly']).default('story'),
  sound: z.enum(['on', 'muted']).default('muted'),
  captions: z.boolean().default(true),
  puzzleAssist: z.enum(['standard', 'untimed', 'guided']).default('standard'),
  locale: z.string().default('en'),
})
export const defaultPreferences = () => PreferencesSchema.parse({})

/* ── progress snapshot (§15.1) ──────────────────────────────────────── */
const stateValue = z.union([z.boolean(), z.number(), z.string(), z.array(z.string())])
export const SnapshotSchema = z.object({
  checkpointId: checkpointId,
  checkpointOrder: z.number().int().nonnegative(),
  stateSchemaVersion: z.number().int().positive(),
  storyState: z.record(stateValue).default({}),
  inventory: z.record(z.object({
    quantity: z.number().int().nonnegative(),
    discoveredAt: z.string(),
  })).default({}),
  achievements: z.array(id).default([]),
  committedChoices: z.record(z.string()).default({}),
  visitedMoments: z.array(z.string()).default([]),
  hintLevelByPuzzle: z.record(z.number().int().min(0).max(4)).default({}),
  endingIds: z.array(id).default([]),
})

export function emptySnapshot(manifest) {
  const first = [...manifest.checkpoints].sort((a, b) => a.order - b.order)[0]
  return SnapshotSchema.parse({
    checkpointId: first.id,
    checkpointOrder: first.order,
    stateSchemaVersion: manifest.stateSchemaVersion,
  })
}

/* ── mutations (§15.2 atomic commits) ───────────────────────────────── */
export const MutationSchema = z.object({
  type: z.enum(['checkpoint', 'puzzle_completed', 'choice_committed', 'discovery', 'ending', 'state_patch']),
  checkpointId: checkpointId.optional(),
  puzzleId: id.optional(),
  choiceId: id.optional(),
  choiceOption: z.string().optional(),
  endingId: id.optional(),
  set: z.record(stateValue).default({}),
  visit: z.array(z.string()).max(20).default([]),
  grantItems: z.array(z.object({ itemId: id, quantity: z.number().int().min(1).max(99).default(1) })).default([]),
  unlockAchievements: z.array(id).default([]),
  hintLevel: z.object({ puzzleId: id, level: z.number().int().min(0).max(4) }).optional(),
})

/* ── bridge envelope (§14.3) ────────────────────────────────────────── */
export const EnvelopeSchema = z.object({
  protocol: z.enum(['1.0']),
  type: z.string().min(1).max(64),
  messageId: z.string().uuid(),
  sessionId: z.string().min(8).max(64),
  storyId: z.string().uuid(),
  releaseId: z.string().min(8).max(64),
  sequence: z.number().int().nonnegative(),
  sentAt: z.string(),
  payload: z.unknown(),
})

export const HelloSchema = z.object({
  type: z.literal('STORYFRAME_HELLO'),
  protocol: z.enum(['1.0']),
  storyId: z.string().uuid(),
  releaseId: z.string().min(8).max(64),
  nonce: z.string().min(16).max(128),
  sdkVersion: z.string().max(32).optional(),
})

export const MESSAGE_TYPES = /** @type {const} */ ({
  READY: 'READY',
  BOOTSTRAP: 'BOOTSTRAP',
  PROGRESS_COMMIT: 'PROGRESS_COMMIT',
  PROGRESS_ACK: 'PROGRESS_ACK',
  ACHIEVEMENT_UNLOCK: 'ACHIEVEMENT_UNLOCK',
  UI_REQUEST: 'UI_REQUEST',
  PREFERENCES_CHANGED: 'PREFERENCES_CHANGED',
  LIFECYCLE: 'LIFECYCLE',
  ERROR: 'ERROR',
})

export const ProgressCommitPayload = z.object({
  operationId: z.string().uuid(),
  baseRevision: z.number().int().nonnegative(),
  mutation: MutationSchema,
})
export const UiRequestPayload = z.object({
  request: z.enum(['fullscreen', 'exit', 'toast', 'report_issue', 'share']),
  text: z.string().max(300).optional(),
})

/* ── helpers ────────────────────────────────────────────────────────── */
export const byteLength = (value) => new TextEncoder().encode(JSON.stringify(value)).length

export function validateEnvelope(raw, { expect }) {
  const parsed = EnvelopeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, code: 'schema', detail: parsed.error.issues[0]?.message }
  const env = parsed.data
  if (byteLength(env) > MAX_MESSAGE_BYTES) return { ok: false, code: 'oversized' }
  if (expect.storyId && env.storyId !== expect.storyId) return { ok: false, code: 'story_mismatch' }
  if (expect.releaseId && env.releaseId !== expect.releaseId) return { ok: false, code: 'release_mismatch' }
  if (expect.sessionId && env.sessionId !== expect.sessionId) return { ok: false, code: 'session_mismatch' }
  return { ok: true, envelope: env }
}
