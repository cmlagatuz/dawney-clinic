export declare function cleanPet(value: unknown): {
  name:string; species:string; breed:string|null; color:string|null;
  sex:'male'|'female'|'unknown';birth_date:string|null;
}
export declare function cleanBooking(value:unknown,now?:Date): {
  pet_id:string;resource_id:string;starts_at:string;ends_at:string;
  concern:string;details:string|null;
}
export declare function friendlyBookingError(code: unknown): string