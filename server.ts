import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
// Removed legacy JWT/bcrypt auth
import pg from 'pg'
import bcryptjs from 'bcryptjs'

type ProductCode = { code: string; productType: string }
type ProductCodeRec = { id: number; code: string; productType: string; createdAt: string }
type UploadPayload = { codes: ProductCode[] }

dotenv.config()
const app = express()
app.use(express.json({ limit: '20mb' }))
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: false }))

const dataDir = path.join(process.cwd(), 'data')
const codesFile = path.join(dataDir, 'product-codes.json')
const warrantiesFile = path.join(dataDir, 'warranties.json')

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
  if (!fs.existsSync(codesFile)) fs.writeFileSync(codesFile, JSON.stringify({ codes: [] as ProductCodeRec[] }, null, 2))
  if (!fs.existsSync(warrantiesFile)) fs.writeFileSync(warrantiesFile, JSON.stringify({ warranties: [] }, null, 2))
  // users.json removed along with legacy auth
}

ensureFiles()

const dbUrl = process.env.DATABASE_URL || ''
const pool = dbUrl ? new pg.Pool({ connectionString: dbUrl, ssl: /supabase|render|neon|railway|cloud/.test(dbUrl) ? { rejectUnauthorized: false } as any : undefined }) : null

const supabaseAdmin = createClient(String(process.env.SUPABASE_URL || ''), String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''))
const supabasePublic = createClient(String(process.env.SUPABASE_URL || ''), String(process.env.VITE_SUPABASE_ANON_KEY || ''))
const useSupabase = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
console.log('useSupabase =', useSupabase)

async function getUserFromBearer(req: express.Request) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data: { user }, error } = await supabasePublic.auth.getUser(token)
  if (error || !user) return null
  return user
}

