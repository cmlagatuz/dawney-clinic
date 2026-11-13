import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { addPet, editPet, listPets, type Pet } from '../lib/clinical'
import { readOwner } from '../lib/owners'

type Fields = {name:string;species:string;breed:string;sex:'male'|'female'|'unknown';color:string;birth_date:string}
const empty:Fields={name:'',species:'',breed:'',sex:'unknown',color:'',birth_date:''}

export function PetsPage() {
  const {user}=useAuth()
  const [pets,setPets]=useState<Pet[]>([])
  const [ownerReady,setOwnerReady]=useState(false)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)
  const [fields,setFields]=useState<Fields>(empty)
  const [editing,setEditing]=useState<string|null>(null)
  const [formOpen,setFormOpen]=useState(false)
  async function reload() {
    if(!user) return
    const [owner,items]=await Promise.all([readOwner(user),listPets(user)])
    setOwnerReady(Boolean(owner));setPets(items)
  }
  useEffect(()=>{
    if(!user)return
    let active=true
    setLoading(true)
    void Promise.all([readOwner(user),listPets(user)]).then(([owner,items])=>{
      if(active){setOwnerReady(Boolean(owner));setPets(items)}
    }).catch(()=>{if(active)setError('Unable to load patients. Please try again.')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[user])
  function reset() {setFields(empty);setEditing(null);setFormOpen(false)}
  function openEdit(pet:Pet) {
    setFields({name:pet.name,species:pet.species,breed:pet.breed??'',sex:pet.sex,
      color:pet.color??'',birth_date:pet.birth_date??''})
    setEditing(pet.id);setFormOpen(true);setError(null);setNotice(null)
  }
  async function save(e:FormEvent) {
    e.preventDefault();if(!user)return
    setSaving(true);setError(null);setNotice(null)
    try {
      if(editing) await editPet(user,editing,fields)
      else await addPet(user,fields)
      await reload();reset()
      setNotice(editing?'Patient information updated successfully.':'Patient saved to the clinic database.')
    }catch(e) {
      setError(e instanceof Error && /^(Enter|Invalid|Birth date|Create an owner)/.test(e.message)
        ? e.message:'Patient could not be saved. Please check the information and try again.')
    }finally{setSaving(false)}
  }
  return <section className="page" aria-labelledby="pet-heading">
    <div className="page-heading"><div><span className="eyebrow">Patient care</span><h1 id="pet-heading">My patients</h1>
      <p className="subtitle">Register your animals and maintain their details. Records are private to your account.</p></div>
      {ownerReady && <button className="button button-primary" type="button" onClick={()=>{reset();setFormOpen(true);setNotice(null)}}>Add patient</button>}
    </div>
    {error&&<p role="alert" className="alert alert-error">{error}</p>}
    {notice&&<p role="status" className="alert alert-success">{notice}</p>}
    {loading?<div className="card" role="status">Loading your patients…</div>:
      !ownerReady?<div className="card empty"><h2>Complete your owner profile first</h2><p>Your profile is needed to securely connect an animal to your account.</p><Link className="button button-primary" to="/app/profile">Set up owner profile</Link></div>:
      <>
        {formOpen&&<div className="card form-card"><div className="section-heading"><h2>{editing?'Edit patient':'Register a patient'}</h2><button type="button" className="button-quiet" onClick={reset}>Cancel</button></div>
          <form className="form-stack" onSubmit={e=>void save(e)}>
            <div className="form-row"><label>Name<input required maxLength={150} autoComplete="off" value={fields.name} onChange={e=>setFields({...fields,name:e.target.value})}/></label>
            <label>Species<input required maxLength={120} placeholder="e.g. Cat, Dog, Rabbit" value={fields.species} onChange={e=>setFields({...fields,species:e.target.value})}/></label></div>
            <div className="form-row"><label>Breed (optional)<input maxLength={150} value={fields.breed} onChange={e=>setFields({...fields,breed:e.target.value})}/></label>
            <label>Sex<select value={fields.sex} onChange={e=>setFields({...fields,sex:e.target.value as Fields['sex']})}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label></div>
            <div className="form-row"><label>Color (optional)<input maxLength={100} value={fields.color} onChange={e=>setFields({...fields,color:e.target.value})}/></label>
              <label>Birth date (optional)<input type="date" max={new Date().toISOString().slice(0,10)} value={fields.birth_date} onChange={e=>setFields({...fields,birth_date:e.target.value})}/></label></div>
            <div><button disabled={saving} className="button button-primary">{saving?'Saving…':editing?'Save patient changes':'Save patient'}</button></div>
          </form></div>}
        {pets.length===0?<div className="card empty"><h2>No patients registered yet</h2><p>Start by adding a patient. Their record will persist in Supabase.</p></div>:
        <div className="patient-grid">{pets.map(pet=><article className="card patient-card" key={pet.id}>
          <div className="patient-avatar" aria-hidden="true">✚</div><div><h2>{pet.name}</h2><p className="subtitle">{pet.species}{pet.breed?' · '+pet.breed:''}</p>
          <p className="patient-detail">Sex: {pet.sex}{pet.birth_date?' · Born '+pet.birth_date:''}</p></div>
          <button type="button" className="button button-secondary" onClick={()=>openEdit(pet)}>Edit details</button>
        </article>)}</div>}
      </>}
  </section>
}