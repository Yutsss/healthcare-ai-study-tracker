#!/usr/bin/env node
// Applies /app/supabase/migrations/*.sql (except 000_bootstrap) through the
// service_role-only `exec_sql` RPC created by 000_bootstrap_exec_sql.sql.
// Usage:  node scripts/apply-migrations.mjs            (from /app)
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// minimal .env loader (no extra deps)
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in /app/.env');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: applied, error: readErr } = await admin.from('schema_migrations').select('name');
if (readErr) {
  console.error('Cannot read schema_migrations. Did you run 000_bootstrap_exec_sql.sql in the SQL Editor?', readErr.message);
  process.exit(1);
}
const done = new Set((applied || []).map((r) => r.name));

const files = readdirSync(resolve(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql') && !f.startsWith('000_'))
  .sort();

for (const file of files) {
  if (done.has(file)) { console.log(`skip  ${file} (already applied)`); continue; }
  const sql = readFileSync(resolve(root, 'supabase/migrations', file), 'utf8');
  process.stdout.write(`apply ${file} ... `);
  const { error } = await admin.rpc('exec_sql', { sql });
  if (error) { console.log('FAILED'); console.error(error.message); process.exit(1); }
  const { error: insErr } = await admin.from('schema_migrations').insert({ name: file });
  if (insErr) { console.log('applied but could not record:', insErr.message); process.exit(1); }
  console.log('ok');
}
console.log('All migrations applied.');
