import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import type {OpsReadPort} from './read-port'
import {classifyOpsError, rangeWindow, dayWindow, validateCounts, validateWindow, weekDates} from './ops-model.mjs'
import type {OpsCounts, OpsErrorKind, OpsRole, OpsWindow} from './ops-model.mjs'

export type Read<T> =
  | {status: 'loading'}
  | {status: 'ok'; data: T}
  | {status: 'failed'; kind: OpsErrorKind}
export type SessionRead =
  | {status: 'verifying'}
  | {status: 'ok'; role: OpsRole}
  | {status: 'failed'; kind: OpsErrorKind}

/**
 * Loads the verified session, then the selected window, counts, and (week mode) seven independent
 * day windows. Responses are keyed by a request token so a stale response can never replace a newer
 * selection. Any failure is a failure state, never an empty list or a zero.
 */
export function useOpsData(port: OpsReadPort | null, date: string, range: string, weekMode: boolean) {
  const [session, setSession] = useState<SessionRead>({status: 'verifying'})
  const [day, setDay] = useState<Read<OpsWindow>>({status: 'loading'})
  const [counts, setCounts] = useState<Read<OpsCounts>>({status: 'loading'})
  const [week, setWeek] = useState<Record<string, Read<OpsWindow>>>({})
  const [nonce, setNonce] = useState(0)
  const token = useRef(0)

  // 1. Verified staff session (fail closed; no data requests until it succeeds).
  useEffect(() => {
    let live = true
    setSession({status: 'verifying'})
    if (!port) { setSession({status: 'failed', kind: 'unavailable'}); return }
    port.verify().then(
      s => { if (live) setSession({status: 'ok', role: s.role}) },
      e => { if (live) setSession({status: 'failed', kind: classifyOpsError(e)}) })
    return () => { live = false }
  }, [port, nonce])

  const ok = session.status === 'ok'

  // 2. Selected day/time-range window.
  useEffect(() => {
    if (!ok || !port) return
    const mine = ++token.current
    setDay({status: 'loading'})
    let w: {fromUtc: string; toUtc: string}
    try { w = rangeWindow(date, range) } catch (e) { setDay({status: 'failed', kind: 'error'}); return }
    port.window(w.fromUtc, w.toUtc).then(
      r => { if (token.current === mine) { try { setDay({status: 'ok', data: validateWindow(r)}) } catch { setDay({status: 'failed', kind: 'error'}) } } },
      e => { if (token.current === mine) setDay({status: 'failed', kind: classifyOpsError(e)}) })
  }, [ok, port, date, range, nonce])

  // 3. Dashboard counts (all dates).
  useEffect(() => {
    if (!ok || !port) return
    let live = true
    setCounts({status: 'loading'})
    port.counts().then(
      c => { if (live) { try { setCounts({status: 'ok', data: validateCounts(c)}) } catch { setCounts({status: 'failed', kind: 'error'}) } } },
      e => { if (live) setCounts({status: 'failed', kind: classifyOpsError(e)}) })
    return () => { live = false }
  }, [ok, port, nonce])

  // 4. Week: one bounded <=24h read per day, each independent.
  const weekKey = weekMode ? weekDates(date).join() : ''
  useEffect(() => {
    if (!ok || !port || !weekMode) return
    let live = true
    const days = weekKey.split(',')
    setWeek(Object.fromEntries(days.map(d => [d, {status: 'loading'} as Read<OpsWindow>])))
    for (const d of days) {
      const w = dayWindow(d)
      port.window(w.fromUtc, w.toUtc).then(
        r => { if (live) { let next: Read<OpsWindow>; try { next = {status: 'ok', data: validateWindow(r)} } catch { next = {status: 'failed', kind: 'error'} }; setWeek(p => ({...p, [d]: next})) } },
        e => { if (live) setWeek(p => ({...p, [d]: {status: 'failed', kind: classifyOpsError(e)}})) })
    }
    return () => { live = false }
  }, [ok, port, weekMode, weekKey, nonce])

  const reload = useCallback(() => setNonce(n => n + 1), [])
  return useMemo(() => ({session, day, counts, week, reload}), [session, day, counts, week, reload])
}
