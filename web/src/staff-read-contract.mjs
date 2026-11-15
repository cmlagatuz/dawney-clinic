/** RLS-scoped staff read contracts. Never use these client checks instead of DB policies. */
export const STAFF_ROLES = Object.freeze(['administrator', 'veterinarian', 'receptionist'])
const roleSet = new Set(STAFF_ROLES)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const utcInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const statuses = new Set(['requested','confirmed','checked_in','completed','cancelled','no_show'])

export async function verifyStaffFromRls(db, userId) {
  if (typeof userId !== 'string' || !uuid.test(userId)) throw Error('Verified staff identity required')
  const { data: auth, error: authError } = await db.auth.getUser()
  if (authError || !auth?.user || auth.user.id !== userId ||
      auth.user.is_anonymous || !auth.user.email_confirmed_at) {
    throw Error('Verified staff session required')
  }
  const { data, error } = await db.from('staff_memberships')
    .select('user_id,role,is_active').eq('user_id',userId).maybeSingle()
  if (error || !data || data.user_id !== userId || data.is_active !== true ||
      !roleSet.has(data.role)) throw Error('Clinic staff access is not approved')
  return {userId,role:data.role,isActive:true}
}

export function validateClinicUtcWindow(fromUtc,toUtc) {
  if (typeof fromUtc !== 'string' || typeof toUtc !== 'string' ||
      !utcInstant.test(fromUtc) || !utcInstant.test(toUtc)) {
    throw Error('Valid UTC clinic queue window required')
  }
  const from = new Date(fromUtc), to = new Date(toUtc)
  if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf()) ||
      from.toISOString().slice(0,19) !== fromUtc.slice(0,19) ||
      to.toISOString().slice(0,19) !== toUtc.slice(0,19) ||
      to <= from || to.valueOf() - from.valueOf() > 86400000) {
    throw Error('Valid UTC clinic queue window required')
  }
  return {from:from.toISOString(),to:to.toISOString()}
}

/** Check the complete typed payload before allowing the UI to use a queue row. */
function isVerifiedQueueRow(row) {
  if (!row || typeof row.id !== 'string' || !row.id ||
      typeof row.pet_id !== 'string' || !row.pet_id ||
      typeof row.owner_id !== 'string' || !row.owner_id ||
      typeof row.resource_id !== 'string' || !row.resource_id ||
      !statuses.has(row.status) ||
      typeof row.starts_at !== 'string' || typeof row.ends_at !== 'string' ||
      typeof row.concern !== 'string' || !row.concern.trim()) return false
  const start = Date.parse(row.starts_at), end = Date.parse(row.ends_at)
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

const QUEUE_VISIBLE_LIMIT = 250
/** One extra row distinguishes exactly 250 from a truncated queue. */
export async function queryClinicQueueWindow(db, fromUtc, toUtc) {
  const bounds = validateClinicUtcWindow(fromUtc,toUtc)
  const {data,error} = await db.from('appointments')
    .select('id,pet_id,owner_id,resource_id,starts_at,ends_at,status,concern')
    .gte('starts_at',bounds.from).lt('starts_at',bounds.to)
    .order('starts_at',{ascending:true}).limit(QUEUE_VISIBLE_LIMIT+1)
  if (error) throw error
  if (!Array.isArray(data) || data.length > QUEUE_VISIBLE_LIMIT+1 ||
      data.some(row => !isVerifiedQueueRow(row))) {
    throw Error('Clinic queue response could not be verified')
  }
  return {items:data.slice(0,QUEUE_VISIBLE_LIMIT),hasMore:data.length>QUEUE_VISIBLE_LIMIT}
}

/** Legacy array interface: fail closed rather than silently omit scheduled visits. */
export async function queryClinicQueue(db, fromUtc, toUtc) {
  const result = await queryClinicQueueWindow(db,fromUtc,toUtc)
  if (result.hasMore) throw Error('Clinic queue exceeds 250 appointments; narrow the UTC window or use queryClinicQueueWindow')
  return result.items
}

function exactCount(result) {
  if (result.error) throw result.error
  if (!Number.isSafeInteger(result.count) || result.count < 0) {
    throw Error('Clinic dashboard count unavailable')
  }
  return result.count
}
export async function queryClinicDashboardCounts(db) {
  const [patients,requested,confirmed] = await Promise.all([
    db.from('pets').select('id',{count:'exact',head:true}),
    db.from('appointments').select('id',{count:'exact',head:true}).eq('status','requested'),
    db.from('appointments').select('id',{count:'exact',head:true}).eq('status','confirmed')
  ])
  return {
    patients:exactCount(patients),
    requestedAppointments:exactCount(requested),
    confirmedAppointments:exactCount(confirmed)
  }
}
