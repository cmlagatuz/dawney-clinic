export type FlowStatus = 'expected' | 'waiting' | 'consult' | 'seen' | 'noshow'
export type Appt = { id: string; day: string; start: string; dur: number; vetId: string; roomId: string; pet: string; species: string; owner: string; reason: string; status: FlowStatus }
export type Block = { id: string; day: string; start: string; end: string; vetId: string | null; kind: 'lunch' | 'blocked'; label: string }
export type Msg = { id: string; from: 'owner' | 'clinic'; text: string; status?: 'SIMULATED' }
export type Thread = { id: string; owner: string; pet: string; unread: number; assignedTo: string | null; labels: string[]; messages: Msg[] }
export type Recipient = { id: string; label: string; consent: 'opted_in' | 'opted_out' | 'none' }
export type CampaignStatus = 'draft' | 'scheduled' | 'preview'
export type Campaign = { id: string; name: string; blurb: string; segment: string[]; status: CampaignStatus }
export type AlphaState = { appts: Appt[]; history: Array<{ id: string; from: FlowStatus }>; threads: Thread[]; campaigns: Campaign[] }
export type AlphaAction =
  | { type: 'flow/move'; id: string; to: FlowStatus } | { type: 'flow/undoCard'; id: string } | { type: 'flow/undoLast' }
  | { type: 'inbox/open'; id: string } | { type: 'inbox/assign'; id: string; to: string | null } | { type: 'inbox/label'; id: string; label: string } | { type: 'inbox/send'; id: string; text: string }
  | { type: 'camp/schedule' | 'camp/unschedule' | 'camp/preview' | 'camp/reset'; id: string }
export const TODAY: string
export const DAYS: Array<[string, string]>
export const VETS: Array<{ id: string; name: string; tone: number }>
export const ROOMS: Array<{ id: string; name: string }>
export const DAY_START: number
export const DAY_END: number
export const FLOW_COLUMNS: Array<{ id: FlowStatus; label: string; hint: string }>
export const TRANSITIONS: Record<FlowStatus, Array<{ to: FlowStatus; label: string }>>
export const APPOINTMENTS: Appt[]
export const BLOCKS: Block[]
export const ASSIGNEES: Array<{ id: string; label: string }>
export const QUICK_REPLIES: Array<{ id: string; label: string; text: string }>
export const RECIPIENTS: Recipient[]
export function toMin(hhmm: string): number
export function fromMin(n: number): string
export function endOf(ap: { start: string; dur: number }): string
export function clock12(hhmm: string): string
export function initialState(): AlphaState
export function audience(c: Campaign, recipients?: Recipient[]): { total: number; included: Recipient[]; optedOut: Recipient[]; noConsent: Recipient[] }
export function kpis(s: AlphaState): { today: number; waiting: number; consult: number; seen: number; noshow: number; unread: number; roomsBusy: number; roomsTotal: number }
export function reduce(s: AlphaState, a: AlphaAction): AlphaState
export function visibleAppts(appts: Appt[], o: { vetIds: string[]; day?: string }): Appt[]
export function blocksFor(blocks: Block[], o: { vetIds: string[]; day?: string }): Block[]
export function pct(min: number, base?: number, span?: number): number
export function alphaPreviewAllowed(hostname: string | null | undefined): boolean
export function canUndo(s: AlphaState, id: string): boolean
