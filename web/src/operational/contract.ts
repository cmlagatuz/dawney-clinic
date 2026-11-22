/** One canonical ASTRA backend RPC type contract. CLOUD's public type names
 * are stable aliases, not a second independent signature or privileged API.
 * All operations remain server-authorized and default-write-DISABLED. */
export type {
  StaffRole,StaffRequestState,ReviewAction,InventoryCategory,
  MyStaffAccess,OperationalError,
} from '../lib/operational-rpcs'
export type {
  StaffAccessRequest as StaffRequest,
  StaffAccessList as StaffRequestList,
  StaffAccessListItem as StaffListItem,
  StaffReviewResult as StaffReview,
  InventoryItemResult as ItemResult,
  InventoryReceivedResult as ReceiptResult,
  InventoryEditedResult as EditResult,
  InventoryBalance as Balance,
  ReviewStaffArgs as ReviewArgs,
  CreateInventoryItemArgs as ItemArgs,
  ReceiveStockArgs as ReceiptArgs,
  EditBranchInventoryItemArgs as EditArgs,
} from '../lib/operational-rpcs'
