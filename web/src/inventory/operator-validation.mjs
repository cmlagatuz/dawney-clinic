/** Offline form guards only. They do not authorize stock mutation or replace SQL validation. */
import {isInventoryDate} from './model.mjs'
const CODE=/^[A-Z0-9][A-Z0-9._-]{1,39}$/
const UNIT=/^[a-z][a-z0-9_-]{1,29}$/
const safe=(s,min,max)=>typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(s)
const count=v=>typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v)&&Number.isSafeInteger(Number(v))&&Number(v)<=1000000000
export const PRODUCT_TYPES=Object.freeze(['medicine','consumable','supply'])
export function validateNewItem(x){
 const errors={}
 if(!PRODUCT_TYPES.includes(x.type))errors.type='Choose medicine, consumable or supply.'
 if(!CODE.test(String(x.code||'')))errors.code='Use 2–40 uppercase letters, numbers, dots, hyphens or underscores.'
 if(!safe(x.name,2,160))errors.name='Enter a description between 2 and 160 characters.'
 if(!UNIT.test(String(x.unit||'')))errors.unit='Use a lowercase stock unit, such as vial, each or box.'
 if(x.type==='medicine'){
  if(!safe(x.formulation,2,80))errors.formulation='Medicine formulation is required (2–80 characters).'
  if(!safe(x.strength,1,80))errors.strength='Medicine strength is required (1–80 characters).'
 }
 if(x.reorder!==''&&(!count(x.reorder)))errors.reorder='Reorder point must be a whole, nonnegative unit count.'
 if(x.supplier!==''&&!safe(x.supplier,2,120))errors.supplier='Supplier reference is too long or invalid.'
 return Object.freeze(errors)
}
export function validateReceipt(x,branchDate){
 const errors={}
 if(!CODE.test(String(x.code||'')))errors.code='Select a valid existing item code; the server must verify the item.'
 if(!safe(x.lot,1,80))errors.lot='Lot number is required (1–80 characters).'
 if(!count(x.quantity)||Number(x.quantity)<1)errors.quantity='Receive a positive whole number of stock units (up to 1,000,000,000).'
 if(!isInventoryDate(x.receivedOn))errors.receivedOn='Enter an existing calendar date.'
 if(!isInventoryDate(x.expiresOn))errors.expiresOn='Enter an existing expiry date.'
 if(isInventoryDate(x.receivedOn)&&isInventoryDate(x.expiresOn)&&x.expiresOn<x.receivedOn)
  errors.expiresOn='Expiry cannot precede the receipt date.'
 if(isInventoryDate(branchDate)&&isInventoryDate(x.expiresOn)&&x.expiresOn<=branchDate)
  errors.expiresOn='Expired stock is not eligible for normal receiving. Hold for authorized quarantine review.'
 if(!safe(x.branchId,1,64))errors.branchId='Select a currently authorized branch.'
 if(x.supplier!==''&&!safe(x.supplier,2,120))errors.supplier='Invalid supplier reference.'
 return Object.freeze(errors)
}
export const validDraft=errors=>Object.keys(errors).length===0