function requireRole(allowed: ('admin' | 'partner')[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = await getUserFromBearer(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    const role = ((user.user_metadata as any)?.role) || ((user.app_metadata as any)?.role)
    if (!role || !allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' })
    ;(req as any).supabaseUser = user
    next()
  }
}

async function initDb() {
  if (!pool) return
  await pool.query(`
    -- Backward-compatible rename if old table exists
    do $$ begin
      if to_regclass('public.warranties') is not null and to_regclass('public.warranty_registrations') is null then
        alter table warranties rename to warranty_registrations;
      end if;
    end $$;

    create table if not exists product_codes (
      id bigserial primary key,
      code text unique not null,
      product_type text,
      created_at timestamptz not null default now()
    );
    create table if not exists warranty_registrations (
      id bigserial primary key,
      name text,
      email text,
      phone_model text,
      mobile text,
      country text,
      product_type text,
      purchase_date date,
      expiry_date date,
      product_code text,
      status text,
      created_at timestamptz,
      claimed_at timestamptz
    );
    alter table warranty_registrations add column if not exists claimed_by text;
    do $$ begin
      if exists(select 1 from information_schema.columns where table_name='warranty_registrations' and column_name='email_alt') then
        alter table warranty_registrations drop column email_alt;
      end if;
      if exists(select 1 from information_schema.columns where table_name='warranty_registrations' and column_name='protector_type') then
        if exists(select 1 from information_schema.columns where table_name='warranty_registrations' and column_name='product_type') then
          update warranty_registrations set product_type = coalesce(product_type, protector_type);
          alter table warranty_registrations drop column protector_type;
        else
          alter table warranty_registrations rename column protector_type to product_type;
        end if;
      end if;
    end $$;
    create index if not exists idx_warranty_registrations_product_code on warranty_registrations (product_code);
    create index if not exists idx_warranty_registrations_email_lower on warranty_registrations ((lower(email)));
    create index if not exists idx_warranty_registrations_name_lower on warranty_registrations ((lower(name)));
    create index if not exists idx_warranty_registrations_mobile on warranty_registrations (mobile);
    create index if not exists idx_warranty_registrations_created_at on warranty_registrations (created_at);
  `)
}

async function readCodes(): Promise<ProductCodeRec[]> {
  if (useSupabase) {
    const { data, error } = await supabaseAdmin
      .from('product_codes')
      .select('id, code, product_type, created_at')
      .order('id', { ascending: true })
    if (error) {
      console.error('supabase readCodes error:', error.message)
      return []
    }
    return (data || []).map((r: any) => ({ id: r.id, code: r.code, productType: r.product_type, createdAt: r.created_at }))
  }
  if (!pool) {
    const raw = JSON.parse(fs.readFileSync(codesFile, 'utf8'))
    return raw.codes ?? []
  }
  const r = await pool.query('select id, code, product_type as "productType", created_at as "createdAt" from product_codes order by id asc')
  return r.rows
}

async function writeCodes(codes: ProductCodeRec[]) {
  if (useSupabase) {
    // Replace all records with provided list
    const del = await supabaseAdmin.from('product_codes').delete().neq('id', 0)
    if (del.error) { throw new Error(del.error.message) }
    if (codes.length === 0) return
    const rows = codes.map(c => ({ id: c.id, code: c.code, product_type: c.productType, created_at: c.createdAt }))
    const ins = await supabaseAdmin.from('product_codes').upsert(rows, { onConflict: 'id' })
    if (ins.error) { throw new Error(ins.error.message) }
    return
  }
  if (!pool) {
    fs.writeFileSync(codesFile, JSON.stringify({ codes }, null, 2))
    return
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('delete from product_codes')
    for (const c of codes) {
      await client.query('insert into product_codes (id, code, product_type, created_at) values ($1,$2,$3,$4) on conflict (id) do nothing', [c.id, c.code, c.productType, c.createdAt])
    }
    const seqName = 'product_codes_id_seq'
    await client.query(`select setval($1, (select coalesce(max(id),1) from product_codes))`, [seqName])
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally { client.release() }
}


function nextId(list: ProductCodeRec[]) {
  const last = list.length ? Math.max(...list.map(i => i.id)) : 0
  return last + 1
}

// Removed legacy auth middlewares; endpoints are public behind client-side Supabase gating

// Removed legacy /auth endpoints

// Removed legacy user management endpoints

// Master: import users from CSV (WordPress export compatible)
// Removed legacy users import
/* app.post('/api/users/import', requireMaster, async (req, res) => {
  const csv = String((req.body as any).csv || '')
  if (!csv) return res.status(400).json({ error: 'csv required' })
  const lines = csv.split(/\r?\n/).filter(Boolean)
  const headers = lines.shift()!.split(',').map(h => h.trim().toLowerCase())
  const map = (row: string[]) => Object.fromEntries(headers.map((h, i) => [h, row[i] || '']))
  function parseLine(line: string) {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }
  function normalizeWpPass(s: string) {
    const t = String(s || '')
    if (t.startsWith('$wp$2y$')) return t.replace('$wp$', '')
    if (t.startsWith('$2y$')) return t
    return ''
  }
  const users = await readUsers()
  let next = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1
  let imported = 0
  for (const line of lines) {
    const row = parseLine(line)
    const obj = map(row)
    const username = obj['user_login'] || obj['username'] || ''
    if (!username) continue
    if (users.find(u => u.username === username)) continue
    const role: 'owner' | 'partner' = 'partner'
    const wpHash = normalizeWpPass(obj['user_pass'] || '')
    const passHash = wpHash ? wpHash : await bcrypt.hash('changeme', 10)
    users.push({ id: next++, username, passHash, role })
    imported++
  }
  await writeUsers(users)
  res.json({ imported })
}) */

app.get('/api/product-codes/check/:code', async (req, res) => {
  const code = String(req.params.code).toUpperCase()
  const digitsOnly = code.replace(/\s+/g, '')
  const len = digitsOnly.length
  const lengthOk = len === 16 || len === 20
  let match: ProductCodeRec | undefined
  if (useSupabase) {
    const spaced = digitsOnly.replace(/(.{4})/g, '$1 ').trim()
    const hyphens = digitsOnly.replace(/(.{4})/g, '$1-').replace(/-$/, '')
    const tryCodes = [digitsOnly, spaced, hyphens]
    for (const variant of tryCodes) {
      const { data, error } = await supabaseAdmin
        .from('product_codes')
        .select('id, code, product_type, created_at')
        .eq('code', variant)
        .limit(1)
      if (error) { break }
      if (data && data.length) { match = { id: data[0].id, code: data[0].code, productType: data[0].product_type, createdAt: data[0].created_at }; break }
    }
  } else {
    const codes = await readCodes()
    match = codes.find(c => String(c.code || '').replace(/\s|-/g, '').toUpperCase() === digitsOnly)
  }
  const begins8899 = digitsOnly.startsWith('8899')
  const productType = match?.productType ?? null
  const validProductType = begins8899 ? productType === 'Dream Case' : true

  res.json({
    exists: Boolean(match),
    productType,
    length: len,
    lengthOk,
    validProductType,
    begins8899
  })
})

app.post('/api/product-codes/upload', requireRole(['admin']), async (req, res) => {
  const body = req.body as UploadPayload | { csv?: string }
  const existing = await readCodes()
  let incoming: ProductCode[] = []

  // Supabase-first path: upsert rows per request without full-table rewrite
  if (useSupabase) {
    function norm(s: string) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') }
    function parseDate(s: string) {
      const t = String(s || '').trim()
      if (!t) return new Date().toISOString()
      const isoGuess = t.includes('T') ? t : t.replace(' ', 'T')
      const d = new Date(isoGuess)
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    }
    function cleanCode(raw: string) { return String(raw || '').toUpperCase().replace(/\s+/g, '') }
    if ('csv' in body && typeof body.csv === 'string') {
      const rows = body.csv.split(/\r?\n/).filter(r => r.trim().length > 0)
      if (rows.length === 0) return res.status(400).json({ error: 'Empty CSV' })
      const header = rows.shift() as string
      const headers = header.split(',').map(h => norm(h))
      const idxId = headers.findIndex(h => h === 'id')
      const idxCode = headers.findIndex(h => h === 'productcode' || h === 'code' || h === 'product_code')
      const idxType = headers.findIndex(h => h === 'producttype' || h === 'type')
      const idxCreated = headers.findIndex(h => h === 'createdon' || h === 'createdat' || h === 'created_on' || h === 'created_at')
      const upsertRows = [] as any[]
      for (const line of rows) {
        const cols = line.split(',').map(s => s.trim())
        const rawCode = idxCode >= 0 ? cols[idxCode] : cols[0] || ''
        const code = cleanCode(rawCode)
        if (!code) continue
        const pt = idxType >= 0 ? (cols[idxType] || '') : ''
        const productType = pt || (code.startsWith('8899') ? 'Dream Case' : null)
        const createdOnRaw = idxCreated >= 0 ? (cols[idxCreated] || '') : ''
        const createdAt = parseDate(createdOnRaw)
        const rawId = idxId >= 0 ? (cols[idxId] || '') : ''
        const idNum = Number(rawId)
        const row: any = { code, product_type: productType, created_at: createdAt }
        if (Number.isFinite(idNum) && idNum > 0) row.id = idNum
        upsertRows.push(row)
      }
      if (upsertRows.length === 0) return res.json({ count: 0, added: 0 })
      const { error } = await supabaseAdmin.from('product_codes').upsert(upsertRows, { onConflict: 'code' })
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ count: upsertRows.length, added: upsertRows.length })
    } else if ('codes' in body && Array.isArray(body.codes)) {
      const upsertRows = (body.codes as any[]).map((c: any) => {
        const code = cleanCode(c.code)
        const product_type = c.productType ?? c.product_type ?? (code.startsWith('8899') ? 'Dream Case' : null)
        const created_at = String(c.createdAt || c.created_at || '').trim() || new Date().toISOString()
        const row: any = { code, product_type, created_at }
        const idNum = Number(c.id)
        if (Number.isFinite(idNum) && idNum > 0) row.id = idNum
        return row
      })
      const { error } = await supabaseAdmin.from('product_codes').upsert(upsertRows, { onConflict: 'code' })
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ count: upsertRows.length, added: upsertRows.length })
    } else {
      return res.status(400).json({ error: 'Provide {codes:[]} or {csv:"..."}' })
    }
  }
  if ('codes' in body && Array.isArray(body.codes)) {
    incoming = body.codes.map(c => ({ code: c.code.toUpperCase(), productType: c.productType }))
  } else if ('csv' in body && typeof body.csv === 'string') {
    const rows = body.csv.split(/\r?\n/).filter(r => r.trim().length > 0)
    const first = rows[0]
    const looksHeader = /[A-Za-z]/.test(first)
    if (looksHeader) {
      const headers = first.split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
      const idxCode = headers.findIndex(h => h === 'productcode' || h === 'code' || h === 'product_code')
      const idxType = headers.findIndex(h => h === 'producttype' || h === 'type')
      const idxCreated = headers.findIndex(h => h === 'createdon' || h === 'createdat' || h === 'created_on' || h === 'created_at')
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',').map(s => s.trim())
        const code = ((idxCode >= 0 ? cols[idxCode] : cols[0]) || '').toUpperCase().replace(/\s+/g, '')
        if (!code) { continue }
        const pt = idxType >= 0 ? cols[idxType] || '' : ''
        const productType = pt || (code.startsWith('8899') ? 'Dream Case' : '')
        incoming.push({ code, productType })
        const createdOnRaw = idxCreated >= 0 ? cols[idxCreated] || '' : ''
        const createdOn = createdOnRaw ? createdOnRaw.replace(' ', 'T') : ''
        if (createdOn) {
          const d = new Date(createdOn)
          existing.push({ id: nextId(existing), code, productType: productType || null, createdAt: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString() })
        } else {
          const now = new Date().toISOString()
          existing.push({ id: nextId(existing), code, productType: productType || null, createdAt: now })
        }
      }
      // Dedup by code
      const seen = new Set<string>()
      const merged: ProductCodeRec[] = []
      for (const rec of existing) { if (!seen.has(rec.code)) { seen.add(rec.code); merged.push(rec) } }
      await writeCodes(merged)
      return res.json({ count: rows.length - 1, added: merged.length })
    } else {
      for (const r of rows) {
        const parts = r.split(',').map(s => s.trim())
        const code = (parts[0] || '').toUpperCase().replace(/\s+/g, '')
        const pt = parts[1] || ''
        const productType = pt || (code.startsWith('8899') ? 'Dream Case' : '')
        const now = new Date().toISOString()
        existing.push({ id: nextId(existing), code, productType: productType || null, createdAt: now })
      }
      // Dedup
      const seen = new Set<string>()
      const merged: ProductCodeRec[] = []
      for (const rec of existing) { if (!seen.has(rec.code)) { seen.add(rec.code); merged.push(rec) } }
      await writeCodes(merged)
      return res.json({ count: rows.length, added: merged.length })
    }
  } else {
    return res.status(400).json({ error: 'Provide {codes:[]} or {csv:"code,productType"}' })
  }
  const dedupe = new Set(existing.map(e => e.code))
  const now = new Date().toISOString()
  for (const c of incoming) {
    if (dedupe.has(c.code)) continue
    existing.push({ id: nextId(existing), code: c.code, productType: c.productType ?? null, createdAt: now })
    dedupe.add(c.code)
  }
  await writeCodes(existing)
  res.json({ count: incoming.length, added: existing.length })
})

