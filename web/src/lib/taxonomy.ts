import type {User} from '@supabase/supabase-js'
import {supabase} from './supabase'
import {readOwner} from './owners'
import {cleanPet} from '../clinical.mjs'

export type SpeciesGroup='companion'|'livestock'|'birds'|'reptiles_amphibians'|'aquatic'|'other'
export type SpeciesOption={
 id:string;label:string;group_name:SpeciesGroup;scientific_name:string|null;
 is_active:boolean;clinic_supported:boolean;review_status:'curated'|'staff_reviewed'|'pending';
 source_name:string;source_url:string|null
}
export type BreedOption={
 id:string;species_id:string;label:string;
 kind:'recognized'|'mixed'|'unknown'|'not_applicable';is_active:boolean;
 source_name:string;source_url:string|null;review_status:'curated'|'staff_reviewed'|'pending'
}
export type CatalogPet={
 id:string;owner_id:string;name:string;species:string;breed:string|null;
 species_id:string|null;breed_id:string|null;taxonomy_review_needed:boolean;
 sex:'male'|'female'|'unknown';color:string|null;birth_date:string|null
}
export type CatalogPetInput={
 name:string;speciesId:string;breedId?:string|null;sex?:'male'|'female'|'unknown';
 color?:string;birth_date?:string
}
const speciesFields='id,label,group_name,scientific_name,is_active,clinic_supported,review_status,source_name,source_url'
const breedFields='id,species_id,label,kind,is_active,review_status,source_name,source_url'
const petFields='id,owner_id,name,species,breed,species_id,breed_id,taxonomy_review_needed,sex,color,birth_date'
const slug=/^[a-z][a-z0-9-]{1,100}$/
function client(){if(!supabase)throw Error('Clinic database is not configured');return supabase}
export async function listAnimalTypes():Promise<SpeciesOption[]> {
 const {data,error}=await client().from('species_catalog').select(speciesFields)
   .eq('is_active',true).order('group_name').order('label')
 if(error)throw error
 return (data??[]) as SpeciesOption[]
}
export async function listBreedsForSpecies(speciesId:string):Promise<BreedOption[]> {
 if(!slug.test(speciesId))throw Error('Invalid selected animal type')
 const {data,error}=await client().from('breed_catalog').select(breedFields)
   .eq('species_id',speciesId).eq('is_active',true).order('label')
 if(error)throw error
 return (data??[]) as BreedOption[]
}
export function breedIsForSpecies(speciesId:string,breed:BreedOption|null):boolean {
 return breed===null||(breed.species_id===speciesId&&breed.is_active&&breed.review_status!=='pending')
}
async function checkedTaxonomy(speciesId:string,breedId:string|null){
 if(!slug.test(speciesId)|| (breedId!==null&&!slug.test(breedId)))throw Error('Select a listed animal type and breed')
 const db=client()
 const {data:species,error:sErr}=await db.from('species_catalog')
   .select('id,label,is_active,clinic_supported').eq('id',speciesId).single()
 if(sErr||!species||!species.is_active)throw Error('Selected animal type is unavailable')
 let breed:null|{id:string;label:string;species_id:string}=null
 if(breedId!==null){
  const {data,error}=await db.from('breed_catalog').select('id,label,species_id')
    .eq('id',breedId).eq('species_id',speciesId).single()
  if(error||!data)throw Error('Breed does not belong to selected animal type')
  breed=data
 }
 return {species,breed}
}
async function checkedFields(input:CatalogPetInput) {
 if(!input||typeof input!=='object')throw Error('Patient data required')
 const {species,breed}=await checkedTaxonomy(input.speciesId,input.breedId??null)
 const base=cleanPet({...input,species:species.label,breed:breed?.label??''})
 return {...base,species_id:species.id,breed_id:breed?.id??null}
}
/** Catalog is browseable even when clinic_supported=false. The booking UI must block
 * unsupported types until veterinarian approval; this adapter never implies support. */
export async function addCatalogPet(user:User,input:CatalogPetInput):Promise<CatalogPet>{
 const owner=await readOwner(user)
 if(!owner)throw Error('Create owner profile before registering a patient')
 const values=await checkedFields(input)
 const {data,error}=await client().from('pets').insert({owner_id:owner.id,...values})
   .select(petFields).single()
 if(error)throw error
 if(data.owner_id!==owner.id)throw Error('Patient ownership mismatch')
 return data as CatalogPet
}
export async function editCatalogPet(user:User,petId:string,input:CatalogPetInput):Promise<CatalogPet>{
 const owner=await readOwner(user)
 if(!owner)throw Error('Owner profile is missing')
 const values=await checkedFields(input)
 const {data,error}=await client().from('pets').update(values)
   .eq('id',petId).eq('owner_id',owner.id).select(petFields).single()
 if(error)throw error
 if(data.owner_id!==owner.id)throw Error('Patient ownership mismatch')
 return data as CatalogPet
}
export async function listCatalogPets(user:User):Promise<CatalogPet[]>{
 const owner=await readOwner(user)
 if(!owner)return []
 const {data,error}=await client().from('pets').select(petFields)
   .eq('owner_id',owner.id).order('created_at',{ascending:false})
 if(error)throw error
 return (data??[]) as CatalogPet[]
}
