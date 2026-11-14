import type {SupabaseClient} from '@supabase/supabase-js'
export function readServiceSpeciesIds(db:SupabaseClient,serviceId:string):Promise<string[]>
