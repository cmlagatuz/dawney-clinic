import type {User} from '@supabase/supabase-js'
import { supabase } from './supabase'
import { readOwner } from './owners'
import { cleanPet, cleanBooking } from '../clinical.mjs'

function client() {
  if(!supabase) throw new Error('Clinic database is not configured')
  return supabase
}
export type Pet = {
  id:string;owner_id:string;name:string;species:string;breed:string|null;
  sex:'male'|'female'|'unknown';color:string|null;birth_date:string|null;
}
export type Appointment = {
  id:string;owner_id:string;pet_id:string;resource_id:string;
  starts_at:string;ends_at:string;concern:string;details:string|null;
  status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show'
}
export type BookingResource = {id:string;name:string;is_active:boolean}
const PET_FIELDS='id,owner_id,name,species,breed,sex,color,birth_date'
const APP_FIELDS='id,owner_id,pet_id,resource_id,starts_at,ends_at,concern,details,status'

export async function listPets(user:User):Promise<Pet[]> {
  const owner=await readOwner(user);if(!owner) return []
  const {data,error}=await client().from('pets').select(PET_FIELDS).eq('owner_id',owner.id).order('created_at',{ascending:false})
  if(error) throw error
  return data as Pet[]
}
export async function addPet(user:User,input:unknown):Promise<Pet> {
  const owner=await readOwner(user);if(!owner) throw new Error('Create an owner profile before adding a patient.')
  const values=cleanPet(input)
  const {data,error}=await client().from('pets').insert({owner_id:owner.id,...values}).select(PET_FIELDS).single()
  if(error) throw error
  if(data.owner_id!==owner.id)throw new Error('Patient ownership mismatch')
  return data as Pet
}
export async function editPet(user:User,petId:string,input:unknown):Promise<Pet> {
  const owner=await readOwner(user);if(!owner) throw new Error('Owner profile is missing.')
  const values=cleanPet(input)
  // No owner_id in the UPDATE; browser cannot transfer a patient's ownership.
  const {data,error}=await client().from('pets').update(values)
    .eq('id',petId).eq('owner_id',owner.id).select(PET_FIELDS).single()
  if(error) throw error
  if(data.owner_id!==owner.id)throw new Error('Patient ownership mismatch')
  return data as Pet
}
export async function listResources():Promise<BookingResource[]> {
  const {data,error}=await client().from('appointment_resources').select('id,name,is_active').eq('is_active',true).order('name')
  if(error) throw error
  return data as BookingResource[]
}
export async function listAppointments(user:User):Promise<Appointment[]> {
  const owner=await readOwner(user);if(!owner) return []
  const {data,error}=await client().from('appointments').select(APP_FIELDS).eq('owner_id',owner.id).order('starts_at',{ascending:false})
  if(error)throw error
  return data as Appointment[]
}
export async function bookAppointment(user:User,details:unknown):Promise<Appointment> {
  const owner=await readOwner(user);if(!owner) throw new Error('Create an owner profile before booking.')
  const slot=cleanBooking(details)
  // RLS plus composite FK (pet_id, owner_id) enforce patient ownership in PostgreSQL.
  const {data,error}=await client().from('appointments').insert({owner_id:owner.id,...slot})
    .select(APP_FIELDS).single()
  if(error) throw error
  if(data.owner_id!==owner.id) throw new Error('Booking ownership mismatch')
  return data as Appointment
}
export async function cancelAppointment(user:User,id:string):Promise<Appointment> {
  const owner=await readOwner(user);if(!owner) throw new Error('Owner profile is missing.')
  const {data,error}=await client().from('appointments').update({status:'cancelled'})
    .eq('id',id).eq('owner_id',owner.id).in('status',['requested','confirmed'])
    .select(APP_FIELDS).single()
  if(error) throw error
  return data as Appointment
}