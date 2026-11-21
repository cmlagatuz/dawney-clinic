import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { addPet, editPet, listPets, type Pet } from '../lib/clinical'
import { readOwner } from '../lib/owners'
import { EmptyState, Icon, LoadingCard, PageHeading } from '../components/ui'

type Fields = {name:string;species:string;breed:string;sex:'male'|'female'|'unknown';color:string;birth_date:string}
const empty:Fields={name:'',species:'',breed:'',sex:'unknown',color:'',birth_date:''}

export function PetsPage() {
  const {user}=useAuth()
  return user ? <OwnerPetsPage key={user.id} user={user}/> : null
}
/** The default patient page is keyed per owner while the catalog flag stays OFF. */
function OwnerPetsPage({user}:{user:User}) {
  const [pets,setPets]=useState<Pet[]>([])
  const [ownerReady,setOwnerReady]=useState(false)
  const [loading,setLoading]=useState(true)
  const [loadFailed,setLoadFailed]=useState(false)
  const [attempt,setAttempt]=useState(0)
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
    setLoading(true);setLoadFailed(false);setPets([]);setOwnerReady(false)
    void Promise.all([readOwner(user),listPets(user)]).then(([owner,items])=>{
      if(active){setOwnerReady(Boolean(owner));setPets(items)}
    }).catch(()=>{if(active){setLoadFailed(true);setError('Unable to verify this account’s patients. Nothing was changed.')}})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[user.id,attempt])
  function reset() {setFields(empty);setEditing(null);setFormOpen(false)}
  function openEdit(pet:Pet) {
    setFields({name:pet.name,species:pet.species,breed:pet.breed??'',sex:pet.sex,
      color:pet.color??'',birth_date:pet.birth_date??''})
    setEditing(pet.id);setFormOpen(true);setError(null);setNotice(null)
  }
  async function save(e:FormEvent) {
    e.preventDefault();if(saving)return
    setSaving(true);setError(null);setNotice(null)
    const wasEditing=Boolean(editing)
    try {
      // A successful INSERT followed by a failed list read is NOT a failed
      // insert. Preserve the returned server ID so retry never creates a second patient.
      const persisted=wasEditing
        ? await editPet(user,editing!,fields)
        : await addPet(user,fields)
      setEditing(persisted.id)
      try {
        await reload()
      } catch {
        setLoadFailed(true)
        setError('Patient saved, but the updated patient list could not be verified. Retry loading; do not register this patient again.')
        return
      }
      reset()
      setNotice(wasEditing?'Patient information updated successfully.':'Patient saved to the clinic database.')
    }catch(err) {
      setError(err instanceof Error && /^(Enter|Invalid|Birth date|Create an owner)/.test(err.message)
        ? err.message:'Patient could not be saved. Please check the information and try again.')
    }finally{setSaving(false)}
  }
  return <section className="page" aria-labelledby="pet-heading">
    <PageHeading id="pet-heading" eyebrow="Patient care" title="My patients"
      actions={ownerReady&&<button className="button button-primary" type="button" onClick={()=>{reset();setFormOpen(true);setNotice(null)}} disabled={saving}><Icon name="plus" width={18} height={18}/>Add patient</button>}>
      Register your animals and maintain their details. Records are private to your account.</PageHeading>
    {error&&<p role="alert" className="alert alert-error">{error}</p>}
    {notice&&<p role="status" className="alert alert-success">{notice}</p>}
    {loading?<LoadingCard label="Loading your patients…" />:
      loadFailed ? <div className="card" role="alert"><p>Could not verify the current account’s patient list. No empty history is assumed.</p><button type="button" className="button button-secondary" onClick={()=>setAttempt(n=>n+1)}>Retry patient list</button></div> :
      !ownerReady?<EmptyState icon="user" title="Complete your owner profile first" action={<Link className="button button-primary" to="/app/profile">Set up owner profile</Link>}>Your profile is needed to securely connect an animal to your account.</EmptyState>:
      <>
        {formOpen&&<div className="card form-card"><div className="section-heading"><h2>{editing?'Edit patient':'Register a patient'}</h2><button type="button" className="button-quiet" onClick={reset} disabled={saving}>Cancel</button></div>
          <form className="form-stack" onSubmit={e=>void save(e)}>
            <div className="form-row"><label>Name<input required maxLength={150} autoComplete="off" value={fields.name} onChange={e=>setFields({...fields,name:e.target.value})}/></label>
            <label>Species<input required maxLength={120} placeholder="e.g. Cat, Dog, Rabbit" value={fields.species} onChange={e=>setFields({...fields,species:e.target.value})}/></label></div>
            <div className="form-row"><label>Breed (optional)<input maxLength={150} value={fields.breed} onChange={e=>setFields({...fields,breed:e.target.value})}/></label>
            <label>Sex<select value={fields.sex} onChange={e=>setFields({...fields,sex:e.target.value as Fields['sex']})}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label></div>
            <div className="form-row"><label>Color (optional)<input maxLength={100} value={fields.color} onChange={e=>setFields({...fields,color:e.target.value})}/></label>
              <label>Birth date (optional)<input type="date" max={new Date().toISOString().slice(0,10)} value={fields.birth_date} onChange={e=>setFields({...fields,birth_date:e.target.value})}/></label></div>
            <div className="form-actions"><button disabled={saving} className="button button-primary">{saving?'Saving…':editing?'Save patient changes':'Save patient'}</button><button type="button" className="button button-secondary" onClick={reset} disabled={saving}>Cancel</button></div>
          </form></div>}
        {pets.length===0?<EmptyState title="No patients registered yet" action={<button type="button" className="button button-primary" onClick={()=>{reset();setFormOpen(true)}}>Register your first patient</button>}>Add an animal to book visits. Their record is saved to your account.</EmptyState>:
        <div className="patient-grid">{pets.map(pet=><article className="card patient-card" key={pet.id}>
          <div className="patient-top"><div className="patient-avatar" aria-hidden="true"><Icon name="paw"/></div><div><h2>{pet.name}</h2><p className="subtitle">{pet.species}{pet.breed?' · '+pet.breed:''}</p></div></div>
          <div className="chip-row"><span className="tag">{pet.sex==='unknown'?'Sex not recorded':pet.sex==='female'?'Female':'Male'}</span>{pet.birth_date&&<span className="tag">Born {pet.birth_date}</span>}{pet.color&&<span className="tag">{pet.color}</span>}</div>
          <button type="button" className="button button-secondary button-small" aria-label={`Edit details for ${pet.name}`} onClick={()=>openEdit(pet)} disabled={saving}>Edit details</button>
        </article>)}</div>}
      </>}
  </section>
}