app.get('/api/product-codes', requireRole(['admin']), async (req, res) => {
  try {
    const q = String(req.query.q || '')
    const page = Number(req.query.page || 1)
    const pageSize = Number(req.query.pageSize || 20)

    let query = supabaseAdmin.from('product_codes').select('*', { count: 'exact' }).order('id', { ascending: true })

    if (q) query = query.ilike('code', `%${q}%`)

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query.range(from, to)

    if (error) throw error

    const items = (data || []).map(c => ({
      id: c.id,
      code: c.code,
      productType: c.product_type,
      createdAt: c.created_at
    }))

    res.json({ total: count || 0, page, pageSize, items })
  } catch (err: any) {
    console.error('Product codes error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Public listing endpoint to avoid auth/CORS glitches in local dev
app.get('/api/product-codes/public', async (req, res) => {
  const q = String(req.query.q || '').toUpperCase()
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  if (useSupabase) {
    const like = q ? `%${q}%` : null
    const sel = supabaseAdmin
      .from('product_codes')
      .select('id, code, product_type, created_at', { count: 'exact' })
      .order('id', { ascending: true })
    const qsel = like ? sel.ilike('code', like) : sel
    const { data, count, error } = await qsel.range((page - 1) * pageSize, (page - 1) * pageSize + pageSize - 1)
    if (error) return res.status(500).json({ error: error.message })
    const items = (data || []).map((r: any) => ({ id: r.id, code: r.code, productType: r.product_type, createdAt: r.created_at }))
    return res.json({ total: count || 0, page, pageSize, items })
  }
  const all = await readCodes()
  const filtered = q ? all.filter(c => c.code.includes(q)) : all
  const total = filtered.length
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)
  res.json({ total, page, pageSize, items })
})

app.post('/api/legacy/import', async (req, res) => {
  try {
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required' })
    const filePath = path.join(process.cwd(), 'users.csv')
    const csv = fs.readFileSync(filePath, 'utf8')
    const lines = csv.split(/\r?\n/).filter(l => l.trim().length)
    const headers = lines.shift()!.split(',').map(h => h.replace(/^"|"$/g, ''))
    function parseLine(line: string) {
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
      return out.map(s => s.replace(/^"|"$/g, ''))
    }
    const rows = lines.map(l => {
      const obj = Object.fromEntries(headers.map((h, i) => [h, parseLine(l)[i] || '']))
      const login = String(obj['user_login'] || '').trim()
      const email = String(obj['user_email'] || '').trim()
      const pass = String(obj['user_pass'] || '').trim()
      const nicename = String(obj['display_name'] || obj['user_nicename'] || '').trim()
      const created = String(obj['user_registered'] || '').trim()
      const ht = pass.startsWith('$P$') ? 'phpass' : (pass.includes('$2y$') || pass.startsWith('$wp$2y$')) ? 'bcrypt' : ''
      return { username: login, email, password_hash: pass, hash_type: ht, display_name: nicename || null, created_at: created ? new Date(created).toISOString() : null }
    }).filter(r => r.username && r.email && r.password_hash)
    if (rows.length === 0) return res.status(400).json({ error: 'No rows' })
    const { error } = await supabaseAdmin.from('legacy_users').insert(rows)
    if (error) return res.status(500).json({ error: error.message })
    const mapRows = rows.map(r => ({ username: r.username, email: r.email }))
    await supabaseAdmin.from('usernames').upsert(mapRows, { onConflict: 'username' })
    res.json({ ok: true, count: rows.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

function phpassItoa64() { return "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" }
function phpassEncode64(input: Uint8Array, count: number) {
  const itoa64 = phpassItoa64()
  let output = ''
  let i = 0
  while (i < count) {
    let value = input[i++]
    output += itoa64[value & 0x3f]
    if (i < count) value |= input[i] << 8
    output += itoa64[(value >> 6) & 0x3f]
    if (++i >= count) break
    if (i < count) value |= input[i] << 16
    output += itoa64[(value >> 12) & 0x3f]
    if (++i >= count) break
    output += itoa64[(value >> 18) & 0x3f]
  }
  return output
}
async function md5Raw(data: Uint8Array) {
  const buf = await crypto.subtle.digest('MD5', data)
  return new Uint8Array(buf)
}
async function phpassCheck(pass: string, hash: string) {
  if (!hash.startsWith('$P$')) return false
  const itoa64 = phpassItoa64()
  const countLog2 = itoa64.indexOf(hash[3])
  const count = 1 << countLog2
  const salt = hash.substring(4, 12)
  let h = await md5Raw(new TextEncoder().encode(salt + pass))
  const passBytes = new TextEncoder().encode(pass)
  for (let i = 0; i < count; i++) {
    const combined = new Uint8Array(h.length + passBytes.length)
    combined.set(h, 0)
    combined.set(passBytes, h.length)
    h = await md5Raw(combined)
  }
  const out = '$P$' + hash[3] + salt + phpassEncode64(h, 16)
  return out === hash
}

app.post('/api/legacy/login', async (req, res) => {
  try {
    const identifier = String((req.body as any)?.identifier || '').trim()
    const password = String((req.body as any)?.password || '')
    if (!identifier || !password) return res.status(400).json({ error: 'invalid' })

    let row: any = null
    {
      const { data } = await supabaseAdmin.from('legacy_users').select('username, email, password_hash, hash_type').eq('username', identifier).maybeSingle()
      row = data || null
    }
    if (!row) {
      const { data } = await supabaseAdmin.from('legacy_users').select('username, email, password_hash, hash_type').eq('email', identifier).maybeSingle()
      row = data || null
    }
    if (!row) return res.status(404).json({ error: 'not found' })

    const ht = String(row.hash_type || '')
    const hh = String(row.password_hash || '')
    let ok = false
    if (ht === 'bcrypt') {
      const h = hh.replace('$wp$2y$', '$2y$').replace('$2b$', '$2y$').replace('$2a$', '$2y$')
      ok = bcryptjs.compareSync(password, h)
    } else if (ht === 'phpass') {
      ok = await phpassCheck(password, hh)
    }
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })

    const email = String(row.email)
    const username = String(row.username)
    const { data: exists } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
    const already = (exists?.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase())
    if (!already) {
      const { error: e2 } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, role: 'partner' } })
      if (e2) return res.status(500).json({ error: e2.message })
    }
    await supabaseAdmin.from('usernames').upsert({ username, email }, { onConflict: 'username' })
    await supabaseAdmin.from('legacy_users').update({ migrated_at: new Date().toISOString() }).or(`username.eq.${username},email.eq.${email}`)
    res.json({ email })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown' })
  }
})

app.delete('/api/product-codes/:id', requireRole(['admin']), async (req, res) => {
  const id = Number(req.params.id)
  if (useSupabase) {
    const { error } = await supabaseAdmin.from('product_codes').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }
  let all = await readCodes()
  const idx = all.findIndex(c => c.id === id)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })
  all.splice(idx, 1)
  await writeCodes(all)
  res.json({ ok: true })
})

// Owner/Admin: delete all product codes
app.post('/api/product-codes/reset', requireRole(['admin']), async (_req, res) => {
  if (useSupabase) {
    const { error } = await supabaseAdmin.from('product_codes').delete().neq('id', 0)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true, cleared: 'supabase' })
  }
  if (!pool) {
    fs.writeFileSync(codesFile, JSON.stringify({ codes: [] }, null, 2))
    return res.json({ ok: true, cleared: 'file' })
  }
  await pool.query('truncate table product_codes restart identity')
  res.json({ ok: true, cleared: 'db' })
})

