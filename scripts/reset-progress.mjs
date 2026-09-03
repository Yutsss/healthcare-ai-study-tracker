// Wipes progress/XP/activity/reports/logs/earned achievements for the owner (curriculum stays). Use with care.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/app/.env','utf8').split('\n')) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession:false } });
for (const t of ['earned_achievements','module_progress','exercise_reports','study_logs','xp_events','activity_events']) {
  const { error, count } = await admin.from(t).delete({ count: 'exact' }).not('id','is',null);
  console.log(t, error ? 'ERR '+error.message : `deleted ${count}`);
}
await admin.from('milestones').update({ achieved_at: null }).not('id','is',null);
