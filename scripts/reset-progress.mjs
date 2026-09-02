// Wipes progress/XP/activity for the owner (curriculum stays). Use with care.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/app/.env','utf8').split('\n')) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession:false } });
for (const t of ['module_progress','xp_events','activity_events','exercise_reports','study_logs']) {
  const { error, count } = await admin.from(t).delete({ count: 'exact' }).not('id','is',null);
  console.log(t, error ? 'ERR '+error.message : `deleted ${count}`);
}
