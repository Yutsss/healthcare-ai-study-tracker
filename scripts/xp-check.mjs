import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/app/.env','utf8').split('\n')) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
const [email, password] = process.argv.slice(2);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession:false } });
const { data: auth, error } = await sb.auth.signInWithPassword({ email, password });
if (error) throw error;
const uid = auth.user.id;
const { data: mod } = await sb.from('modules').select('id,key,title,xp_value').eq('key','module-001').single();
console.log('module:', mod.key, mod.title);
const up = await sb.from('module_progress').upsert({ owner_id: uid, module_id: mod.id, status: 'learning', started_at: new Date().toISOString() }, { onConflict: 'owner_id,module_id' }).select().single();
console.log('set learning:', up.error?.message || up.data.status);
const up2 = await sb.from('module_progress').upsert({ owner_id: uid, module_id: mod.id, status: 'done', completed_at: new Date().toISOString() }, { onConflict: 'owner_id,module_id' }).select().single();
console.log('set done:', up2.error?.message || up2.data.status);
const { data: xp } = await sb.from('xp_events').select('amount,source_type,reason');
console.log('xp_events:', xp);
const { data: act } = await sb.from('activity_events').select('event_type,payload').order('created_at');
console.log('activity:', act.map(a => a.event_type + ':' + a.payload.status));
// RLS negative test: try to insert progress for a different owner
const bad = await sb.from('module_progress').insert({ owner_id: '00000000-0000-0000-0000-000000000000', module_id: mod.id, status: 'done' });
console.log('RLS spoof insert blocked:', bad.error ? 'yes (' + bad.error.code + ')' : 'NO!');
// anon read should see nothing
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const { data: anonRows, error: anonErr } = await anon.from('modules').select('id').limit(5);
console.log('anon rows visible:', anonErr ? 'error ' + anonErr.code : anonRows.length);
