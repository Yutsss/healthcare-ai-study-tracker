import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync('/app/.env','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, sec=process.env.SUPABASE_SECRET_KEY;
const admin=createClient(url,sec,{auth:{persistSession:false}});
const anon=createClient(url,pub);

// 1) single-owner DB trigger: creating a 2nd user must fail
const r = await admin.auth.admin.createUser({ email:'intruder@example.com', password:'Password123!', email_confirm:true });
console.log('2nd-user create blocked by DB trigger:', r.error ? 'YES -> '+r.error.message : 'NO!! (created '+r.data?.user?.id+')');
if (!r.error && r.data?.user?.id) { await admin.auth.admin.deleteUser(r.data.user.id); console.log('  (cleaned up the accidental user)'); }

// 2) anonymous signUp must be refused (public signup disabled at DB level)
const su = await anon.auth.signUp({ email:'anon-signup@example.com', password:'Password123!' });
console.log('anon signUp blocked:', su.error ? 'YES -> '+su.error.message : (su.data?.user? 'NO!! user='+su.data.user.id : 'no user returned (ok-ish)'));
if (su.data?.user?.id && !su.error) { await admin.auth.admin.deleteUser(su.data.user.id); console.log('  (cleaned up)'); }

// 3) anon cannot read any app table
for (const t of ['modules','study_logs','xp_events','milestone_roadmap_items','owner_settings','schema_migrations']) {
  const { data, error } = await anon.from(t).select('*').limit(1);
  console.log(`anon read ${t}:`, error ? 'DENIED ('+error.code+')' : `${(data||[]).length} rows`);
}

// 4) user count sanity
const { data: users } = await admin.auth.admin.listUsers();
console.log('total auth users:', users.users.length);
