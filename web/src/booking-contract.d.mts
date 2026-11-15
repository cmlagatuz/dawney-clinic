export type PublicBookingIntent={serviceId:string;resourceId?:string;startsAtUtc?:string}
export const BOOKING_RETURN_PATH:'/book'
export function validUtcInstant(value:unknown):boolean
export function validateBookingIntent(value:unknown):PublicBookingIntent
export type BookingRequestIds={petId:string;serviceId:string;resourceId:string;requestNonce:string}
export function normalizeBookingRequestIds(value:unknown):BookingRequestIds
export function persistedBookingIdsMatch(row:unknown,ids:BookingRequestIds):boolean
export function saveBookingIntent(
 sessionStore:Pick<Storage,'setItem'>,value:PublicBookingIntent,nowMs?:number
):'/book'
export function readBookingIntent(
 sessionStore:Pick<Storage,'getItem'|'removeItem'>,nowMs?:number
):PublicBookingIntent|null
export function clearBookingIntent(sessionStore:Pick<Storage,'removeItem'>|null):void
export function signinForBooking(mode?:'signin'|'signup'):string
export function safeBookingReturnPath(untrusted:unknown):'/book'|'/app/profile'
export function clinicSlotToUtc(date:string,time:string,timezone:string):string
export function utcToClinicSlot(utcIso:string,timezone:string):{
 date:string;time:string;timezone:string
}
