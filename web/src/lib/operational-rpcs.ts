/** Source-only #18/#19 operational RPC contract for CLOUD. No browser-side SQL writes. */
export const operationalFeatureFlags = {
  staffApprovalWrites: import.meta.env.VITE_STAFF_APPROVAL_WRITES_ENABLED === 'true',
  inventoryWrites: import.meta.env.VITE_INVENTORY_WRITES_ENABLED === 'true',
} as const;

export type StaffRole = 'administrator' | 'veterinarian' | 'receptionist' | 'accountant';
export type StaffRequestState = 'pending' | 'approved' | 'rejected' | 'inactive' | 'revoked';
export type ReviewAction = 'approve' | 'reject' | 'inactivate' | 'revoke' | 'role_change';
export type InventoryCategory = 'medicine' | 'consumable' | 'supply';
export type InventoryWriteRole = 'administrator' | 'receptionist';
export type OperationalSqlState = '42501' | '22023' | '23505' | '23514' | '40001';

export type StaffAccessRequest = {
  kind: 'staff_request'; state: 'pending'; revision: number; branchId: string;
};
export type MyStaffAccess = {
  kind: 'my_staff_access'; state: StaffRequestState | 'none';
  role: StaffRole | null; branches: string[];
};
export type StaffAccessListItem = {
  userId: string; requestedBranchId: string; state: StaffRequestState;
  revision: number; requestedAt: string; reviewedAt: string | null;
};
export type StaffAccessList = {
  kind: 'staff_requests'; branchId: string; items: StaffAccessListItem[];
};
export type StaffReviewResult = {
  kind: 'staff_review'; userId: string; state: StaffRequestState;
  role: StaffRole | null; branches: string[]; revision: number;
};
export type InventoryItemResult = {
  kind: 'inventory_item'; itemId: string; branchId: string;
  productCode: string; category: InventoryCategory; unit: string;
  revision: number; onHandUnits: number; batchId: string | null;
};
export type InventoryReceivedResult = {
  kind: 'stock_received'; branchId: string; itemId: string; batchId: string;
  receivedUnits: number; lotOnHandUnits: number; actorId: string; eventId: string;
};
export type InventoryEditedResult = {
  kind: 'inventory_item_updated'; branchId: string; itemId: string;
  revision: number; name: string; description: string;
  reorderPointUnits: number; expiryWarningDays: 30 | 60 | 90;
};
export type InventoryBalance = {
  kind: 'inventory_balance'; branchId: string; itemId: string;
  productCode: string; revision: number; onHandUnits: number;
  availableUnits: number; reservedUnits: number; quarantinedUnits: number;
};

/** SQL rpc names and the exact named PostgREST parameter keys. */
export const operationalRpcNames = {
  requestStaff: 'request_staff_access',
  listRequests: 'list_staff_access_requests',
  reviewStaff: 'review_staff_access',
  myStaff: 'get_my_staff_access',
  createItem: 'create_branch_inventory_item',
  receive: 'receive_branch_inventory_stock',
  editItem: 'edit_branch_inventory_item',
  balance: 'get_branch_inventory_balance',
} as const;
export type ReviewStaffArgs = {
  p_target: string; p_action: ReviewAction;
  p_role: StaffRole | null; p_branches: string[] | null;
  p_expected_revision: number; p_request_id: string;
};
export type CreateInventoryItemArgs = {
  p_branch: string; p_request_id: string; p_product_code: string;
  p_name: string; p_description: string; p_category: InventoryCategory;
  p_unit: string; p_formulation: string | null; p_strength: string | null;
  p_reorder_point: number; p_lot: string | null; p_expiry: string | null;
  p_supplier: string | null; p_opening_units: number;
};
export type ReceiveStockArgs = {
  p_branch: string; p_medicine: string; p_request_id: string;
  p_lot: string; p_expiry: string; p_supplier: string | null; p_quantity: number;
};
export type EditBranchInventoryItemArgs = {
  p_branch: string; p_medicine: string; p_expected_revision: number;
  p_name: string; p_description: string; p_reorder_point: number;
  p_expiry_warning_days: 30 | 60 | 90;
};
export type OperationalError = { code: string; message: string };
export function describeOperationalError(error: OperationalError): string {
  switch (error.code as OperationalSqlState) {
    case '42501': return 'Your session or branch permission is no longer valid. Please sign in or contact an administrator.';
    case '22023': return 'Please correct the invalid fields.';
    case '23505': return 'This identifier or request was already used with different details.';
    case '23514': return 'The requested state or inventory quantity is not allowed.';
    case '40001': return 'This record changed. Refresh and try again using its current revision.';
    default: return 'The operation could not be saved. No success should be shown.';
  }
}
