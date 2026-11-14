// PostgreSQL RLS limits visibility to approved service/species pairs.
// UI-only read: the booking RPC is authoritative for all write-time decisions.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function readServiceSpeciesIds(db,serviceId) {
  if (typeof serviceId !== 'string' || !uuid.test(serviceId)) {
    throw Error('Invalid service')
  }
  const {data:auth,error:authError}=await db.auth.getUser()
  if (authError || !auth?.user || auth.user.is_anonymous || !auth.user.email_confirmed_at) {
    throw Error('Verified customer login required')
  }
  const {data,error}=await db.from('clinic_service_species')
    .select('species_id').eq('service_id',serviceId)
  if (error) throw error
  if (!Array.isArray(data) || data.some(row=>typeof row?.species_id!=='string'||!row.species_id)) {
    throw Error('Cannot verify service species eligibility')
  }
  return [...new Set(data.map(row=>row.species_id))]
}
