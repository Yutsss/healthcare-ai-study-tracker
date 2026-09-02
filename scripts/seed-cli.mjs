// Sign in as owner and call the seed API (preview + import) with a bearer token.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/app/.env','utf8').split('\n')) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
const [email, password, mode='preview'] = process.argv.slice(2);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession:false } });
const { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error) { console.error('sign-in failed:', error.message); process.exit(1); }
const token = data.session.access_token;
const base = 'http://localhost:3000';
const opts = mode === 'import' ? { method:'POST', body:'{}' } : {};
const res = await fetch(`${base}/api/seed/${mode}`, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' } });
console.log(mode, res.status, JSON.stringify(await res.json(), null, 1).slice(0, 1500));
const st = await fetch(`${base}/api/seed/status`, { headers: { Authorization: `Bearer ${token}` } });
console.log('status', st.status, JSON.stringify(await st.json()));
