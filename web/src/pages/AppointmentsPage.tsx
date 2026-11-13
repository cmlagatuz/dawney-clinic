import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { bookAppointment, cancelAppointment, listAppointments, listPets, listResources,
  type Appointment, type BookingResource, type Pet } from '../lib/clinical'
import { readOwner } from '../lib/owners'
import { friendlyBookingError } from '../clinical.mjs'

const localTime = (iso:string) => new Intl.DateTimeFormat(undefined,{
  dateStyle:'medium',timeStyle:'short'
}).format(new Date(iso))
const activeStatuses=new Set(['requested','confirmed'])

export function AppointmentsPage() {
  const {user}=useAuth()
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [ownerReady,setOwnerReady]=useState(false)
  const [pets,setPets]=useState<Pet[]>([])
  const [resources,setResources]=useState<BookingResource[]>([])
  const [appointments,setAppointments]=useState<Appointment[]>([])
  const [error,setError]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)
  const [selectedPet,setSelectedPet]=useState('')
  const [selectedResource,setSelectedResource]=useState('')
  const [slot,setSlot]=useState('')
  const [concern,setConcern]=useState('')
  const [details,setDetails]=useState('')
  const [cancelBusy,setCancelBusy]=useState<string|null>(null)
  async function reload() {
    if(!user)return
    const [owner,petsData,resourcesData,appointmentsData]=await Promise.all([
      readOwner(user),listPets(user),listResources(),listAppointments(user)])
    setOwnerReady(Boolean(owner));setPets(petsData);setResources(resourcesData);setAppointments(appointmentsData)
    setSelectedPet(current=>current||petsData[0]?.id||'')
    setSelectedResource(current=>current||resourcesData[0]?.id||'')
  }
  useEffect(()=>{
    if(!user)return
    let active=true
    setLoading(true)
    void Promise.all([readOwner(user),listPets(user),listResources(),listAppointments(user)]).then(([owner,petsData,resourcesData,appointmentsData])=>{
      if(!active)return
      setOwnerReady(Boolean(owner));setPets(petsData);setResources(resourcesData);setAppointments(appointmentsData)
      setSelectedPet(petsData[0]?.id||'');setSelectedResource(resourcesData[0]?.id||'')
    }).catch(()=>{if(active)setError('Could not retrieve your appointments. Please retry.')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[user])
  async function book(e:FormEvent) {
    e.preventDefault();if(!user)return
    setSaving(true);setError(null);setNotice(null)
    try {
      await bookAppointment(user,{petId:selectedPet,resourceId:selectedResource,startsAt:slot,concern,details})
      setSlot('');setConcern('');setDetails('')
      await reload()
      setNotice('Appointment requested. Your booking is saved in Supabase; confirmation is pending clinic review.')
    } catch(e){
      const code=(e&&typeof e==='object'&&'code' in e)?String(e.code):undefined
      const message=e instanceof Error&&/^(Choose|Enter|Select|Create an owner)/.test(e.message)
        ?e.message:friendlyBookingError(code)
      setError(message)
    } finally {setSaving(false)}
  }
  async function cancel(id:string) {
    if(!user)return
    setCancelBusy(id);setError(null);setNotice(null)
    try {await cancelAppointment(user,id);await reload();setNotice('The appointment has been cancelled.')}
    catch {setError('Unable to cancel this booking. Its status may have changed.')}
    finally {setCancelBusy(null)}
  }
  return <section className="page" aria-labelledby="appts-heading">
    <div className="page-heading"><div><span className="eyebrow">Clinic visits</span><h1 id="appts-heading">Appointments</h1>
      <p className="subtitle">Request a 30-minute slot. Confirmed hours and holidays are pending clinic configuration.</p></div></div>
    {error&&<p role="alert" className="alert alert-error">{error}</p>}
    {notice&&<p role="status" className="alert alert-success">{notice}</p>}
    {loading?<div className="card" role="status">Loading appointments…</div>:
      !ownerReady?<div className="card empty"><h2>Set up your owner profile</h2><p>You need a verified profile before requesting an appointment.</p><Link className="button button-primary" to="/app/profile">Owner profile</Link></div>:
      <div className="info-grid"><div className="card"><h2>Request an appointment</h2>
        {pets.length===0?<p>No patients yet. <Link to="/app/pets">Register a patient</Link> before booking.</p>:
        resources.length===0?<p role="status">No active booking calendar is currently available.</p>:
        <form className="form-stack" onSubmit={e=>void book(e)}>
          <label>Patient<select required value={selectedPet} onChange={e=>setSelectedPet(e.target.value)}>
            {pets.map(p=><option key={p.id} value={p.id}>{p.name} · {p.species}</option>)}</select></label>
          <label>Clinic resource<select required value={selectedResource} onChange={e=>setSelectedResource(e.target.value)}>
            {resources.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>Start time (your device time zone)<input type="datetime-local" required value={slot} onChange={e=>setSlot(e.target.value)}/></label>
          <label>Reason for visit<input required maxLength={300} value={concern} placeholder="e.g. Annual health check" onChange={e=>setConcern(e.target.value)}/></label>
          <label>Details (optional)<textarea rows={3} maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)}/></label>
          <p className="small-help">Requests are accepted only for available slots; a booking does not imply veterinarian confirmation. Times currently follow your device, not an approved clinic time zone.</p>
          <button className="button button-primary" disabled={saving}>{saving?'Checking slot…':'Request appointment'}</button>
        </form>}
      </div><div className="card"><h2>My bookings</h2>
        {appointments.length===0?<p className="subtitle">No appointments yet. Requests you submit will appear here after saving.</p>:
        <div className="booking-list">{appointments.map(a=><article className="booking-item" key={a.id}>
          <div className="booking-item-top"><strong>{pets.find(p=>p.id===a.pet_id)?.name??'Patient'}</strong><span className="tag">{a.status.replace('_',' ')}</span></div>
          <time dateTime={a.starts_at}>{localTime(a.starts_at)}</time><p>{a.concern}</p>
          {activeStatuses.has(a.status)&&<button className="button button-secondary" type="button" disabled={cancelBusy!==null}
            onClick={()=>void cancel(a.id)}>{cancelBusy===a.id?'Cancelling…':'Cancel booking'}</button>}
        </article>)}</div>}
      </div></div>}
  </section>
}