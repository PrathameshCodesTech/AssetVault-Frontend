export type UserRole = 'super_admin' | 'location_admin' | 'employee' | 'third_party';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locationId?: string;
  locationName?: string;
  avatar?: string;
  assignedLocationIds?: string[]; // For third-party operators - restricted locations
}

// ---- Location Hierarchy ----
export type LocationLevel =
  | 'company' | 'country' | 'region' | 'zone' | 'site'
  | 'entity' | 'building' | 'wing' | 'area' | 'floor'
  | 'unit' | 'room';

export const LOCATION_LEVELS: LocationLevel[] = [
  'company', 'country', 'region', 'zone', 'site',
  'entity', 'building', 'wing', 'area', 'floor',
  'unit', 'room',
];

export const LOCATION_LEVEL_LABELS: Record<LocationLevel, string> = {
  company: 'Company',
  country: 'Country',
  region: 'Region',
  zone: 'Zone',
  site: 'Site',
  entity: 'Entity',
  building: 'Building',
  wing: 'Wing',
  area: 'Area',
  floor: 'Floor',
  unit: 'Unit',
  room: 'Room',
};

export interface LocationNode {
  id: string;
  name: string;
  level: LocationLevel;
  parentId: string | null;
  code: string;
  children?: LocationNode[];
}

export interface LocationPath {
  [key: string]: string; // level -> locationNodeId
}

export interface AssetDetails {
  subNumber?: string;
  assetClass?: string;
  costCenter?: string;
  intOrder?: string;
  assetDescription?: string;
  usefulLife?: string;
  usefulLifeInPeriods?: string;
  supplier?: string;
  currency?: string;
  capitalizedOn?: string;
  apcFyStart?: string;
  acquisition?: string;
  retirement?: string;
  transfer?: string;
  postCapital?: string;
  currentApc?: string;
  depFyStart?: string;
  depForYear?: string;
  depRetirement?: string;
  depTransfer?: string;
  writeUps?: string;
  depPostCap?: string;
  accumulDep?: string;
  bkValFyStart?: string;
  currBkVal?: string;
  deactivationOn?: string;
}

export interface WfhDetails {
  serialNumber?: string;
  location?: string;
  entity?: string;
  asset?: string;
  uid?: string;
  userName?: string;
  userEmailId?: string;
}

export interface Asset {
  id: string;
  assetId: string;
  serialNumber: string;
  tagNumber: string;
  name: string;
  description: string;
  category: string;
  subAssetType?: string;
  entity?: string;
  subLocation?: string;
  locationId: string;
  locationName: string;
  locationPath?: LocationPath;
  locationBreadcrumb?: string;
  assignedTo: string;
  assignedToName: string;
  status: 'active' | 'in_transit' | 'disposed' | 'missing' | 'pending_verification';
  reconciliationStatus: 'verified' | 'pending' | 'discrepancy';
  purchaseDate: string;
  purchaseValue: number;
  imageUrl?: string;
  qrCode?: string;
  qrUid?: string;
  images?: { id: string; url: string; image_type: string; is_primary: boolean }[];
  lastVerified?: string;
  createdAt: string;
  updatedAt: string;
  assetDetails?: AssetDetails;
  wfhDetails?: WfhDetails;
}

export interface AssetHistory {
  id: string;
  assetId: string;
  action: 'registered' | 'moved' | 'reassigned' | 'verified' | 'updated' | 'disposed';
  description: string;
  performedBy: string;
  performedByName: string;
  fromLocation?: string;
  toLocation?: string;
  timestamp: string;
  imageUrl?: string;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  totalAssets: number;
  verifiedAssets: number;
}

export interface DashboardSummary {
  totalAssets: number;
  pendingReconciliation: number;
  verifiedAssets: number;
  discrepancies: number;
  recentActivity: AssetHistory[];
  locationBreakdown: { locationName: string; total: number; verified: number }[];
  reconciliationProgress: number;
}

export interface ReconciliationSubmission {
  assetId: string;
  locationConfirmed: boolean;
  locationId: string;
  imageFile?: File;
  notes?: string;
}

// ---- Third-Party Submissions ----
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'correction_requested';

export interface ThirdPartySubmission {
  id: string;
  type: 'verification' | 'new_asset';
  assetId?: string;        // If verifying existing
  tempRefId?: string;      // If new asset
  assetName?: string;
  serialNumber?: string;
  assetType?: string;
  locationBreadcrumb: string;
  locationPath: LocationPath;
  photoUrl: string;
  remarks?: string;
  status: SubmissionStatus;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

// ---- Column definitions for dynamic selector ----
export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  group: 'basic' | 'details' | 'depreciation' | 'wfh';
}

export const ASSET_COLUMNS: ColumnDef[] = [
  // Basic (default visible)
  { key: 'entity', label: 'Entity', defaultVisible: true, group: 'basic' },
  { key: 'assetId', label: 'Asset', defaultVisible: true, group: 'basic' },
  { key: 'serialNumber', label: 'Serial Number', defaultVisible: true, group: 'basic' },
  { key: 'category', label: 'Asset Type', defaultVisible: true, group: 'basic' },
  { key: 'subAssetType', label: 'Sub Asset Type', defaultVisible: true, group: 'basic' },
  { key: 'locationName', label: 'Location', defaultVisible: true, group: 'basic' },
  { key: 'subLocation', label: 'Sub Location', defaultVisible: true, group: 'basic' },
  { key: 'status', label: 'Status', defaultVisible: true, group: 'basic' },
  { key: 'reconciliationStatus', label: 'Reconciliation', defaultVisible: false, group: 'basic' },
  { key: 'assignedToName', label: 'Assigned To', defaultVisible: false, group: 'basic' },
  { key: 'purchaseDate', label: 'Purchase Date', defaultVisible: false, group: 'basic' },
  { key: 'purchaseValue', label: 'Purchase Value', defaultVisible: false, group: 'basic' },
  // Asset Details
  { key: 'costCenter', label: 'Cost Center', defaultVisible: false, group: 'details' },
  { key: 'supplier', label: 'Supplier', defaultVisible: false, group: 'details' },
  { key: 'currency', label: 'Currency', defaultVisible: false, group: 'details' },
  { key: 'assetDescription', label: 'Asset Description', defaultVisible: false, group: 'details' },
  { key: 'usefulLife', label: 'Useful Life', defaultVisible: false, group: 'details' },
  { key: 'capitalizedOn', label: 'Capitalized On', defaultVisible: false, group: 'details' },
  // Depreciation
  { key: 'depFyStart', label: 'Dep. FY Start', defaultVisible: false, group: 'depreciation' },
  { key: 'depForYear', label: 'Dep. for Year', defaultVisible: false, group: 'depreciation' },
  { key: 'accumulDep', label: 'Accumulated Dep.', defaultVisible: false, group: 'depreciation' },
  { key: 'currBkVal', label: 'Current Book Value', defaultVisible: false, group: 'depreciation' },
  // WFH
  { key: 'wfhUid', label: 'WFH UID', defaultVisible: false, group: 'wfh' },
  { key: 'wfhUserName', label: 'WFH User', defaultVisible: false, group: 'wfh' },
  { key: 'wfhUserEmail', label: 'WFH Email', defaultVisible: false, group: 'wfh' },
];
