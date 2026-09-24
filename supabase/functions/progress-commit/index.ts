/* progress-commit — the trusted mutation path (§17.2, §35).
 *
 * Supabase Edge Function (Deno). The browser calls this with the user's JWT;
 * the function validates the operation against the approved release
 * manifest, then executes the §35 algorithm in one transaction via a
 * Postgres RPC. The service role key exists only here — never in the app,
 * never in a story frame.
 *
 * STATUS: code-complete, not deployed in this repository's verification (📦).
 * Deploy with `supabase functions deploy progress-commit progress-import`,
 * set STORIES_ORIGIN + APP_ORIGIN secrets, and put supabaseUrl +
 * supabaseAnonKey in the app's config.json (DEPLOY.md, optional step).
 * This repository's demo build runs the identical logic locally in
 * apps/web/src/lib/store.ts (same reducer, same rules), so behaviour is
 * exercised even without a Supabase project.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

// The reducer is the same file the app and CLI use — one contract.
import { applyMutation, buildRegistry, emptySnapshot, migrateSnapshot } from '../_shared/protocol/reducer.js'
import { ProgressCommitPayload } from '../_shared/protocol/schemas.js'
import { loadReleaseManifest, ensureStoryRow } from '../_shared/manifest.ts'

const SNAPSHOT_RETENTION = 10

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

  try {
    // 1. authenticate the reader from their JWT — anon key + user token
    const authHeader = req.headers.get('authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json(401, { error: 'unauthenticated' })
    const userId = userData.user.id

    // 2. validate request shape and size
    const raw = await req.text()
    if (raw.length > 64 * 1024) return json(413, { error: 'oversized' })
    const body = JSON.parse(raw)
    const parsed = ProgressCommitPayload.extend
      ? ProgressCommitPayload.safeParse(body)         // zod present
      : { success: true, data: body }
    if (!('success' in parsed) || !parsed.success) return json(422, { error: 'schema', detail: parsed['error']?.issues?.[0]?.message })
    const { operationId, baseRevision, mutation } = parsed.data as any
    const { timelineId, storyId, releaseId } = body

    // 3. privileged client for the transaction
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 4. idempotency: same operation returns the stored result (§15.4)
    const { data: existing } = await admin.from('progress_operations')
      .select('status, resulting_revision').eq('user_id', userId).eq('operation_id', operationId).maybeSingle()
    if (existing) return json(200, { operationId, status: existing.status, revision: existing.resulting_revision, replayed: true })

    // 5. timeline ownership + approved release manifest
    const { data: timeline } = await admin.from('reader_timelines')
      .select('id, user_id, story_id').eq('id', timelineId).maybeSingle()
    if (!timeline || timeline.user_id !== userId || timeline.story_id !== storyId)
      return json(403, { error: 'timeline_forbidden' })

    // the release's own manifest, from the public content plane (v2 fix: v1
    // looked in story_versions, which nothing populated)
    let manifest
    try {
      const loaded = await loadReleaseManifest(storyId, releaseId ?? null)
      manifest = loaded.manifest
      await ensureStoryRow(admin, loaded.story)
    } catch (e) {
      return json(409, { error: (e as any)?.code ?? 'release_not_approved', detail: String((e as Error).message) })
    }

    // 6. current progress row (created lazily)
    const { data: progress } = await admin.from('reader_progress')
      .select('revision, snapshot').eq('timeline_id', timelineId).maybeSingle()
    const currentRevision = progress?.revision ?? 0
    let currentSnapshot = progress?.snapshot ?? emptySnapshot(manifest)

    // 6b. a reader resuming on a newer release: apply the manifest's
    //     migration map (same function the app runs locally)
    if (currentSnapshot.stateSchemaVersion !== manifest.stateSchemaVersion) {
      const migrated = migrateSnapshot(currentSnapshot, manifest)
      if (!migrated.ok) return json(409, { operationId, status: 'rejected', code: migrated.code, detail: migrated.detail })
      currentSnapshot = migrated.snapshot
    }

    // 7. conflict check before any write (§35)
    if (baseRevision !== currentRevision) {
      await admin.from('progress_operations').insert({
        operation_id: operationId, user_id: userId, timeline_id: timelineId,
        base_revision: baseRevision, resulting_revision: currentRevision,
        operation_type: mutation.type, payload: mutation, status: 'conflict',
      })
      return json(409, { operationId, status: 'conflict', revision: currentRevision })
    }

    // 8. reduce + validate — the same pure function the client ran
    const result = applyMutation(currentSnapshot, mutation, buildRegistry(manifest))
    if (!result.ok) {
      await admin.from('progress_operations').insert({
        operation_id: operationId, user_id: userId, timeline_id: timelineId,
        base_revision: baseRevision, resulting_revision: currentRevision,
        operation_type: mutation.type, payload: mutation, status: 'rejected',
      })
      return json(422, { operationId, status: 'rejected', code: result.code })
    }

    // 9. atomic write path via RPC (single Postgres transaction)
    const { data: rpc, error: rpcErr } = await admin.rpc('sf_commit_progress', {
      p_user: userId, p_timeline: timelineId, p_story: storyId,
      p_operation: operationId, p_base_revision: baseRevision,
      p_operation_type: mutation.type, p_payload: mutation,
      p_snapshot: result.snapshot,
      p_checkpoint: result.snapshot.checkpointId,
      p_checkpoint_order: result.snapshot.checkpointOrder,
      p_schema_version: result.snapshot.stateSchemaVersion,
      p_items: result.effects.items, p_achievements: result.effects.achievements,
      p_ending: result.effects.ending, p_retention: SNAPSHOT_RETENTION,
    })
    if (rpcErr) return json(500, { error: 'commit_failed', detail: rpcErr.message })

    return json(200, {
      operationId, status: 'accepted', revision: rpc.revision,
      serverTime: new Date().toISOString(), snapshotHash: rpc.snapshot_hash,
    })
  } catch (e) {
    return json(500, { error: 'internal', detail: String((e as Error).message) })
  }
})