app.post('/api/warranty/register', async (req, res) => {
  const b = req.body as any
  const code = String(b.productCode || '').replace(/\s+/g, '')
  const len = code.length
  if (!(len === 16 || len === 20)) return res.status(400).json({ error: 'Invalid product code length' })
  const purchaseDate = b.purchaseDate
  const expiryDate = b.expiryDate || (() => {
    const d = new Date(purchaseDate)
    d.setDate(d.getDate() + 180)
    return d.toISOString().slice(0, 10)
  })()
  const record = {
    name: b.name,
    email: b.email,
    phoneModel: b.phoneModel || '',
    mobile: b.mobile || '',
    country: b.country || '',
    protectorType: b.protectorType || '',
    purchaseDate,
    expiryDate,
    productCode: code,
    status: (b.status || 'Not claimed'),
    createdAt: new Date().toISOString()
  }
  if (!pool && !useSupabase) {
    const warranties = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8'))
    const list = warranties.warranties as any[]
    const next = list.length ? Math.max(...list.map(w => Number(w.id) || 0)) + 1 : 1
    const toSave = { id: next, ...record }
    warranties.warranties.push(toSave)
    fs.writeFileSync(warrantiesFile, JSON.stringify(warranties, null, 2))
  } else if (useSupabase) {
    const { error } = await supabaseAdmin.from('warranty_registrations').insert({
      name: record.name,
      email: record.email,
      phone_model: record.phoneModel,
      mobile: record.mobile,
      country: record.country,
      product_type: b.productType || b.protectorType || '',
      purchase_date: record.purchaseDate,
      expiry_date: record.expiryDate,
      product_code: record.productCode,
      status: record.status,
      created_at: record.createdAt,
    }).single()
    if (error) return res.status(500).json({ error: error.message })
  } else {
    const r = await pool!.query(
      'insert into warranty_registrations (name, email, phone_model, mobile, country, product_type, purchase_date, expiry_date, product_code, status, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id',
      [record.name, record.email, record.phoneModel, record.mobile, record.country, b.protectorType || b.productType || '', record.purchaseDate, record.expiryDate, record.productCode, record.status, record.createdAt]
    )
    const newId = r.rows[0]?.id
    if (!newId) return res.status(500).json({ error: 'Insert failed' })
  }
  res.json({ ok: true })
})

app.get('/api/warranty', requireRole(['admin']), async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const q = String(req.query.q || '').toUpperCase()
  if (!pool && !useSupabase) {
    const all = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8')).warranties as any[]
    const filtered = q ? all.filter(w => String(w.productCode).includes(q)) : all
    const total = filtered.length
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)
    return res.json({ total, page, pageSize, items })
  }
  if (useSupabase) {
    const like = q ? `%${q}%` : null
    let b = supabaseAdmin.from('warranty_registrations').select('*', { count: 'exact' }).order('id', { ascending: true })
    if (like) b = b.ilike('product_code', like)
    const { data, count, error } = await b.range((page - 1) * pageSize, (page - 1) * pageSize + pageSize - 1)
    if (error) return res.status(500).json({ error: error.message })
    const items = (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phoneModel: r.phone_model,
      mobile: r.mobile,
      country: r.country,
      productType: r.product_type,
      purchaseDate: r.purchase_date,
      expiryDate: r.expiry_date,
      productCode: r.product_code,
      status: r.status,
      createdAt: r.created_at,
      claimedAt: r.claimed_at,
      claimedBy: r.claimed_by,
    }))
    return res.json({ total: count || items.length, page, pageSize, items })
  }
  const where = q ? 'where upper(product_code) like $1' : ''
  const params = q ? [`%${q}%`] : []
  const totalRes = await pool!.query(`select count(*)::int as cnt from warranty_registrations ${where}`, params)
  const total = totalRes.rows[0].cnt
  const itemsRes = await pool!.query(
    `select id, name, email, phone_model as "phoneModel", mobile, country, product_type as "productType",
            to_char(purchase_date, 'YYYY-MM-DD') as "purchaseDate",
            to_char(expiry_date, 'YYYY-MM-DD') as "expiryDate",
            product_code as "productCode",
            status,
            to_char(created_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "createdAt",
            to_char(claimed_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "claimedAt",
            claimed_by as "claimedBy"
     from warranty_registrations ${where}
     order by id asc offset $${params.length+1} limit $${params.length+2}`,
    [...params, (page - 1) * pageSize, pageSize]
  )
  res.json({ total, page, pageSize, items: itemsRes.rows })
})

// Public listing for warranties in local/dev
app.get('/api/warranty/public', async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const q = String(req.query.q || '').toUpperCase()
  if (!pool) {
    const all = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8')).warranties as any[]
    const filtered = q ? all.filter(w => String(w.productCode).includes(q)) : all
    const total = filtered.length
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)
    return res.json({ total, page, pageSize, items })
  }
  const where = q ? 'where upper(product_code) like $1' : ''
  const params = q ? [`%${q}%`] : []
  const totalRes = await pool.query(`select count(*)::int as cnt from warranty_registrations ${where}`, params)
  const total = totalRes.rows[0].cnt
  const itemsRes = await pool.query(
    `select id, name, email, phone_model as "phoneModel", mobile, country, product_type as "productType",
            to_char(purchase_date, 'YYYY-MM-DD') as "purchaseDate",
            to_char(expiry_date, 'YYYY-MM-DD') as "expiryDate",
            product_code as "productCode",
            status,
            to_char(created_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "createdAt",
            to_char(claimed_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "claimedAt",
            claimed_by as "claimedBy"
     from warranty_registrations ${where} order by id asc offset $${params.length+1} limit $${params.length+2}`,
    [...params, (page - 1) * pageSize, pageSize]
  )
  res.json({ total, page, pageSize, items: itemsRes.rows })
})

