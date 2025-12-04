import fs from 'fs'
import path from 'path'
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length)
  const headers = splitCSV(lines.shift() || '')
  const rows = lines.map(l => splitCSV(l))
  return rows.map(cols => Object.fromEntries(headers.map((h, i) => [h.replace(/^"|"$/g, ''), (cols[i] || '').replace(/^"|"$/g, '')])))
}

function splitCSV(line: string) {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

async function main() {
  const url = process.env.SUPABASE_URL as string
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')

  const supabase = createClient(url, key)

  const filePath = path.join(process.cwd(), 'users.csv')
  const text = fs.readFileSync(filePath, 'utf8')
  const objs = parseCSV(text)

  const rows = objs.map(obj => {
    const login = String(obj['user_login'] || '').trim()
    const email = String(obj['user_email'] || '').trim()
    const pass = String(obj['user_pass'] || '').trim()
    const nicename = String(obj['display_name'] || obj['user_nicename'] || '').trim()
    const created = String(obj['user_registered'] || '').trim()
    const ht = pass.startsWith('$P$') ? 'phpass' : (pass.includes('$2y$') || pass.startsWith('$wp$2y$')) ? 'bcrypt' : ''
    return { username: login, email, password_hash: pass, hash_type: ht, display_name: nicename || null, created_at: created ? new Date(created).toISOString() : null }
  }).filter(r => r.username && r.email && r.password_hash)

  console.log(`Preparing to import ${rows.length} rows`)

  const { error: tErr } = await supabase.rpc('ensure_legacy_table')
  if (tErr) {
    await supabase.from('legacy_users').select('id').limit(1)
  }

  const { error } = await supabase.from('legacy_users').insert(rows)
  if (error) throw error
  console.log(`Inserted ${rows.length} legacy rows`)

  const mapRows = rows.map(r => ({ username: r.username, email: r.email }))
  const { error: mErr } = await supabase.from('usernames').upsert(mapRows, { onConflict: 'username' }) as any
  if (mErr) throw mErr
  console.log(`Upserted ${mapRows.length} username mappings`)
}

main().catch(err => {
  console.error('Import failed:', err)
  process.exit(1)
})

