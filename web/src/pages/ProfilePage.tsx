import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/AuthProvider'
import { createOwner, readOwner, updateOwner, type OwnerProfile } from '../lib/owners'

export function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<OwnerProfile|null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [notice, setNotice] = useState<string|null>(null)
  const [fields, setFields] = useState({ first_name:'', last_name:'', phone:'',address:'' })
  useEffect(() => {
    if(!user) return
    let active = true
    setLoading(true)
    void readOwner(user).then(result => {
      if (!active) return
      setProfile(result)
      setFields({first_name:result?.first_name ?? String(user.user_metadata?.first_name ?? ''),
        last_name:result?.last_name ?? String(user.user_metadata?.last_name ?? ''),
        phone:result?.phone ?? '',address:result?.address ?? ''})
    }).catch(() => {if(active)setError('Unable to load your profile. Check your connection and retry.')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  }, [user])
  async function save(e:FormEvent){
    e.preventDefault();if(!user) return
    setSaving(true);setError(null);setNotice(null)
    try {const saved=profile ? await updateOwner(user,fields) : await createOwner(user,fields)
      setProfile(saved);setNotice('Your profile was saved to the clinic database.')
    } catch(e) {setError(e instanceof Error && e.message.includes('Enter a first') ? e.message : 'Profile could not be saved. Check your details and connection.')}
    finally {setSaving(false)}
  }
  return <section className="page" aria-labelledby="profile-heading">
    <div className="page-heading"><div><span className="eyebrow">Account settings</span><h1 id="profile-heading">My owner profile</h1>
      <p className="subtitle">This information is stored securely in Supabase and remains after you sign out.</p></div>
      <span className="tag">{profile?'Saved profile':'Setup required'}</span></div>
    <div className="info-grid"><article className="card"><h2>Contact details</h2>
      {loading ? <p role="status">Loading saved profile…</p> : <>
        {error && <p role="alert" className="alert alert-error">{error}</p>}
        {notice && <p role="status" className="alert alert-success">{notice}</p>}
        <form className="form-stack" onSubmit={e=>void save(e)}>
          <div className="form-row"><label>First name<input required maxLength={150} autoComplete="given-name" value={fields.first_name} onChange={e=>setFields({...fields,first_name:e.target.value})}/></label>
            <label>Last name<input required maxLength={150} autoComplete="family-name" value={fields.last_name} onChange={e=>setFields({...fields,last_name:e.target.value})}/></label></div>
          <label>Phone (optional)<input maxLength={40} autoComplete="tel" value={fields.phone} onChange={e=>setFields({...fields,phone:e.target.value})}/></label>
          <label>Address (optional)<textarea rows={3} maxLength={1000} autoComplete="street-address" value={fields.address} onChange={e=>setFields({...fields,address:e.target.value})}/></label>
          <button className="button button-primary" disabled={saving}>{saving?'Saving…':profile?'Save changes':'Create owner profile'}</button>
        </form></>}
    </article><aside className="card card-muted"><h2>Account security</h2><dl className="summary-list"><div><dt>Email</dt><dd>{user?.email}</dd></div><div><dt>Verification</dt><dd>Verified</dd></div>
      <div><dt>Owner record</dt><dd>{profile?'Linked to this account':'Not created yet'}</dd></div></dl>
      <p className="small-help">Patient and appointment access will be checked by PostgreSQL row-level security, not by this screen.</p></aside></div>
  </section>
}

export function ComingSoonPage({kind}:{kind:'patients'|'appointments'}) {
  return <section className="page" aria-labelledby="not-available"><span className="eyebrow">Under development</span><h1 id="not-available">{kind==='patients'?'Patients':'Appointments'}</h1>
    <div className="card empty"><h2>{kind==='patients'?'Patient registration':'Booking calendar'} is not connected yet</h2>
      <p>We're building this workflow with real database safeguards. No records are created on this screen.</p></div></section>
}