app.post('/api/warranty/import', requireRole(['admin']), async (req, res) => {
  const csv = String((req.body as any).csv || '')
  if (!csv) return res.status(400).json({ error: 'csv required' })
  const lines = csv.split(/\r?\n/).filter(Boolean)
  const headers = lines.shift()!.split(',').map(h => h.trim().toLowerCase())
  function normalizeDate(s: string) {
    const t = String(s || '').trim()
    if (!t) return ''
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
      const [y, m, d] = t.split('-')
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
    const m = t.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/)
    if (m) {
      const y = m[1]
      const mm = m[2].padStart(2, '0')
      const dd = m[3].padStart(2, '0')
      return `${y}-${mm}-${dd}`
    }
    const m2 = t.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/)
    if (m2) {
      const a = Number(m2[1])
      const b = Number(m2[2])
      const y = m2[3]
      const mm = (a > 12 ? b : a).toString().padStart(2,'0')
      const dd = (a > 12 ? a : b).toString().padStart(2,'0')
      return `${y}-${mm}-${dd}`
    }
    return ''
  }
  function normalizeDateTime(s: string) {
    const t = String(s || '').trim()
    if (!t) return ''
    const m = t.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*(\d{1,2})?:?(\d{2})?:?(\d{2})?/)
    if (m) {
      const y = m[1]
      const mm = m[2].padStart(2, '0')
      const dd = m[3].padStart(2, '0')
      const hh = (m[4] || '00').padStart(2, '0')
      const mi = (m[5] || '00').padStart(2, '0')
      const ss = (m[6] || '00').padStart(2, '0')
      return `${y}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`
    }
    const m2 = t.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})\D*(\d{1,2})?:?(\d{2})?:?(\d{2})?/)
    if (m2) {
      const a = Number(m2[1])
      const b = Number(m2[2])
      const y = m2[3]
      const hh = (m2[4] || '00').padStart(2, '0')
      const mi = (m2[5] || '00').padStart(2, '0')
      const ss = (m2[6] || '00').padStart(2, '0')
      const mm = (a > 12 ? b : a).toString().padStart(2,'0')
      const dd = (a > 12 ? a : b).toString().padStart(2,'0')
      return `${y}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`
    }
    return ''
  }
  function parseLine(line: string) {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }
  const map = (row: string[]) => Object.fromEntries(headers.map((h, i) => [h, row[i] || '']))
  if (!pool) {
    const existing = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8'))
    for (const line of lines) {
      const row = parseLine(line)
      const obj = map(row)
      const purchaseDate = normalizeDate(obj['purchase date'] || '')
      const expiryDateRaw = normalizeDate(obj['expiry date'] || '')
      const expiryDate = expiryDateRaw || (purchaseDate ? (() => { const parts = purchaseDate.split('-'); const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); d.setDate(d.getDate() + 180); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` })() : '')
      const rec = {
        id: (() => { const v = (obj['id'] || obj['ID'] || '').trim(); const n = Number(v); return Number.isFinite(n) && n > 0 ? n : Date.now() })(),
        name: obj['name'] || '',
        email: obj['email'] || '',
        phoneModel: obj['phone model'] || obj['phone_model'] || obj['phonemodel'] || '',
        mobile: obj['mobile'] || '',
        country: obj['country'] || '',
        protectorType: obj['protector'] || obj['protector type'] || obj['product_type'] || '',
        purchaseDate,
        expiryDate,
        productCode: (obj['product code'] || '').replace(/\s+/g, ''),
        status: (() => { const s = (obj['status'] || '').trim().toLowerCase(); if (!s || s === 'null') return 'Not claimed'; if (s === '1') return 'Claimed'; if (s === '0') return 'Not claimed'; return /claim/.test(s) ? 'Claimed' : (obj['status'] || '') })(),
        createdAt: (() => { const c = obj['date of registration'] || obj['created_on'] || obj['created at'] || obj['timestamp'] || ''; const dt = normalizeDateTime(c); if (dt) return dt; const dOnly = normalizeDate(c); return dOnly ? `${dOnly}T00:00:00+08:00` : '' })(),
        claimedAt: (() => { const c = obj['claimed_on'] || obj['claim date'] || obj['claimed date'] || ''; const dt = normalizeDateTime(c); if (dt) return dt; const dOnly = normalizeDate(c); return dOnly ? `${dOnly}T00:00:00+08:00` : '' })(),
        claimedBy: (obj['claimed_by'] || obj['claimed by'] || '').trim()
      }
      existing.warranties.push(rec)
    }
    fs.writeFileSync(warrantiesFile, JSON.stringify(existing, null, 2))
    return res.json({ imported: lines.length })
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query("set local time zone 'Asia/Singapore'")
    for (const line of lines) {
      const row = parseLine(line)
      const obj = map(row)
      function first(obj: Record<string, string>, names: string[]) {
        for (const n of names) {
          const v = obj[n]
          if (typeof v === 'string' && v.trim().length) return v.trim()
        }
        return ''
      }
      const purchaseDate = normalizeDate(first(obj, ['purchase date','purchase_date','date of purchase','date_of_purchase']))
      const expiryDateRaw = normalizeDate(first(obj, ['expiry date','expiry_date']))
      const expiryDate = expiryDateRaw || (purchaseDate ? (() => { const parts = purchaseDate.split('-'); const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); d.setDate(d.getDate() + 180); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` })() : '')
      const rec = {
        id: (() => { const v = (obj['id'] || obj['ID'] || '').trim(); const n = Number(v); return Number.isFinite(n) && n > 0 ? n : Date.now() })(),
        name: first(obj, ['name','customer name','customer_name']),
        email: first(obj, ['email','email address','email_address']),
        phoneModel: first(obj, ['phone model','phone_model','phonemodel','model','phone']),
        mobile: first(obj, ['mobile','contact','phone number','phone_number']),
        country: first(obj, ['country','country/region','country_region']),
        productType: first(obj, ['protector','protector type','product type','product_type']),
        purchaseDate,
        expiryDate,
        productCode: first(obj, ['product code','product_code','code']).replace(/\s+/g, ''),
        status: (() => { const s = first(obj, ['status']); const t = s.trim().toLowerCase(); if (!t || t === 'null') return 'Not claimed'; if (t === '1') return 'Claimed'; if (t === '0') return 'Not claimed'; return /claim/.test(t) ? 'Claimed' : s })(),
        createdAt: (() => { const c = first(obj, ['date of registration','date_of_registration','created on','created_on','created at','created_at','timestamp']); const n = normalizeDateTime(c); if (n) return n; const d = normalizeDate(c); return d ? `${d}T00:00:00+08:00` : '' })(),
        claimedAt: (() => { const c = first(obj, ['claimed_on','claim date','claimed date','date of claim','claimed_at','claim_at']); const n = normalizeDateTime(c); if (n) return n; const d = normalizeDate(c); return d ? `${d}T00:00:00+08:00` : '' })(),
        claimedBy: first(obj, ['claimed_by','claimed by'])
      }
      await client.query(
        `insert into warranty_registrations (id, name, email, phone_model, mobile, country, product_type, purchase_date, expiry_date, product_code, status, created_at, claimed_at, claimed_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        NULLIF($12,'')::timestamptz,
        NULLIF($13,'')::timestamptz,
        $14) on conflict (id) do nothing`,
        [rec.id, rec.name, rec.email, rec.phoneModel, rec.mobile, rec.country, rec.productType, rec.purchaseDate || null, rec.expiryDate || null, rec.productCode, rec.status, rec.createdAt || '', rec.claimedAt || '', rec.claimedBy || null]
      )
    }
    await client.query(`select setval(pg_get_serial_sequence('warranty_registrations','id'), (select coalesce(max(id),1) from warranty_registrations))`)
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally { client.release() }
  res.json({ imported: lines.length })
})

