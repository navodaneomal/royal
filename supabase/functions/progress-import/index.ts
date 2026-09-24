/* progress-import — guest → account upgrade, and "keep this device" after a
 * cross-device conflict. Mirrors progress-commit's trust model: the reader's
 * JWT identifies them, the service role writes, and the SAME shared reducer
 * decides (planImport, unknownSnapshotIds, migrateSnapshot).
 *
 * Body: { storyId, releaseId, snapshot, mode: 'upgrade' | 'replace' }
 * Never overwrites: the losing snapshot is archived as its own timeline.
 * STATUS: code-complete, not deployed in this repository's verification (📦).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { planImport, unknownSnapshotIds, migrateSnapshot } from '../_shared/protocol/reducer.js'
import { SnapshotSchema } from '../_shared/protocol/schemas.js'
import { loadReleaseManifest, ensureStoryRow } from '../_shared/manifest.ts'

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('authorization') ?? '' } },
    })
    const { data: u, error: authErr } = await userClient.auth.getUser()
    if (authErr || !u?.user) return json(401, { error: 'unauthenticated' })
    const userId = u.user.id

    const raw = await req.text()
    if (raw.length > 300 * 1024) return json(413, { error: 'oversized' })
    const body = JSON.parse(raw)
    const mode = body.mode === 'replace' ? 'replace' : 'upgrade'

    const { manifest, story } = await loadReleaseManifest(body.storyId, body.releaseId ?? null)
    let snap = SnapshotSchema.parse(body.snapshot)
    if (snap.stateSchemaVersion !== manifest.stateSchemaVersion) {
      const m = migrateSnapshot(snap, manifest)
      if (!m.ok) return json(422, { error: m.code, detail: m.detail })
      snap = m.snapshot
    }
    const unknown = unknownSnapshotIds(snap, manifest)
    if (unknown.length) return json(422, { error: 'unknown_ids', detail: unknown.slice(0, 10) })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await ensureStoryRow(admin, story)

    const { data: tl } = await admin.from('reader_timelines').select('id')
      .eq('user_id', userId).eq('story_id', body.storyId).eq('is_primary', true).is('archived_at', null).maybeSingle()
    const { data: current } = tl
      ? await admin.from('reader_progress').select('revision, snapshot').eq('timeline_id', tl.id).maybeSingle()
      : { data: null }

    const plan = planImport(current?.snapshot ?? null, snap, mode)
    if (plan.action === 'unchanged') return json(200, { action: 'unchanged', timelineId: tl.id, revision: current!.revision, snapshot: current!.snapshot })

    const { data: rpc, error } = await admin.rpc('sf_import_progress', {
      p_user: userId, p_story: body.storyId,
      p_snapshot: plan.snapshot, p_archive: plan.archive,
      p_archive_name: mode === 'replace' ? 'Replaced by another device' : 'Imported from a guest device',
      p_checkpoint: plan.snapshot.checkpointId, p_checkpoint_order: plan.snapshot.checkpointOrder,
      p_schema_version: plan.snapshot.stateSchemaVersion,
      p_items: Object.keys(plan.snapshot.inventory ?? {}), p_achievements: plan.snapshot.achievements ?? [],
      p_completed: (plan.snapshot.endingIds ?? []).length > 0,
    })
    if (error) return json(500, { error: 'import_failed', detail: error.message })
    return json(200, { action: plan.action, timelineId: rpc.timeline_id, revision: rpc.revision, snapshot: plan.snapshot })
  } catch (e) {
    const code = (e as any)?.code
    return json(code === 'unknown_story' || code === 'release_not_approved' ? 409 : 500, { error: code ?? 'internal', detail: String((e as Error).message) })
  }
})
