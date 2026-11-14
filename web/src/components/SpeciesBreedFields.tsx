import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { BreedOption, SpeciesOption } from '../lib/taxonomy'
import { breedControl, flattenGroups, groupSpecies, selectSpecies } from '../patient-form-logic.mjs'

export type Taxonomy = { speciesId: string | null; breedId: string | null }
type Props = {
  species: SpeciesOption[]
  speciesStatus: 'loading' | 'ready' | 'error'
  onRetrySpecies: () => void
  value: Taxonomy
  onChange: (next: Taxonomy) => void
  loadBreeds: (speciesId: string) => Promise<BreedOption[]>
  /** Free-text species/breed from before the catalog existed; shown so staff/owners can re-confirm it. */
  legacyText?: string
  error?: string | null
}

/** Grouped, searchable species picker (ARIA combobox/listbox) + breed select that stays disabled until a species is chosen. */
export function SpeciesBreedFields({ species, speciesStatus, onRetrySpecies, value, onChange, loadBreeds, legacyText, error }: Props) {
  const uid = useId()
  const inputId = `${uid}-species`, listId = `${uid}-list`, breedId = `${uid}-breed`, helpId = `${uid}-help`
  const selected = species.find(s => s.id === value.speciesId) ?? null
  const [query, setQuery] = useState('')
  const [typing, setTyping] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [breeds, setBreeds] = useState<BreedOption[]>([])
  const [breedStatus, setBreedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [breedTry, setBreedTry] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const groups = useMemo(() => groupSpecies(species, typing ? query : ''), [species, query, typing])
  const flat = useMemo(() => flattenGroups(groups), [groups])
  const shown = typing ? query : selected?.label ?? ''

  // Breeds follow the selected species. A stale response for a previous species is ignored.
  useEffect(() => {
    setBreeds([])
    if (!value.speciesId) { setBreedStatus('idle'); return }
    let current = true
    setBreedStatus('loading')
    loadBreeds(value.speciesId).then(list => { if (current) { setBreeds(list); setBreedStatus('ready') } })
      .catch(() => { if (current) setBreedStatus('error') })
    return () => { current = false }
  }, [value.speciesId, loadBreeds, breedTry])

  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active, open])

  function choose(s: SpeciesOption) {
    onChange(selectSpecies(value, s.id))
    setTyping(false); setQuery(''); setOpen(false)
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, Math.max(flat.length - 1, 0))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open) { e.preventDefault(); const s = flat[active]; if (s) choose(s) }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setTyping(false); setQuery('') }
  }
  const ctl = breedControl(value.speciesId, breedStatus, breeds.length)
  const optionId = (i: number) => `${uid}-opt-${i}`
  let index = -1

  return <>
    <div className="field combo">
      <label htmlFor={inputId}>Species</label>
      <input id={inputId} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-haspopup="listbox"
        aria-activedescendant={open && flat[active] ? optionId(active) : undefined} aria-describedby={helpId} aria-invalid={error ? true : undefined}
        autoComplete="off" spellCheck={false} placeholder={speciesStatus === 'loading' ? 'Loading species…' : 'Search or choose a species'}
        disabled={speciesStatus !== 'ready'} value={shown}
        onChange={e => { setQuery(e.target.value); setTyping(true); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setTyping(false); setQuery('') }} onKeyDown={onKey} />
      {open && speciesStatus === 'ready' && <ul id={listId} role="listbox" aria-label="Species" className="combo-list" ref={listRef}>
        {groups.length === 0 && <li role="presentation" className="combo-empty">No species match “{query}”.</li>}
        {groups.map(g => <li role="presentation" key={g.group}>
          <span className="combo-group" id={`${uid}-g-${g.group}`}>{g.label}</span>
          <ul role="group" aria-labelledby={`${uid}-g-${g.group}`}>{g.items.map(s => {
            index += 1; const i = index
            return <li key={s.id} id={optionId(i)} role="option" aria-selected={i === active} className={i === active ? 'combo-option is-active' : 'combo-option'}
              onMouseDown={e => e.preventDefault()} onClick={() => choose(s)} onMouseMove={() => setActive(i)}>
              <span>{s.label}</span>{!s.clinic_supported && <small>Not yet bookable</small>}</li>
          })}</ul></li>)}
      </ul>}
      <small id={helpId} className="field-help">
        {speciesStatus === 'error' ? 'The species list could not be loaded.' : legacyText && !value.speciesId ? `Previously recorded as “${legacyText}”. Please choose the matching species.` : 'Type to search, or open the list to browse by group.'}
        {speciesStatus === 'error' && <> <button type="button" className="button-quiet" onClick={onRetrySpecies}>Retry</button></>}
      </small>
      {selected && !selected.clinic_supported && <p className="alert alert-info" role="note">Online booking for {selected.label.toLowerCase()} is not available yet. You can still register the patient.</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <span className="visually-hidden" role="status" aria-live="polite">{open ? `${flat.length} species available` : ''}</span>
    </div>
    <div className="field">
      <label htmlFor={breedId}>Breed (optional)</label>
      <select id={breedId} disabled={ctl.disabled} value={value.breedId ?? ''} aria-describedby={`${breedId}-help`}
        onChange={e => onChange({ speciesId: value.speciesId, breedId: e.target.value || null })}>
        <option value="">{value.speciesId ? 'No breed selected' : 'Choose a species first'}</option>
        {breeds.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      <small id={`${breedId}-help`} className="field-help" role={breedStatus === 'loading' ? 'status' : undefined}>{ctl.hint}
        {breedStatus === 'error' && <> <button type="button" className="button-quiet" onClick={() => setBreedTry(n => n + 1)}>Retry</button></>}</small>
    </div>
  </>
}