// Master: import and update existing warranties by id
app.post('/api/warranty/import/update', requireRole(['admin']), async (req, res) => {
  const csv = String((req.body as any).csv || '')
  if (!csv) return res.status(400).json({ error: 'csv required' })
  const lines = csv.split(/\r?\n/).filter(Boolean)
  const headers = lines.shift()!.split(',').map(h => h.trim().toLowerCase())
  function normalizeDate(s: string) {
    const t = String(s || '').trim()
    if (!t) return ''
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
      const [y, m, d] = t.split('-')
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
    const m = t.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/)
    if (m) {
      const y = m[1]
      const mm = m[2].padStart(2, '0')
      const dd = m[3].padStart(2, '0')
      return `${y}-${mm}-${dd}`
    }
    const m2 = t.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/)
    if (m2) {
      const a = Number(m2[1])
      const b = Number(m2[2])
      const y = m2[3]
      const mm = (a > 12 ? b : a).toString().padStart(2,'0')
      const dd = (a > 12 ? a : b).toString().padStart(2,'0')
      return `${y}-${mm}-${dd}`
    }
    return ''
  }
  function normalizeDateTime(s: string) {
    const t = String(s || '').trim()
    if (!t) return ''
    const m = t.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*(\d{1,2})?:?(\d{2})?:?(\d{2})?/)
    if (m) {
      const y = m[1]
      const mm = m[2].padStart(2, '0')
      const dd = m[3].padStart(2, '0')
      const hh = (m[4] || '00').padStart(2, '0')
      const mi = (m[5] || '00').padStart(2, '0')
      const ss = (m[6] || '00').padStart(2, '0')
      return `${y}-${mm}-${dd}T${hh}:${mi}:${ss}`
    }
    const m2 = t.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})\D*(\d{1,2})?:?(\d{2})?:?(\d{2})?/)
    if (m2) {
      const a = Number(m2[1])
      const b = Number(m2[2])
      const y = m2[3]
      const hh = (m2[4] || '00').padStart(2, '0')
      const mi = (m2[5] || '00').padStart(2, '0')
      const ss = (m2[6] || '00').padStart(2, '0')
      const mm = (a > 12 ? b : a).toString().padStart(2,'0')
      const dd = (a > 12 ? a : b).toString().padStart(2,'0')
      return `${y}-${mm}-${dd}T${hh}:${mi}:${ss}`
    }
    return ''
  }
  function parseLine(line: string) {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }
  const map = (row: string[]) => Object.fromEntries(headers.map((h, i) => [h, row[i] || '']))
  function first(obj: Record<string, string>, names: string[]) {
    for (const n of names) {
      const v = obj[n]
      if (typeof v === 'string' && v.trim().length) return v.trim()
    }
    return ''
  }
  if (!pool) {
    const existing = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8'))
    let updated = 0
    for (const line of lines) {
      const obj = map(parseLine(line))
      const idStr = (obj['id'] || obj['ID'] || '').trim()
      const id = Number(idStr)
      const idx = existing.warranties.findIndex((w: any) => Number(w.id) === id)
      if (idx < 0) continue
      const purchaseDate = normalizeDate(first(obj, ['purchase date','purchase_date','date of purchase','date_of_purchase']))
      const expiryDateRaw = normalizeDate(first(obj, ['expiry date','expiry_date']))
      const expiryDate = expiryDateRaw || (purchaseDate ? (() => { const parts = purchaseDate.split('-'); const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); d.setDate(d.getDate() + 180); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` })() : '')
      existing.warranties[idx] = {
        ...existing.warranties[idx],
        name: first(obj, ['name','customer name','customer_name']) || existing.warranties[idx].name,
        email: first(obj, ['email','email address','email_address']) || existing.warranties[idx].email,
        phoneModel: first(obj, ['phone model','phone_model','phonemodel','model','phone']) || existing.warranties[idx].phoneModel,
        mobile: first(obj, ['mobile','contact','phone number','phone_number']) || existing.warranties[idx].mobile,
        country: first(obj, ['country','country/region','country_region']) || existing.warranties[idx].country,
        productType: first(obj, ['protector','protector type','product type','product_type']) || existing.warranties[idx].productType,
        purchaseDate: purchaseDate || existing.warranties[idx].purchaseDate,
        expiryDate: expiryDate || existing.warranties[idx].expiryDate,
        productCode: (first(obj, ['product code','product_code','code']) || existing.warranties[idx].productCode || '').replace(/\s+/g, ''),
        status: (() => { const s = first(obj, ['status']); const t = s.trim().toLowerCase(); if (!t || t === 'null') return 'Not claimed'; if (t === '1') return 'Claimed'; if (t === '0') return 'Not claimed'; return /claim/.test(t) ? 'Claimed' : s })(),
        createdAt: (() => { const c = first(obj, ['date of registration','date_of_registration','created on','created_on','created at','created_at','timestamp']); const d = new Date(c); return isNaN(d.getTime()) ? existing.warranties[idx].createdAt : d.toISOString() })(),
        claimedAt: (() => { const c = first(obj, ['claimed_on','claim date','claimed date','date of claim','claimed_at','claim_at']); const d = new Date(c); return isNaN(d.getTime()) ? existing.warranties[idx].claimedAt : d.toISOString() })(),
        claimedBy: first(obj, ['claimed_by','claimed by']) || existing.warranties[idx].claimedBy
      }
      updated++
    }
    fs.writeFileSync(warrantiesFile, JSON.stringify(existing, null, 2))
    return res.json({ updated })
  }
  const client = await pool.connect()
  let updated = 0
  try {
    await client.query('begin')
    await client.query("set local time zone 'Asia/Singapore'")
    for (const line of lines) {
      const obj = map(parseLine(line))
      const idStr = (obj['id'] || obj['ID'] || '').trim()
      const id = Number(idStr)
      if (!Number.isFinite(id) || id <= 0) continue
      const purchaseDate = normalizeDate(first(obj, ['purchase date','purchase_date','date of purchase','date_of_purchase']))
      const expiryDateRaw = normalizeDate(first(obj, ['expiry date','expiry_date']))
      const expiryDate = expiryDateRaw || (purchaseDate ? (() => { const parts = purchaseDate.split('-'); const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); d.setDate(d.getDate() + 180); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` })() : '')
      const name = first(obj, ['name','customer name','customer_name'])
      const email = first(obj, ['email','email address','email_address'])
      const phoneModel = first(obj, ['phone model','phone_model','phonemodel','model','phone'])
      const mobile = first(obj, ['mobile','contact','phone number','phone_number'])
      const country = first(obj, ['country','country/region','country_region'])
      const productType = first(obj, ['protector','protector type','product type','product_type'])
      const productCode = first(obj, ['product code','product_code','code']).replace(/\s+/g, '')
      const status = (() => { const s = first(obj, ['status']); const t = s.trim().toLowerCase(); if (!t || t === 'null') return 'Not claimed'; if (t === '1') return 'Claimed'; if (t === '0') return 'Not claimed'; return /claim/.test(t) ? 'Claimed' : s })()
      const createdAtNorm = (() => { const c = first(obj, ['date of registration','date_of_registration','created on','created_on','created at','created_at','timestamp']); const n = normalizeDateTime(c); if (n) return n; const d = normalizeDate(c); return d ? `${d}T00:00:00+08:00` : null })()
      const claimedAtNorm = (() => { const c = first(obj, ['claimed_on','claim date','claimed date','date of claim','claimed_at','claim_at']); const n = normalizeDateTime(c); if (n) return n; const d = normalizeDate(c); return d ? `${d}T00:00:00+08:00` : null })()
      const claimedByNorm = first(obj, ['claimed_by','claimed by'])
      await client.query(
        `insert into warranty_registrations (id, name, email, phone_model, mobile, country, product_type, purchase_date, expiry_date, product_code, status, created_at, claimed_at, claimed_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        NULLIF($12,'')::timestamptz,
        NULLIF($13,'')::timestamptz,
        $14) on conflict (id) do update set name=coalesce(nullif(excluded.name,\'\'), warranty_registrations.name), email=coalesce(nullif(excluded.email,\'\'), warranty_registrations.email), phone_model=coalesce(nullif(excluded.phone_model,\'\'), warranty_registrations.phone_model), mobile=coalesce(nullif(excluded.mobile,\'\'), warranty_registrations.mobile), country=coalesce(nullif(excluded.country,\'\'), warranty_registrations.country), product_type=coalesce(nullif(excluded.product_type,\'\'), warranty_registrations.product_type), purchase_date=coalesce(excluded.purchase_date, warranty_registrations.purchase_date), expiry_date=coalesce(excluded.expiry_date, warranty_registrations.expiry_date), product_code=coalesce(nullif(excluded.product_code,\'\'), warranty_registrations.product_code), status=coalesce(nullif(excluded.status,\'\'), warranty_registrations.status), created_at=coalesce(excluded.created_at, warranty_registrations.created_at), claimed_at=coalesce(excluded.claimed_at, warranty_registrations.claimed_at), claimed_by=coalesce(nullif(excluded.claimed_by,\'\'), warranty_registrations.claimed_by)`,
        [id, name, email, phoneModel, mobile, country, productType, purchaseDate || null, expiryDate || null, productCode, status, createdAtNorm || null, claimedAtNorm || null, claimedByNorm || null]
      )
      updated++
    }
    await client.query(`select setval(pg_get_serial_sequence('warranty_registrations','id'), (select coalesce(max(id),1) from warranty_registrations))`)
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally { client.release() }
  res.json({ updated })
})

// Public: search warranties by email (exact, case-insensitive)
app.get('/api/warranty/by-email', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'email required' })
  if (!pool && !useSupabase) {
    const all = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8')).warranties as any[]
    const items = all.filter(w => String(w.email || '').toLowerCase() === email || String(w.emailAlt || '').toLowerCase() === email)
    return res.json({ count: items.length, items })
  }
  if (useSupabase) {
    const { data, error } = await supabaseAdmin
      .from('warranty_registrations')
      .select('*')
      .ilike('email', email)
    if (error) return res.status(500).json({ error: error.message })
    const items = (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phoneModel: r.phone_model,
      mobile: r.mobile,
      country: r.country,
      productType: r.product_type,
      purchaseDate: r.purchase_date,
      expiryDate: r.expiry_date,
      productCode: r.product_code,
      status: r.status,
      createdAt: r.created_at,
      claimedAt: r.claimed_at,
      claimedBy: r.claimed_by,
    }))
    return res.json({ count: items.length, items })
  }
  const r = await pool!.query(
    `select id, name, email, phone_model as "phoneModel", mobile, country, product_type as "productType",
            to_char(purchase_date, 'YYYY-MM-DD') as "purchaseDate",
            to_char(expiry_date, 'YYYY-MM-DD') as "expiryDate",
            product_code as "productCode",
            status,
            to_char(created_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "createdAt",
            to_char(claimed_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "claimedAt",
            claimed_by as "claimedBy"
     from warranty_registrations where lower(email)=$1`,
    [email]
  )
  const items = r.rows
  res.json({ count: items.length, items })
})

