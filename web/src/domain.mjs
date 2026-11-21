export function cleanProfile(value) {
  if (!value || typeof value !== 'object') throw new Error('Profile details are required.')
  const first_name = typeof value.first_name === 'string' ? value.first_name.trim() : ''
  const last_name = typeof value.last_name === 'string' ? value.last_name.trim() : ''
  if (!first_name || first_name.length > 150 || !last_name || last_name.length > 150) {
    throw new Error('Enter a first and last name (up to 150 characters each).')
  }
  const phone = typeof value.phone === 'string' ? value.phone.trim() : ''
  const address = typeof value.address === 'string' ? value.address.trim() : ''
  if (phone.length > 40 || address.length > 1000) throw new Error('Contact details are too long.')
  return { first_name, last_name, phone: phone || null, address: address || null }
}

export function safeAuthReturnPath(value) {
  return typeof value === 'string' && /^\/(app|auth)(\/|$)/.test(value) && !value.includes('//')
    ? value
    : '/app/profile'
}

export function isVerifiedUser(user) {
  return Boolean(user && user.id && user.email_confirmed_at && user.is_anonymous !== true)
}
/** Minimum requested policy: eight characters with at least one letter and digit. */
export function isValidNewPassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 1024
    && /[A-Za-z]/.test(value) && /[0-9]/.test(value)
}
