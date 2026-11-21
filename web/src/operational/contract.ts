/**
 * CLOUD's UI-only type binding to ASTRA PR126 (fd91f7b) API. The canonical
 * backend-owned source web/src/lib/operational-rpcs.ts is NOT in PR125 ancestry.
 * Reconcile these exact declarations to that file in ASTRA's unified RC0.
 * This module contains no SQL, service credentials, or server implementation.
 */
export type StaffRole='administrator'|'veterinarian'|'receptionist'|'accountant'
export type StaffRequestState='pending'|'approved'|'rejected'|'inactive'|'revoked'
export type ReviewAction='approve'|'reject'|'inactivate'|'revoke'|'role_change'
export type InventoryCategory='medicine'|'consumable'|'supply'
export type StaffRequest={kind:'staff_request';state:'pending';revision:number;branchId:string}
export type MyStaffAccess={kind:'my_staff_access';state:StaffRequestState|'none';role:StaffRole|null;branches:string[]}
export type StaffListItem={userId:string;requestedBranchId:string;state:StaffRequestState;revision:number;requestedAt:string;reviewedAt:string|null}
export type StaffRequestList={kind:'staff_requests';branchId:string;items:StaffListItem[]}
export type StaffReview={kind:'staff_review';userId:string;state:StaffRequestState;role:StaffRole|null;branches:string[];revision:number}
export type ItemResult={kind:'inventory_item';itemId:string;branchId:string;productCode:string;category:InventoryCategory;unit:string;revision:number;onHandUnits:number;batchId:string|null}
export type ReceiptResult={kind:'stock_received';branchId:string;itemId:string;batchId:string;receivedUnits:number;lotOnHandUnits:number;actorId:string;eventId:string}
export type EditResult={kind:'inventory_item_updated';branchId:string;itemId:string;revision:number;name:string;description:string;reorderPointUnits:number;expiryWarningDays:30|60|90}
export type Balance={kind:'inventory_balance';branchId:string;itemId:string;productCode:string;revision:number;onHandUnits:number;availableUnits:number;reservedUnits:number;quarantinedUnits:number}
export type ReviewArgs={p_target:string;p_action:ReviewAction;p_role:StaffRole|null;p_branches:string[]|null;p_expected_revision:number;p_request_id:string}
export type ItemArgs={p_branch:string;p_request_id:string;p_product_code:string;p_name:string;p_description:string;p_category:InventoryCategory;p_unit:string;p_formulation:string|null;p_strength:string|null;p_reorder_point:number;p_lot:string|null;p_expiry:string|null;p_supplier:string|null;p_opening_units:number}
export type ReceiptArgs={p_branch:string;p_medicine:string;p_request_id:string;p_lot:string;p_expiry:string;p_supplier:string|null;p_quantity:number}
export type EditArgs={p_branch:string;p_medicine:string;p_expected_revision:number;p_name:string;p_description:string;p_reorder_point:number;p_expiry_warning_days:30|60|90}
