export type ItemType='medicine'|'consumable'|'supply'
export type NewItemDraft={type:ItemType;code:string;name:string;unit:string;formulation:string;strength:string;reorder:string;supplier:string}
export type ReceiptDraft={branchId:string;code:string;lot:string;quantity:string;receivedOn:string;expiresOn:string;supplier:string}
export const PRODUCT_TYPES:ReadonlyArray<ItemType>
export function validateNewItem(x:NewItemDraft):Readonly<Record<string,string>>
export function validateReceipt(x:ReceiptDraft,branchDate:string):Readonly<Record<string,string>>
export function validDraft(errors:Readonly<Record<string,string>>):boolean
