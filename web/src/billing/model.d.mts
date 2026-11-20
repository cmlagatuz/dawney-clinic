export type BillingStatus='draft'|'issued'|'paid'|'voided'|'refunded'
export type BillingKind='estimate'|'invoice'
export type BillingFailure='denied'|'unavailable'|'network'|'error'
export type MoneyTotals={subtotal_minor:number;discount_minor:number;tax_minor:number;total_minor:number;
 paid_minor:number;refunded_minor:number;balance_minor:number}
export type Invoice={id:string;branch_id:string;owner_id:string;pet_id:string;appointment_id:string|null;
 invoice_no:string;kind:BillingKind;status:BillingStatus;created_at:string;
 currency_code:string;minor_scale:number;totals:MoneyTotals}
export type BillingWindow={items:Invoice[];hasMore:boolean}
export type InvoiceLine={id:string;invoice_id:string;category:'service'|'medication'|'fee'|'adjustment';
 description:string;quantity:number;unit_label:string;unit_price_minor:number|null;line_total_minor:number}
export type Payment={id:string;invoice_id:string;amount_minor:number;occurred_at:string;
 status:'pending'|'settled'|'reversed';method_label:string}
export type Receipt={id:string;invoice_id:string;payment_id:string;receipt_no:string;
 amount_minor:number;issued_at:string}
export type InvoiceDetail={header:Invoice;lines:InvoiceLine[];payments:Payment[];receipts:Receipt[]}
export const BILLING_STATUSES:readonly BillingStatus[]
export const BILLING_KINDS:readonly BillingKind[]
export const BILLING_CATEGORIES:readonly InvoiceLine['category'][]
export const BILLING_LIMIT:number
export function isBillingId(value:unknown):value is string
export function billingFailure(error:unknown):BillingFailure
export function billingList(rows:unknown,branch:string):BillingWindow
export function billingDetail(rows:unknown,branch:string,id:string):InvoiceDetail
export function displayAmount(minor:number,currency:string,scale:number):string
export function shownInvoices(items:Invoice[],filter?:{query?:string;status?:string}):Invoice[]