// Partner/Owner: search warranties by q (name/email/mobile)
app.get('/api/warranty/search', requireRole(['partner','admin']), async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  if (!pool && !useSupabase) {
    const all = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8')).warranties as any[]
    function rowText(w: any) {
      return [w.name, w.email, w.mobile, w.phoneModel, w.productCode, w.purchaseDate, w.expiryDate, w.createdAt]
        .map(v => String(v || '').toLowerCase()).join(' ')
    }
    const filtered = q ? all.filter(w => rowText(w).includes(q)) : all
    const total = filtered.length
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)
    return res.json({ total, page, pageSize, items })
  }
  if (useSupabase) {
    const like = `%${q}%`
    const { data, count, error } = await supabaseAdmin
      .from('warranty_registrations')
      .select('*', { count: 'exact' })
      .or(`name.ilike.${like},email.ilike.${like},mobile.ilike.${like},phone_model.ilike.${like},product_code.ilike.${like},country.ilike.${like},product_type.ilike.${like}`)
      .order('id', { ascending: true })
      .range((page - 1) * pageSize, (page - 1) * pageSize + pageSize - 1)
    if (error) return res.status(500).json({ error: error.message })
    const items = (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phoneModel: r.phone_model,
      mobile: r.mobile,
      country: r.country,
      productType: r.product_type,
      purchaseDate: r.purchase_date,
      expiryDate: r.expiry_date,
      productCode: r.product_code,
      status: r.status,
      createdAt: r.created_at,
      claimedAt: r.claimed_at,
      claimedBy: r.claimed_by,
    }))
    return res.json({ total: count || items.length, page, pageSize, items })
  }
  const like = `%${q}%`
  const totalRes = await pool!.query(`select count(*)::int as cnt from warranty_registrations where lower(name) like $1 or lower(email) like $1 or lower(mobile) like $1 or lower(phone_model) like $1 or lower(country) like $1 or lower(product_type) like $1 or product_code like $1 or to_char(purchase_date, 'YYYY-MM-DD') like $1 or to_char(expiry_date, 'YYYY-MM-DD') like $1 or to_char(created_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') like $1`, [like])
  const total = totalRes.rows[0].cnt
  const itemsRes = await pool!.query(
    `select id, name, email, phone_model as "phoneModel", mobile, country, product_type as "productType",
            to_char(purchase_date, 'YYYY-MM-DD') as "purchaseDate",
            to_char(expiry_date, 'YYYY-MM-DD') as "expiryDate",
            product_code as "productCode",
            status,
            to_char(created_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "createdAt",
            to_char(claimed_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') as "claimedAt",
            claimed_by as "claimedBy"
     from warranty_registrations
    where lower(name) like $1 or lower(email) like $1 or lower(mobile) like $1 or lower(phone_model) like $1 or lower(country) like $1 or lower(product_type) like $1 or product_code like $1 or to_char(purchase_date, 'YYYY-MM-DD') like $1 or to_char(expiry_date, 'YYYY-MM-DD') like $1 or to_char(created_at at time zone 'Asia/Singapore', 'YYYY-MM-DD, HH24:MI:SS') like $1
    order by id asc offset $2 limit $3`,
    [like, (page - 1) * pageSize, pageSize]
  )
  res.json({ total, page, pageSize, items: itemsRes.rows })
})

