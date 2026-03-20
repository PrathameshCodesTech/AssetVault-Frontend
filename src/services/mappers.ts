import type { User, Asset, AssetHistory, DashboardSummary } from "@/types";

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapKeys(obj: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!obj) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

export function mapBackendUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name ?? raw.email,
    role: raw.role ?? 'employee',
    permissions: raw.permission_codes ?? [],
    locationId: raw.locationId ?? undefined,
    locationName: raw.locationName ?? undefined,
    assignedLocationIds: raw.assignedLocationIds ?? undefined,
  };
}

export function mapBackendAsset(raw: any): Asset {
  const breadcrumb = Array.isArray(raw.locationBreadcrumb)
    ? raw.locationBreadcrumb.map((b: any) => b.name).join(" > ")
    : raw.locationBreadcrumb ?? "";

  return {
    id: raw.id,
    assetId: raw.assetId ?? "",
    serialNumber: raw.serialNumber ?? "",
    tagNumber: raw.tagNumber ?? "",
    name: raw.name ?? "",
    description: raw.description ?? "",
    category: raw.category ?? "",
    subAssetType: raw.subAssetType ?? undefined,
    entity: raw.entity ?? undefined,
    subLocation: raw.subLocation ?? undefined,
    locationId: raw.locationId ?? "",
    locationName: raw.locationName ?? "",
    locationPath: raw.locationPath ?? undefined,
    locationBreadcrumb: breadcrumb,
    assignedTo: raw.assignedTo ?? "",
    assignedToName: raw.assignedToName ?? "",
    status: raw.status ?? "active",
    reconciliationStatus: raw.reconciliationStatus ?? "pending",
    purchaseDate: raw.purchaseDate ?? "",
    purchaseValue: raw.purchaseValue ?? 0,
    imageUrl: raw.imageUrl ?? undefined,
    qrCode: typeof raw.qrCode === 'object' && raw.qrCode !== null
      ? (raw.qrCode.qr_uid ?? raw.qrCode.qrUid ?? '')
      : (raw.qrCode ?? undefined),
    qrUid: raw.qrUid ? String(raw.qrUid) : undefined,
    images: raw.images ?? undefined,
    lastVerified: raw.lastVerified ?? undefined,
    createdAt: raw.createdAt ?? "",
    updatedAt: raw.updatedAt ?? "",
    assetDetails: mapKeys(raw.assetDetails) as any,
    wfhDetails: raw.wfhDetails ?? undefined,
    vendorRequestId: raw.vendorRequestId ?? undefined,
    vendorRequestReference: raw.vendorRequestReference ?? undefined,
    vendorRequestStatus: raw.vendorRequestStatus ?? undefined,
    vendorName: raw.vendorName ?? undefined,
    workflowType: raw.workflowType ?? undefined,
    workflowStatus: raw.workflowStatus ?? undefined,
    workflowReference: raw.workflowReference ?? undefined,
    workflowDisplay: raw.workflowDisplay ?? undefined,
  };
}

export function mapBackendHistory(raw: any): AssetHistory {
  return {
    id: raw.id,
    assetId: raw.assetId ?? "",
    action: raw.action ?? "updated",
    description: raw.description ?? "",
    performedBy: raw.performedBy ?? "",
    performedByName: raw.performedByName ?? "",
    fromLocation: raw.fromLocation ?? undefined,
    toLocation: raw.toLocation ?? undefined,
    timestamp: raw.timestamp ?? "",
  };
}

export function mapDashboardSummary(raw: any): DashboardSummary {
  return {
    totalAssets: raw.totalAssets ?? 0,
    pendingReconciliation: raw.pendingReconciliation ?? 0,
    verifiedAssets: raw.verifiedAssets ?? 0,
    discrepancies: raw.discrepancies ?? 0,
    recentActivity: (raw.recentActivity ?? []).map(mapBackendHistory),
    locationBreakdown: raw.locationBreakdown ?? [],
    reconciliationProgress: raw.reconciliationProgress ?? 0,
  };
}

