const cap = (value, max) => typeof value === 'string' ? value.trim().slice(0, max + 1) : ''

export function cleanPet(value) {
  if (!value || typeof value !== 'object') throw new Error('Patient details are required.')
  const name = cap(value.name, 150)
  const species = cap(value.species, 120)
  const breed = cap(value.breed, 150)
  const color = cap(value.color, 100)
  const sex = value.sex || 'unknown'
  const birth_date = cap(value.birth_date, 10)
  if (!name || name.length > 150 || !species || species.length > 120) throw new Error('Enter a valid patient name and species.')
  if (breed.length > 150 || color.length > 100 || !['male', 'female', 'unknown'].includes(sex)) throw new Error('Invalid patient details.')
  if (birth_date) {
    const d = new Date(birth_date + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date) || !Number.isFinite(d.valueOf()) ||
      d.toISOString().slice(0,10) !== birth_date || d > new Date()) {
      throw new Error('Birth date must be a valid past date.')
    }
  }
  return {name,species,breed:breed || null,color:color || null,sex,birth_date:birth_date || null}
}

export function cleanBooking(value, now = new Date()) {
  if (!value || typeof value !== 'object') throw new Error('Booking details are required.')
  const { petId, resourceId, startsAt, concern, details } = value
  if (typeof petId !== 'string' || !/^[0-9a-f-]{36}$/i.test(petId) ||
      typeof resourceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(resourceId)) {
    throw new Error('Select a patient and booking resource.')
  }
  const date = startsAt instanceof Date ? startsAt : new Date(startsAt)
  if (!Number.isFinite(date.valueOf()) || date <= now || date.valueOf() > now.valueOf() + 365 * 24*60*60*1000) {
    throw new Error('Choose a future booking time within the next year.')
  }
  const concernText = cap(concern,300)
  const detailsText = cap(details,2000)
  if (!concernText || concernText.length > 300 || detailsText.length > 2000) {
    throw new Error('Enter a valid reason for the appointment.')
  }
  return {
    pet_id: petId, resource_id: resourceId, starts_at:date.toISOString(),
    ends_at:new Date(date.valueOf()+30*60*1000).toISOString(),
    concern:concernText,details:detailsText || null
  }
}

export function friendlyBookingError(code) {
  if (code === '23P01') return 'This time is already reserved. Choose another slot.'
  if (code === '23503') return 'This patient or resource is not available for your account.'
  if (code === '42501') return 'You do not have permission to book for this patient.'
  if (code === '23514') return 'The booking conflicts with clinic scheduling rules.'
  return 'The booking could not be saved. Check your connection or try another slot.'
}