// Partner/Owner: claim a warranty entry
app.post('/api/warranty/:id/claim', requireRole(['partner','admin']), async (req, res) => {
  const id = Number(req.params.id)
  if (!pool && !useSupabase) {
    const existing = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8'))
    const idx = existing.warranties.findIndex((w: any) => Number(w.id) === id)
    if (idx < 0) return res.status(404).json({ error: 'Not found' })
    existing.warranties[idx].status = 'Claimed'
    existing.warranties[idx].claimedAt = new Date().toISOString()
    fs.writeFileSync(warrantiesFile, JSON.stringify(existing, null, 2))
    return res.json({ ok: true })
  }
  const u = (req as any).supabaseUser
  const user = String(u?.email || '')
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date())
  function part(type: string) { return (parts.find(p => p.type === type)?.value || '00') }
  const claimedAt = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}+08:00`
  if (useSupabase) {
    const { error } = await supabaseAdmin.from('warranty_registrations').update({ status: 'Claimed', claimed_at: claimedAt, claimed_by: user }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }
  await pool!.query('update warranty_registrations set status=$2, claimed_at=$3, claimed_by=$4 where id=$1', [id, 'Claimed', claimedAt, user])
  res.json({ ok: true })
})

// Owner/Admin: unclaim a warranty entry (clear claim details, set status Not claimed)
app.post('/api/warranty/:id/unclaim', requireRole(['admin']), async (req, res) => {
  const id = Number(req.params.id)
  if (!pool && !useSupabase) {
    const existing = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8'))
    const idx = existing.warranties.findIndex((w: any) => Number(w.id) === id)
    if (idx < 0) return res.status(404).json({ error: 'Not found' })
    existing.warranties[idx].status = 'Not claimed'
    existing.warranties[idx].claimedAt = ''
    existing.warranties[idx].claimedBy = ''
    fs.writeFileSync(warrantiesFile, JSON.stringify(existing, null, 2))
    return res.json({ ok: true })
  }
  if (useSupabase) {
    const { error } = await supabaseAdmin
      .from('warranty_registrations')
      .update({ status: 'Not claimed', claimed_at: null, claimed_by: null })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }
  await pool!.query('update warranty_registrations set status=$2, claimed_at=$3, claimed_by=$4 where id=$1', [id, 'Not claimed', null, null])
  res.json({ ok: true })
})

app.delete('/api/warranty/:id', requireRole(['admin']), async (req, res) => {
  const id = Number(req.params.id)
  if (!pool && !useSupabase) {
    const existing = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8'))
    const idx = existing.warranties.findIndex((w: any) => Number(w.id) === id)
    if (idx < 0) return res.status(404).json({ error: 'Not found' })
    existing.warranties.splice(idx, 1)
    fs.writeFileSync(warrantiesFile, JSON.stringify(existing, null, 2))
    return res.json({ ok: true })
  }
  if (useSupabase) {
    const { error } = await supabaseAdmin.from('warranty_registrations').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }
  await pool.query('delete from warranty_registrations where id=$1', [id])
  res.json({ ok: true })
})

// Owner: reset all warranties
app.post('/api/warranty/reset', requireRole(['admin']), async (_req, res) => {
  if (!pool) {
    fs.writeFileSync(warrantiesFile, JSON.stringify({ warranties: [] }, null, 2))
    return res.json({ ok: true, cleared: 'file' })
  }
  await pool.query('truncate table warranty_registrations restart identity')
  res.json({ ok: true, cleared: 'db' })
})

// Migration endpoint: move JSON files to DB preserving IDs and dates
app.post('/api/migrate/json-to-db', requireRole(['admin']), async (req, res) => {
  if (!pool) return res.status(400).json({ error: 'DATABASE_URL not configured' })
  const client = await pool.connect()
  try {
    await client.query('begin')
    // Users migration removed
    // Product codes
    const codesRaw = JSON.parse(fs.readFileSync(codesFile, 'utf8')).codes as ProductCodeRec[]
    for (const c of codesRaw) {
      await client.query('insert into product_codes (id, code, product_type, created_at) values ($1,$2,$3,$4) on conflict (id) do nothing', [c.id, c.code, c.productType, c.createdAt])
    }
    await client.query(`select setval(pg_get_serial_sequence('product_codes','id'), (select coalesce(max(id),1) from product_codes))`)
    // Warranties
    const warrantiesRaw = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8')).warranties as any[]
    for (const w of warrantiesRaw) {
      await client.query(
        'insert into warranty_registrations (id, name, email, phone_model, mobile, country, product_type, purchase_date, expiry_date, product_code, status, created_at, claimed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (id) do nothing',
        [w.id, w.name, w.email, w.phoneModel || '', w.mobile || '', w.country || '', w.protectorType || w.productType || '', w.purchaseDate || null, w.expiryDate || null, w.productCode || '', w.status || 'Not claimed', w.createdAt || new Date().toISOString(), w.claimedAt || null]
      )
    }
    await client.query(`select setval(pg_get_serial_sequence('warranty_registrations','id'), (select coalesce(max(id),1) from warranty_registrations))`)
    await client.query('commit')
    res.json({ ok: true, counts: { users: usersRaw.length, productCodes: codesRaw.length, warranties: warrantiesRaw.length } })
  } catch (e) {
    await client.query('rollback')
    console.error(e)
    res.status(500).json({ error: 'Migration failed' })
  } finally { client.release() }
})

app.post('/api/warranty/register', async (req, res) => {
  const body = req.body as any
  const cleanCode = String(body.productCode || '').toUpperCase().replace(/\s+/g, '')
  if (!cleanCode) return res.status(400).json({ error: 'Invalid product code' })
  const name = String(body.name || '')
  const email = String(body.email || '')
  const phone_model = String(body.phoneModel || '')
  const mobile = String(body.mobile || '')
  const country = String(body.country || '')
  const product_type = String(body.productType || '')
  const purchase_date = body.purchaseDate || null
  const expiry_date = body.expiryDate || null

  if (useSupabase) {
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('product_codes')
      .select('id')
      .eq('code', cleanCode)
      .maybeSingle()
    if (codeError || !codeData) return res.status(400).json({ error: 'Invalid product code' })
    const { data: existing } = await supabaseAdmin
      .from('warranty_registrations')
      .select('id')
      .eq('product_code', cleanCode)
      .maybeSingle()
    if (existing) return res.status(400).json({ error: 'Product code already registered' })
    const row = { name, email, phone_model, mobile, country, product_type, purchase_date, expiry_date, product_code: cleanCode, status: 'Active', created_at: new Date().toISOString() }
    const { data: ins, error: insertError } = await supabaseAdmin
      .from('warranty_registrations')
      .insert([row])
      .select('id')
      .single()
    if (insertError) return res.status(500).json({ error: insertError.message })
    const details = { name, email, mobile, phoneModel: phone_model, country, productType: product_type, purchaseDate: purchase_date, expiryDate: expiry_date, productCode: cleanCode }
    const apiKey = getResendApiKey()
    async function send(from: string) {
      const subject = 'XPLUS Warranty Registration Confirmation'
      const html = renderEmailHtml(details)
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject, html })
      })
      return r
    }
    let emailSent = false
    if (apiKey) {
      let r = await send('XPLUS <no-reply@xplus.com.sg>')
      if (!r.ok) r = await send('XPLUS <onboarding@resend.dev>')
      emailSent = r.ok
      if (!emailSent) {
        setTimeout(async () => { try { await send('XPLUS <no-reply@xplus.com.sg>') } catch {} }, 2000)
        setTimeout(async () => { try { await send('XPLUS <no-reply@xplus.com.sg>') } catch {} }, 5000)
      }
    }
    return res.json({ ok: true, id: ins?.id, emailSent })
  }
  if (!pool) {
    const codes = await readCodes()
    const exists = codes.find(c => String(c.code || '').replace(/\s|-/g, '').toUpperCase() === cleanCode)
    if (!exists) return res.status(400).json({ error: 'Invalid product code' })
    const raw = JSON.parse(fs.readFileSync(warrantiesFile, 'utf8'))
    if ((raw.warranties || []).some((w: any) => String(w.productCode || '').toUpperCase().replace(/\s+/g, '') === cleanCode)) return res.status(400).json({ error: 'Product code already registered' })
    const now = new Date().toISOString()
    const id = (raw.warranties || []).length ? Math.max(...raw.warranties.map((w: any) => Number(w.id) || 0)) + 1 : 1
    raw.warranties.push({ id, name, email, phoneModel: phone_model, mobile, country, productType: product_type, purchaseDate, expiryDate, productCode: cleanCode, status: 'Active', createdAt: now })
    fs.writeFileSync(warrantiesFile, JSON.stringify(raw, null, 2))
    return res.json({ ok: true, id, emailSent: false })
  }
  const r1 = await pool.query('select id from product_codes where code=$1 limit 1', [cleanCode])
  if (r1.rowCount === 0) return res.status(400).json({ error: 'Invalid product code' })
  const r2 = await pool.query('select id from warranty_registrations where product_code=$1 limit 1', [cleanCode])
  if (r2.rowCount > 0) return res.status(400).json({ error: 'Product code already registered' })
  const now = new Date().toISOString()
  const r3 = await pool.query('insert into warranty_registrations (name,email,phone_model,mobile,country,product_type,purchase_date,expiry_date,product_code,status,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id', [name, email, phone_model, mobile, country, product_type, purchase_date || null, expiry_date || null, cleanCode, 'Active', now])
  const id = r3.rows[0].id
  return res.json({ ok: true, id, emailSent: false })
})

function renderEmailHtml(d: any): string {
  const fmt = (v: any) => String(v ?? '').trim()
  const items: [string, string][] = [
    ['Name', fmt(d.name)],
    ['Email', fmt(d.email)],
    ['Mobile', fmt(d.mobile)],
    ['Phone Model', fmt(d.phoneModel)],
    ['Country', fmt(d.country)],
    ['Product Type', fmt(d.productType)],
    ['Purchase Date', fmt(d.purchaseDate)],
    ['Expiry Date', fmt(d.expiryDate)],
    ['Product Code', fmt(d.productCode)]
  ]
  const rows = items.filter(([_, v]) => v.length > 0).map(([k, v]) => `<tr><td style="width:30%;padding:12px;border-top:1px solid #FFCDD2;background:#FFEBEE;font-weight:600;color:#4A0A0E">${escapeHtml(String(k))}</td><td style="padding:12px;border-top:1px solid #FFCDD2">${escapeHtml(String(v))}</td></tr>`).join('')
  const logo = 'https://www.xplus.com.sg/xplus.png'
  return `<!doctype html><html><body style="margin:0;background:linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%);font-family:Montserrat,system-ui,-apple-system,Segoe UI,Roboto;color:#4A0A0E"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid #FFCDD2;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(138,21,27,0.15)"><tr><td style="background:#D32F2F;color:#FFFFFF;padding:12px 16px"><table width="100%" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle"><img src="${logo}" alt="XPLUS" width="120" style="display:block" /></td><td align="right" style="vertical-align:middle;font-size:16px;font-weight:600">Registration Details</td></tr></table></td></tr><tr><td style="padding:24px 20px"><h2 style="margin:0 0 10px;color:#D32F2F;font-size:22px">Warranty Registration Successful</h2><p style="margin:0 0 16px;color:#6B6B6B;font-size:15px;line-height:1.8">Your XPLUS warranty has been activated. Keep this email for your records.</p><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table><div style="margin-top:16px;padding:12px;border:1px solid #FFCDD2;border-radius:10px;background:#FFF7F7;color:#4A0A0E"><div style="font-weight:600;margin-bottom:6px">X-Plus Promise</div><div style="font-size:14px;line-height:1.5">100% Genuine • Exceptional Client Care • 180-Day 1-to-1 Exchange</div></div><p style="margin-top:16px;font-size:13px;color:#555">If anything looks incorrect, reply to this email and our team will assist you.</p></td></tr></table></td></tr></table></body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const port = Number(process.env.API_PORT || 5176)
initDb().then(() => {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
}).catch(err => {
  console.error('DB init failed', err)
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
})
function getResendApiKey(): string {
  const envKey = String(process.env.RESEND_API_KEY || '').trim()
  if (envKey) return envKey
  try {
    const p = path.join(process.cwd(), '.resend')
    if (fs.existsSync(p)) {
      const k = fs.readFileSync(p, 'utf8').trim()
      if (k) return k
    }
  } catch {}
  return ''
}
