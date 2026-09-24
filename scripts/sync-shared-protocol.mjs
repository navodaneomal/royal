#!/usr/bin/env node
/* The Supabase edge function imports the protocol from
   supabase/functions/_shared/protocol/ (Deno cannot resolve npm workspaces).
   This copies packages/protocol/src there verbatim; tests/protocol/shared-copy
   fails if anyone edits one without the other. */
import { cpSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
const from = resolve('packages/protocol/src')
const to = resolve('supabase/functions/_shared/protocol')
for (const f of readdirSync(from)) cpSync(resolve(from, f), resolve(to, f))
console.log('protocol copied → supabase/functions/_shared/protocol')
