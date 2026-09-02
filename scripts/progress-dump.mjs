import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/app/.env','utf8').split('\n')) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession:false } });
const { data } = await admin.from('module_progress').select('status,updated_at,modules(key,title)').order('updated_at', { ascending: false });
console.log(data);
const { data: xp } = await admin.from('xp_events').select('amount,reason'); console.log('xp total', xp.reduce((s,e)=>s+e.amount,0), xp.length, 'events');
