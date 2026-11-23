export type AppointmentAction='confirm'|'decline'|'check_in'|'complete'|'no_show'|'cancel'
export type AppointmentStatus='requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show'
export type AppointmentRole='administrator'|'veterinarian'|'receptionist'
export type AppointmentDetail={id:string;branchId:string;status:AppointmentStatus;revision:number;startsAt:string;endsAt:string;petId:string;ownerId:string;resourceId:string}
export type AppointmentAck={appointmentId:string;branchId:string;status:AppointmentStatus;revision:number;action:AppointmentAction}
export type AppointmentFailure='denied'|'conflict'|'nonce'|'policy'|'unavailable'|'uncertain'|'unverified'
export const ACTIONS:readonly AppointmentAction[]
export const STATES:readonly AppointmentStatus[]
export const ROLES:readonly AppointmentRole[]
export const STATUS_AFTER:Readonly<Record<AppointmentAction,AppointmentStatus>>
export const ACTION_COPY:Readonly<Record<AppointmentAction,string>>
export function isUuid(v:unknown):v is string
export function actionsFor(status:AppointmentStatus,role:AppointmentRole,linked?:boolean,startsAt?:string,nowMs?:number):AppointmentAction[]
export function verifyAppointmentDetail(raw:unknown,expected:unknown,branchId:string):AppointmentDetail
export function verifyTransitionReply(raw:unknown,expected:Pick<AppointmentDetail,'id'|'branchId'|'revision'>,action:AppointmentAction):AppointmentAck
export function transitionError(error:unknown):AppointmentFailure
