import { useId } from 'react'
import { Link } from 'react-router'
import type { EligiblePet } from '../public-site/usePatientEligibility'
import { eligibilityHelp, eligibilityNote } from '../public-site/eligibility.mjs'

/** Patient picker that lists every patient but only lets eligible ones be chosen; explains why others cannot. */
export function PatientSelect({ pets, value, onChange }: { pets: EligiblePet[]; value: string; onChange: (id: string) => void }) {
  const helpId = useId()
  const blocked = pets.filter(p => p.eligibility !== 'eligible')
  const eligibleCount = pets.length - blocked.length
  const helpKinds = [...new Set(blocked.map(p => p.eligibility))]
  return <div className="patient-select">
    <label>Patient<select required value={value} onChange={e => onChange(e.target.value)} aria-describedby={blocked.length ? helpId : undefined}>
      <option value="">{eligibleCount ? 'Choose a patient' : 'No patient can be booked online'}</option>
      {pets.map(p => <option key={p.id} value={p.id} disabled={p.eligibility !== 'eligible'}>{p.name} · {p.species}{p.eligibility !== 'eligible' ? ` — ${eligibilityNote(p.eligibility)}` : ''}</option>)}
    </select></label>
    {blocked.length > 0 && <div id={helpId} className="alert alert-info eligibility-help" role="note">
      {eligibleCount === 0 && <strong>None of your patients can be booked online yet.</strong>}
      {helpKinds.map(k => <p key={k}>{blocked.filter(p => p.eligibility === k).map(p => p.name).join(', ')}: {eligibilityHelp(k)}</p>)}
      <Link to="/app/pets">View my patients</Link></div>}
  </div>
}
