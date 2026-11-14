export type SpeciesLike = { id: string; label: string; group_name: string; scientific_name: string | null; is_active: boolean }
export type SpeciesGroupView<T extends SpeciesLike = SpeciesLike> = { group: string; label: string; items: T[] }
export type UploadState = { status: 'idle' | 'ready' | 'uploading' | 'saved' | 'unindexed' | 'error'; file: File | null; message: string; objectPath: string | null }
export type UploadAction =
  | { type: 'select'; file: File } | { type: 'invalid'; message: string } | { type: 'remove' }
  | { type: 'start' } | { type: 'saved' } | { type: 'unindexed'; objectPath: string } | { type: 'error'; message: string }
export const GROUP_ORDER: readonly string[]
export const GROUP_LABELS: Record<string, string>
export const emptyUpload: UploadState
export function normalizeSearch(text: unknown): string
export function groupSpecies<T extends SpeciesLike>(options: readonly T[], query?: string): SpeciesGroupView<T>[]
export function flattenGroups<T extends SpeciesLike>(groups: SpeciesGroupView<T>[]): T[]
export function selectSpecies(state: { speciesId: string | null; breedId: string | null }, speciesId: string): { speciesId: string | null; breedId: string | null }
export function breedControl(speciesId: string | null, status: 'idle' | 'loading' | 'ready' | 'error', count: number): { disabled: boolean; hint: string }
export function breedIsLoadedFor(breedId: string | null, breeds: readonly { id: string }[]): boolean
export function uploadReducer(state: UploadState, action: UploadAction): UploadState
export function pendingUploads(uploads: Record<string, UploadState>): string[]
export function friendlyUploadError(err: unknown): string
export function formatBytes(n: number): string
