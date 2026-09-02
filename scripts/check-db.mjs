import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/app/.env','utf8').split('\n')) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession:false } });
for (const t of ['schema_migrations','roadmap_items','course_units','modules','module_progress','xp_events','owner_settings']) {
  const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true });
  console.log(t, error ? 'ERR ' + error.message : 'count=' + count);
}
const { data: sm } = await admin.from('schema_migrations').select('*'); console.log('migrations recorded:', sm);
const { data: fn, error: fe } = await admin.rpc('exec_sql', { sql: 'select 1' }); console.log('exec_sql rpc:', fe ? 'ERR '+fe.message : 'ok');
