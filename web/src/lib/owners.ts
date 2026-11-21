import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { cleanProfile } from '../domain.mjs'

export type OwnerProfile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string | null
  address: string | null
}

const fields = 'id,user_id,first_name,last_name,phone,address'
function client() {
  if (!supabase) throw new Error('Supabase is not configured. Ask the administrator to set the public project settings.')
  return supabase
}

export async function readOwner(user: User): Promise<OwnerProfile | null> {
  const { data, error } = await client().from('owners').select(fields).eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (data && data.user_id !== user.id) throw new Error('Owner identity mismatch')
  return data as OwnerProfile | null
}

export async function createOwner(user: User, input: unknown): Promise<OwnerProfile> {
  const current = await readOwner(user)
  if (current) return current
  const values = cleanProfile(input)
  // No user_id in the INSERT: PostgreSQL auth.uid() is the only authority.
  const { data, error } = await client().from('owners').insert(values).select(fields).single()
  if (error) {
    // Concurrent tabs may race the unique user_id constraint.
    if (error.code === '23505') {
      const existing = await readOwner(user)
      if (existing) return existing
    }
    throw error
  }
  if (data.user_id !== user.id) throw new Error('Owner identity mismatch')
  return data as OwnerProfile
}

export async function updateOwner(user: User, input: unknown): Promise<OwnerProfile> {
  const values = cleanProfile(input)
  const { data, error } = await client().from('owners')
    .update(values).eq('user_id', user.id).select(fields).single()
  if (error) throw error
  if (data.user_id !== user.id) throw new Error('Owner identity mismatch')
  return data as OwnerProfile
}