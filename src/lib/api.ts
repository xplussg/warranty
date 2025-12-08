import { supabase } from './supabase'
import { me, getRole } from './auth'
import Papa from 'papaparse'

export type CodeCheck = {
  exists: boolean
  productType: string | null
  length: number
  lengthOk: boolean
  validProductType: boolean
  begins8899: boolean
}

export async function checkCode(code: string): Promise<CodeCheck> {
  const digitsOnly = code.replace(/\D/g, '')
  const len = digitsOnly.length
  // Rule: length must be 16 or 20 digits
  const lengthOk = len === 16 || len === 20
  const begins8899 = digitsOnly.startsWith('8899')

  // Query Supabase for exact code match (case insensitive typically, but product codes are usually upper)
  const clean = code.toUpperCase().replace(/\s+/g, '')
  const { data, error } = await supabase
    .from('product_codes')
    .select('product_type')
    .eq('code', clean)
    .maybeSingle()

  const exists = !!data && !error
  const productType = data?.product_type || null
  const validProductType = begins8899 ? productType === 'Dream Case' : true

  return {
    exists,
    productType,
    length: len,
    lengthOk,
    validProductType,
    begins8899
  }
}

export async function registerWarranty(data: any) {
  // Client-side validation logic similar to server
  const cleanCode = String(data.productCode || '').toUpperCase().replace(/\s+/g, '')
  
  // 1. Check if code exists in product_codes
  const { data: codeData, error: codeError } = await supabase
    .from('product_codes')
    .select('id')
    .eq('code', cleanCode)
    .maybeSingle()

  if (codeError || !codeData) {
    return { error: 'Invalid product code' }
  }

  // 2. Check if already registered
  const { data: existing } = await supabase
    .from('warranty_registrations')
    .select('id')
    .eq('product_code', cleanCode)
    .maybeSingle()

  if (existing) {
    return { error: 'Product code already registered' }
  }

  // 3. Insert
  // Map camelCase to snake_case
  const row = {
    name: data.name,
    email: data.email,
    phone_model: data.phoneModel,
    mobile: data.mobile,
    country: data.country,
    product_type: data.productType,
    purchase_date: data.purchaseDate,
    expiry_date: data.expiryDate,
    product_code: cleanCode,
    status: 'Active',
    created_at: new Date().toISOString()
  }

  const { error: insertError } = await supabase
    .from('warranty_registrations')
    .insert([row])

  if (insertError) {
    return { error: insertError.message }
  }

  // 4. Send confirmation email (best-effort; include status)
  let emailSent = false
  try {
    const { data: resp, error: fnErr } = await (supabase as any).functions.invoke('warranty-email', {
      body: { to: row.email, details: row }
    })
    if (!fnErr && !(resp && resp.skipped)) emailSent = true
    if (fnErr || !resp) {
      const env = (import.meta as any).env || {}
      const base = env.VITE_SUPABASE_URL
      const anon = env.VITE_SUPABASE_ANON_KEY
      if (base && anon) {
        const res = await fetch(`${base}/functions/v1/warranty-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': anon },
          body: JSON.stringify({ to: row.email, details: row })
        })
        if (res.ok) {
          const j = await res.json().catch(() => ({}))
          if (!j.skipped) emailSent = true
        }
      }
    }
  } catch (e) {
    console.warn('warranty-email invoke failed:', (e as any)?.message || e)
  }

  return { ok: true, emailSent }
}

export async function listCodes(q = '', page = 1, pageSize = 20) {
  let query = supabase
    .from('product_codes')
    .select('id, code, product_type, created_at', { count: 'exact' })
    .order('id', { ascending: true })

  if (q) {
    query = query.ilike('code', `%${q}%`)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  const { data, count, error } = await query.range(from, to)
  
  if (error) {
    console.error(error)
    return { items: [], total: 0, page, pageSize }
  }

  const items = (data || []).map((r: any) => ({
    id: r.id,
    code: r.code,
    productType: r.product_type,
    createdAt: r.created_at
  }))

  return { items, total: count || 0, page, pageSize }
}

export async function deleteCode(id: number) {
  const { error } = await supabase.from('product_codes').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function searchWarrantiesByEmail(email: string) {
  const clean = email.trim()
  const pattern = `%${clean}%`
  const { data, count, error } = await supabase
    .from('warranty_registrations')
    .select('*', { count: 'exact' })
    .ilike('email', pattern)

  if (error) return { items: [], count: 0 }

  const items = (data || []).map((r: any) => mapWarranty(r))
  return { items, count: count || items.length }
}

export async function uploadCodes(file: File): Promise<any> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows = results.data.map((r: any) => ({
          code: r.code || r.Code || r['Product Code'],
          product_type: r.product_type || r['Product Type'] || null
        })).filter((r: any) => r.code)
        if (rows.length === 0) return resolve({ error: 'No valid rows found' })
        const { error } = await supabase.from('product_codes').insert(rows)
        if (error) resolve({ error: error.message })
        else resolve({ ok: true, count: rows.length })
      },
      error: (err: any) => resolve({ error: err.message })
    })
  })
}

export async function uploadWarranties(file: File): Promise<any> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows = results.data.map((r: any) => {
          const get = (k: string[]) => { for(const key of k) if(r[key]) return r[key]; return null }
          return {
            name: get(['name','Name','Customer']),
            email: get(['email','Email']),
            phone_model: get(['phone_model','Phone Model','phoneModel']),
            mobile: get(['mobile','Mobile','Contact']),
            country: get(['country','Country']),
            product_type: get(['product_type','Product Type','productType']),
            purchase_date: get(['purchase_date','Purchase Date','purchaseDate']),
            expiry_date: get(['expiry_date','Expiry Date','expiryDate']),
            product_code: get(['product_code','Product Code','productCode']),
            status: get(['status','Status']) || 'Active',
            created_at: get(['created_at','Created At']) || new Date().toISOString()
          }
        }).filter((r: any) => r.product_code)
         if (rows.length === 0) return resolve({ error: 'No valid rows found' })
        const { error } = await supabase.from('warranty_registrations').insert(rows)
        if (error) resolve({ error: error.message })
        else resolve({ ok: true, count: rows.length })
      },
      error: (err: any) => resolve({ error: err.message })
    })
  })
}

export async function searchWarranties(q = '', page = 1, pageSize = 20) {
  const role = await getRole()
  if (role === 'partner' && !q.trim()) {
    return { items: [], total: 0, page, pageSize }
  }

  let query = supabase
    .from('warranty_registrations')
    .select('*', { count: 'exact' })
    .order('id', { ascending: true })

  if (q) {
    const like = `%${q}%`
    if (role === 'partner') {
      query = query.or(`name.ilike.${like},email.ilike.${like},mobile.ilike.${like}`)
    } else {
      query = query.or(`name.ilike.${like},email.ilike.${like},mobile.ilike.${like},phone_model.ilike.${like},product_code.ilike.${like},country.ilike.${like},product_type.ilike.${like}`)
    }
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await query.range(from, to)

  if (error) {
    console.error(error)
    return { items: [], total: 0, page, pageSize }
  }

  const items = (data || []).map((r: any) => mapWarranty(r))
  return { items, total: count || 0, page, pageSize }
}

export async function claimWarranty(id: number) {
  const user = await me()
  if (!user || !user.session) return { error: 'Not logged in' }
  const email = user.session.user.email

  const { error } = await supabase
    .from('warranty_registrations')
    .update({
      status: 'Claimed',
      claimed_at: new Date().toISOString(),
      claimed_by: email
    })
    .eq('id', id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function unclaimWarranty(id: number) {
  const user = await me()
  if (!user || !user.session) return { error: 'Not logged in' }
  // Only admins might be allowed to unclaim, or same user? 
  // For now, allow auth user (RLS will control if needed)
  
  const { error } = await supabase
    .from('warranty_registrations')
    .update({
      status: 'Active', // Revert to Active
      claimed_at: null,
      claimed_by: null
    })
    .eq('id', id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteWarranty(id: number) {
  const { error } = await supabase.from('warranty_registrations').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

function mapWarranty(r: any) {
  return {
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
  }
}

export async function createPartner(data: { email: string; username: string; password?: string }) {
  const { data: result, error } = await supabase.functions.invoke('create-partner', {
    body: data
  })
  
  if (error) {
    console.error('Edge Function Error:', error)
    // Extract status code if available
    if (error instanceof Error && 'status' in error) {
      return { error: `Edge Function Error: ${(error as any).status} - ${error.message}` }
    }
    return { error: error.message }
  }
  
  if (result.error) return { error: result.error }
  
  return { ok: true, user: result.user, password: result.password }
}

export async function setUserRole(data: { email: string; role: 'owner' | 'partner' | 'admin'; username?: string }) {
  const { data: result, error } = await supabase.functions.invoke('set-user-role', { body: data })
  if (error) return { error: error.message }
  if ((result as any)?.error) return { error: (result as any).error }
  return { ok: true }
}
