import type { ApprovedClinicSchedule } from '../lib/public-booking'
export type SlotDay = { date: string; weekday: string; slots: { time: string; startsAtUtc: string }[] }
export function isUsablePolicy(p: ApprovedClinicSchedule | null | undefined): boolean
export function generateSlots(policy: ApprovedClinicSchedule | null, durationMinutes: number, nowMs?: number): SlotDay[]
export function formatClockTime(hhmm: string): string
export function formatClinicDate(date: string): string
