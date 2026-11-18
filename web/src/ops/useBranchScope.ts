import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import type {OpsBranchPort, OpsReadPort} from './read-port'
import {classifyOpsError, type OpsErrorKind} from './ops-model.mjs'
import {initialSelection, isOfferedBranch, type OpsBranch} from './branch-model.mjs'

export type ScopeState =
  | {status: 'off'}                                  // no branch port wired: legacy unscoped page
  | {status: 'loading'}
  | {status: 'failed'; kind: OpsErrorKind}           // includes 'denied' (no verified membership)
  | {status: 'ready'; branches: OpsBranch[]}

/**
 * Derives the branches to offer from verified server rows, owns the (non-authoritative) selection,
 * and exposes a per-selection scoped read port whose verify() is the server's assert_staff_branch.
 * A new account/port clears everything; late responses from an earlier load/selection are ignored.
 */
export function useBranchScope(port: OpsReadPort | null) {
  const bp: OpsBranchPort | null = port?.branch ?? null
  // Everything below is tagged with the port (= account) it belongs to; state from another account is never read.
  const [raw, setState] = useState<{bp: OpsBranchPort | null; s: ScopeState}>({bp, s: bp ? {status: 'loading'} : {status: 'off'}})
  const [sel, setSel] = useState<{bp: OpsBranchPort | null; id: string | null}>({bp, id: null})
  const state: ScopeState = raw.bp === bp ? raw.s : bp ? {status: 'loading'} : {status: 'off'}
  const selected = sel.bp === bp ? sel.id : null
  const setSelected = (f: (prev: string | null) => string | null) => setSel(p => ({bp, id: f(p.bp === bp ? p.id : null)}))
  const [nonce, setNonce] = useState(0)
  // Branches the SERVER denied during this session: hidden until a manual retry (prevents a denial loop).
  const [blocked, setBlocked] = useState<string[]>([])
  const blockedRef = useRef<string[]>([]); blockedRef.current = blocked

  useEffect(() => {
    let live = true
    setSel({bp, id: null})
    if (!bp) { setState({bp, s: {status: 'off'}}); return }
    setState({bp, s: {status: 'loading'}})
    bp.load().then(
      r => {
        if (!live) return
        if (r.branches.length === 0) { setState({bp, s: {status: 'failed', kind: 'denied'}}); return }
        setState({bp, s: {status: 'ready', branches: r.branches}})
        setSelected(prev => prev && isOfferedBranch(r.branches, prev) ? prev : blockedRef.current.length ? null : initialSelection(r.branches))
      },
      e => { if (live) setState({bp, s: {status: 'failed', kind: classifyOpsError(e)}}) })
    return () => { live = false }
  }, [bp, nonce])
  const [blockedFor, setBlockedFor] = useState<OpsBranchPort | null>(bp)
  useEffect(() => { setBlocked([]); setBlockedFor(bp) }, [bp])

  const all = state.status === 'ready' ? state.branches : []
  const live = blockedFor === bp ? blocked : []
  const branches = useMemo(() => all.filter(b => !live.includes(b.id)), [all, live])
  const view: ScopeState = state.status === 'ready' && branches.length === 0 ? {status: 'failed', kind: 'denied'}
    : state.status === 'ready' ? {status: 'ready', branches} : state
  /** Forged / not-offered ids are ignored: they never reach a server read. */
  const select = useCallback((id: string | null) => {
    if (id === null) { setSelected(() => null); return }
    setSelected(prev => isOfferedBranch(branches, id) ? id : prev)
  }, [branches, bp])
  /** Manual retry: forget local denials and re-read memberships from the server. */
  const refresh = useCallback(() => { setBlocked([]); setNonce(n => n + 1) }, [])
  /** The server denied this branch (revoked/not authorized): hide it and re-derive from the server. */
  const markDenied = useCallback((id: string | null) => { if (id) setBlocked(p => p.includes(id) ? p : [...p, id]); setNonce(n => n + 1) }, [])

  const active = view.status === 'ready' && selected && isOfferedBranch(branches, selected) ? selected : null
  const role = active ? branches.find(b => b.id === active)?.role ?? null : null
  // The port the data hook reads through: verify() == server authorization of THIS selection.
  const scoped = useMemo<OpsReadPort | null>(() => {
    if (!bp || !active || !role) return null
    return {
      verify: async () => { await bp.assertBranch(active); return {userId: '', role} },
      window: (f, t) => bp.window(active, f, t),
      counts: () => bp.counts(active)
    }
  }, [bp, active, role])
  return {state: view, branches, selected: active, select, refresh, markDenied, scoped, hadDenial: live.length > 0}
}
