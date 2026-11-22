export type ClinicalSectionId='overview'|'visits'|'history'|'encounter'|'treatments'|'vaccinations'|'prescriptions'
export type DraftSection='encounter'|'treatments'|'vaccinations'|'prescriptions'
export type DraftField={id:string;label:string;required:boolean;max:number}
export const CLINICAL_SECTIONS:readonly {id:ClinicalSectionId;label:string}[]
export const DRAFT_FIELDS:Readonly<Record<DraftSection,readonly DraftField[]>>
export function newDraft(kind:DraftSection):Record<string,string>
export function validateClinicalDraft(kind:DraftSection,data:Record<string,string>):{valid:boolean;errors:Record<string,string>}
export function selectPatientVisits<T extends {pet_id:string;starts_at:string}>(window:{items:T[]}|null,petId:string):T[]
