import type {PublicBookingIntent} from './booking-contract.mjs'
export function resolveAfterAuth(nextParam:unknown,storedIntent:PublicBookingIntent|null):{
 toBook:boolean;needsReselect:boolean;dest:'/book'|'/app/overview';suffix:''|'?next=%2Fbook'
}
export function authCallbackUrl(origin:string,toBook:boolean):string
