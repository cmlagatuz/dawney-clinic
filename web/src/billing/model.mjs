// CLOUD — finance display contract. No network, persistence, pricing assumptions or charge math.
// All money is approved server-provided integer minor units plus an explicit per-invoice scale.
export const BILLING_STATUSES=Object.freeze(['draft','issued','paid','voided','refunded'])
export const BILLING_KINDS=Object.freeze(['estimate','invoice'])
export const BILLING_CATEGORIES=Object.freeze(['service','medication','fee','adjustment'])
export const BILLING_LIMIT=100
const idRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const dateOk=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/[zZ]|[+-]\d\d:\d\d$/.test(x)
const money=n=>Number.isSafeInteger(n)&&n>=0
const integer=n=>Number.isSafeInteger(n)
const str=(x,n=140)=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=n
function reject(){throw Error('Invalid authorized billing response')}
export function isBillingId(x){return typeof x==='string'&&idRe.test(x)}
export function billingFailure(err){
 const c=String(err&&typeof err==='object'&&'code' in err?err.code:'')
 const m=String(err&&typeof err==='object'&&'message' in err?err.message:err??'').toLowerCase()
 if(c==='42501'||c==='401'||c==='403'||c==='PGRST301'||/jwt|access denied|access is not approved|not authorized|permission denied|expired session/.test(m))return 'denied'
 if(c==='BILLING_READER_NOT_INTEGRATED'||/billing reader not integrated/.test(m))return 'unavailable'
 if(/failed to fetch|networkerror|offline|timeout|network request|load failed/.test(m))return 'network'
 return 'error'
}
function totals(v){
 if(!v||typeof v!=='object')reject()
 const names=['subtotal_minor','discount_minor','tax_minor','total_minor','paid_minor','refunded_minor','balance_minor']
 if(!names.every(k=>money(v[k])))reject()
 if(!Number.isSafeInteger(v.subtotal_minor-v.discount_minor+v.tax_minor)||
     v.subtotal_minor-v.discount_minor+v.tax_minor!==v.total_minor)reject()
 if(v.paid_minor<v.refunded_minor||
     v.paid_minor-v.refunded_minor+v.balance_minor!==v.total_minor)reject()
 return Object.fromEntries(names.map(k=>[k,v[k]]))
}
function invoice(row,branch){
 if(!row||typeof row!=='object'||!isBillingId(row.id)||row.branch_id!==branch||
    !isBillingId(row.owner_id)||!isBillingId(row.pet_id)||
    (row.appointment_id!==null&&!isBillingId(row.appointment_id))||
    !str(row.invoice_no,55)||!BILLING_KINDS.includes(row.kind)||
    !BILLING_STATUSES.includes(row.status)||!dateOk(row.created_at)||
    !/^[A-Z]{3}$/.test(row.currency_code)||!Number.isInteger(row.minor_scale)||
    row.minor_scale<0||row.minor_scale>3)reject()
 return {id:row.id,branch_id:branch,owner_id:row.owner_id,pet_id:row.pet_id,
   appointment_id:row.appointment_id,invoice_no:row.invoice_no.trim(),kind:row.kind,
   status:row.status,created_at:row.created_at,currency_code:row.currency_code,
   minor_scale:row.minor_scale,totals:totals(row.totals)}
}
export function billingList(raw,branch){
 if(!isBillingId(branch)||!raw||!Array.isArray(raw.items)||
    raw.items.length>BILLING_LIMIT||typeof raw.hasMore!=='boolean')reject()
 const rows=raw.items.map(x=>invoice(x,branch))
 if(new Set(rows.map(x=>x.id)).size!==rows.length)reject()
 return {items:rows.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||
   a.id.localeCompare(b.id)),hasMore:raw.hasMore}
}
export function billingDetail(raw,branch,id){
 if(!isBillingId(id)||!raw||typeof raw!=='object')reject()
 const header=invoice(raw.header,branch)
 if(header.id!==id||!Array.isArray(raw.lines)||!Array.isArray(raw.payments)||
   !Array.isArray(raw.receipts)||raw.lines.length>200||
   raw.payments.length>100||raw.receipts.length>100)reject()
 const lines=raw.lines.map(l=>{
   if(!l||!isBillingId(l.id)||l.invoice_id!==id||
      !BILLING_CATEGORIES.includes(l.category)||!str(l.description,180)||
      !integer(l.quantity)||l.quantity<=0||!str(l.unit_label,32)||
      (l.unit_price_minor!==null&&!integer(l.unit_price_minor))||
      !integer(l.line_total_minor))reject()
   return {id:l.id,invoice_id:id,category:l.category,description:l.description,
     quantity:l.quantity,unit_label:l.unit_label,unit_price_minor:l.unit_price_minor,
     line_total_minor:l.line_total_minor}
 })
 const payments=raw.payments.map(x=>{
   if(!x||!isBillingId(x.id)||x.invoice_id!==id||!money(x.amount_minor)||
      !dateOk(x.occurred_at)||!['pending','settled','reversed'].includes(x.status)||
      !str(x.method_label,60))reject()
   return {id:x.id,invoice_id:id,amount_minor:x.amount_minor,
     occurred_at:x.occurred_at,status:x.status,method_label:x.method_label}
 })
 const paymentIds=new Set(payments.map(x=>x.id))
 const receipts=raw.receipts.map(x=>{
   if(!x||!isBillingId(x.id)||x.invoice_id!==id||!paymentIds.has(x.payment_id)||
      !str(x.receipt_no,60)||!money(x.amount_minor)||!dateOk(x.issued_at))reject()
   return {id:x.id,invoice_id:id,payment_id:x.payment_id,receipt_no:x.receipt_no,
     amount_minor:x.amount_minor,issued_at:x.issued_at}
 })
 for(const arr of [lines,payments,receipts]){
   if(new Set(arr.map(x=>x.id)).size!==arr.length)reject()
 }
 return {header,lines,payments,receipts}
}
export function displayAmount(minor,currency,scale){
 if(!integer(minor)||!/^[A-Z]{3}$/.test(currency)||
    !Number.isInteger(scale)||scale<0||scale>3)reject()
 const negative=minor<0?'-':''
 const digits=String(Math.abs(minor)).padStart(scale+1,'0')
 const whole=scale?digits.slice(0,-scale):digits
 const frac=scale?'.'+digits.slice(-scale):''
 return negative+currency+' '+Number(whole).toLocaleString('en-US')+frac
}
export function shownInvoices(items,{query='',status='all'}={}){
 const q=String(query).trim().toLowerCase()
 if(status!=='all'&&!BILLING_STATUSES.includes(status))return []
 return items.filter(x=>(status==='all'||x.status===status)&&
   (!q||x.invoice_no.toLowerCase().includes(q)||
       x.id.toLowerCase().includes(q)||
       x.kind.includes(q)))
}
