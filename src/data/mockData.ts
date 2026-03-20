import { Asset, AssetHistory, DashboardSummary, Location, LocationNode, User } from '@/types';

export const mockUsers: Record<string, User> = {
  'admin@bank.com': {
    id: 'u1',
    email: 'admin@bank.com',
    name: 'Rajesh Kumar',
    role: 'super_admin',
    permissions: [],
    avatar: undefined,
  },
  'branch@bank.com': {
    id: 'u2',
    email: 'branch@bank.com',
    name: 'Priya Sharma',
    role: 'location_admin',
    permissions: [],
    locationId: 'loc1',
    locationName: 'Mumbai - Main Branch',
  },
  'employee@bank.com': {
    id: 'u3',
    email: 'employee@bank.com',
    name: 'Amit Patel',
    role: 'employee',
    permissions: [],
    locationId: 'loc1',
    locationName: 'Mumbai - Main Branch',
  },
};

export const mockLocations: Location[] = [
  { id: 'loc1', name: 'Mumbai - Main Branch', code: 'MUM-001', address: '123 Marine Drive, Mumbai', totalAssets: 1250, verifiedAssets: 980 },
  { id: 'loc2', name: 'Delhi - Central Branch', code: 'DEL-001', address: '456 Connaught Place, Delhi', totalAssets: 890, verifiedAssets: 654 },
  { id: 'loc3', name: 'Bangalore - Tech Park', code: 'BLR-001', address: '789 Whitefield, Bangalore', totalAssets: 2100, verifiedAssets: 1890 },
  { id: 'loc4', name: 'Chennai - Anna Nagar', code: 'CHN-001', address: '321 Anna Salai, Chennai', totalAssets: 670, verifiedAssets: 510 },
  { id: 'loc5', name: 'Kolkata - Park Street', code: 'KOL-001', address: '654 Park Street, Kolkata', totalAssets: 430, verifiedAssets: 380 },
];

// ---- Location Hierarchy Mock Data ----
export const mockLocationHierarchy: LocationNode[] = [
  {
    id: 'comp-1', name: 'National Bank of India', level: 'company', parentId: null, code: 'NBI',
    children: [
      {
        id: 'cntry-1', name: 'India', level: 'country', parentId: 'comp-1', code: 'IN',
        children: [
          {
            id: 'reg-1', name: 'West', level: 'region', parentId: 'cntry-1', code: 'WEST',
            children: [
              {
                id: 'zone-1', name: 'Mumbai Zone', level: 'zone', parentId: 'reg-1', code: 'MUM-Z',
                children: [
                  {
                    id: 'site-1', name: 'HQ Site', level: 'site', parentId: 'zone-1', code: 'HQ',
                    children: [
                      {
                        id: 'ent-1', name: 'Admin Entity', level: 'entity', parentId: 'site-1', code: 'ADMIN',
                        children: [
                          {
                            id: 'bldg-1', name: 'Tower A', level: 'building', parentId: 'ent-1', code: 'TWR-A',
                            children: [
                              {
                                id: 'wing-1', name: 'Wing B', level: 'wing', parentId: 'bldg-1', code: 'W-B',
                                children: [
                                  {
                                    id: 'area-1', name: 'Office Area', level: 'area', parentId: 'wing-1', code: 'OFC',
                                    children: [
                                      {
                                        id: 'flr-1', name: '3rd Floor', level: 'floor', parentId: 'area-1', code: 'F3',
                                        children: [
                                          {
                                            id: 'unit-1', name: 'Unit 302', level: 'unit', parentId: 'flr-1', code: 'U302',
                                            children: [
                                              { id: 'room-1', name: 'Server Room', level: 'room', parentId: 'unit-1', code: 'SR' },
                                              { id: 'room-2', name: 'Conference Room A', level: 'room', parentId: 'unit-1', code: 'CRA' },
                                            ],
                                          },
                                          {
                                            id: 'unit-2', name: 'Unit 305', level: 'unit', parentId: 'flr-1', code: 'U305',
                                            children: [
                                              { id: 'room-3', name: 'Manager Office', level: 'room', parentId: 'unit-2', code: 'MO' },
                                            ],
                                          },
                                        ],
                                      },
                                      {
                                        id: 'flr-2', name: '4th Floor', level: 'floor', parentId: 'area-1', code: 'F4',
                                        children: [
                                          {
                                            id: 'unit-3', name: 'Unit 401', level: 'unit', parentId: 'flr-2', code: 'U401',
                                            children: [
                                              { id: 'room-4', name: 'IT Lab', level: 'room', parentId: 'unit-3', code: 'ITL' },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                id: 'wing-2', name: 'Wing C', level: 'wing', parentId: 'bldg-1', code: 'W-C',
                                children: [
                                  {
                                    id: 'area-2', name: 'Banking Hall', level: 'area', parentId: 'wing-2', code: 'BH',
                                    children: [
                                      {
                                        id: 'flr-3', name: 'Ground Floor', level: 'floor', parentId: 'area-2', code: 'GF',
                                        children: [
                                          {
                                            id: 'unit-4', name: 'Lobby', level: 'unit', parentId: 'flr-3', code: 'LBY',
                                            children: [
                                              { id: 'room-5', name: 'ATM Room', level: 'room', parentId: 'unit-4', code: 'ATM' },
                                              { id: 'room-6', name: 'Vault', level: 'room', parentId: 'unit-4', code: 'VLT' },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'reg-2', name: 'North', level: 'region', parentId: 'cntry-1', code: 'NORTH',
            children: [
              {
                id: 'zone-2', name: 'Delhi Zone', level: 'zone', parentId: 'reg-2', code: 'DEL-Z',
                children: [
                  {
                    id: 'site-2', name: 'Central Branch', level: 'site', parentId: 'zone-2', code: 'CB',
                    children: [
                      {
                        id: 'ent-2', name: 'Operations', level: 'entity', parentId: 'site-2', code: 'OPS',
                        children: [
                          {
                            id: 'bldg-2', name: 'Main Building', level: 'building', parentId: 'ent-2', code: 'MB',
                            children: [
                              {
                                id: 'wing-3', name: 'East Wing', level: 'wing', parentId: 'bldg-2', code: 'EW',
                                children: [
                                  {
                                    id: 'area-3', name: 'Operations Floor', level: 'area', parentId: 'wing-3', code: 'OPF',
                                    children: [
                                      {
                                        id: 'flr-4', name: '1st Floor', level: 'floor', parentId: 'area-3', code: 'F1',
                                        children: [
                                          {
                                            id: 'unit-5', name: 'Unit 101', level: 'unit', parentId: 'flr-4', code: 'U101',
                                            children: [
                                              { id: 'room-7', name: 'Cash Counter', level: 'room', parentId: 'unit-5', code: 'CC' },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'reg-3', name: 'South', level: 'region', parentId: 'cntry-1', code: 'SOUTH',
            children: [
              {
                id: 'zone-3', name: 'Bangalore Zone', level: 'zone', parentId: 'reg-3', code: 'BLR-Z',
                children: [
                  {
                    id: 'site-3', name: 'Tech Park', level: 'site', parentId: 'zone-3', code: 'TP',
                    children: [
                      {
                        id: 'ent-3', name: 'Technology', level: 'entity', parentId: 'site-3', code: 'TECH',
                        children: [
                          {
                            id: 'bldg-3', name: 'Innovation Center', level: 'building', parentId: 'ent-3', code: 'IC',
                            children: [
                              {
                                id: 'wing-4', name: 'North Wing', level: 'wing', parentId: 'bldg-3', code: 'NW',
                                children: [
                                  {
                                    id: 'area-4', name: 'Dev Area', level: 'area', parentId: 'wing-4', code: 'DEV',
                                    children: [
                                      {
                                        id: 'flr-5', name: '2nd Floor', level: 'floor', parentId: 'area-4', code: 'F2',
                                        children: [
                                          {
                                            id: 'unit-6', name: 'Unit 201', level: 'unit', parentId: 'flr-5', code: 'U201',
                                            children: [
                                              { id: 'room-8', name: 'Data Center', level: 'room', parentId: 'unit-6', code: 'DC' },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// Helper: flatten hierarchy
export function flattenHierarchy(nodes: LocationNode[]): LocationNode[] {
  const result: LocationNode[] = [];
  function walk(list: LocationNode[]) {
    for (const n of list) {
      result.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

// Helper: get children of a given parentId
export function getChildrenOf(parentId: string | null): LocationNode[] {
  const all = flattenHierarchy(mockLocationHierarchy);
  return all.filter((n) => n.parentId === parentId);
}

// Helper: build breadcrumb from selections
export function buildBreadcrumb(selections: Record<string, string>): string {
  const all = flattenHierarchy(mockLocationHierarchy);
  const parts: string[] = [];
  for (const level of ['company', 'country', 'region', 'zone', 'site', 'entity', 'building', 'wing', 'area', 'floor', 'unit', 'room']) {
    const nodeId = selections[level];
    if (nodeId) {
      const node = all.find((n) => n.id === nodeId);
      if (node) parts.push(node.name);
    }
  }
  return parts.join(' > ');
}

// Helper: get node by id
export function getNodeById(id: string): LocationNode | undefined {
  return flattenHierarchy(mockLocationHierarchy).find((n) => n.id === id);
}

const categories = ['Computer', 'Furniture', 'Vehicle', 'Networking', 'Security', 'Office Equipment', 'ATM', 'Safe Deposit'];
const subAssetTypes = ['Desktop', 'Laptop', 'Chair', 'Desk', 'Sedan', 'Switch', 'CCTV', 'Printer', 'Cash Machine', 'Locker'];
const entities = ['Admin Entity', 'Operations', 'Technology', 'HR', 'Finance', 'Compliance'];
const subLocations = ['Main Hall', 'Server Room', 'Reception', 'Conference Room', 'Storage', 'Lobby'];
const statuses: Asset['status'][] = ['active', 'active', 'active', 'in_transit', 'pending_verification', 'missing'];
const reconStatuses: Asset['reconciliationStatus'][] = ['verified', 'verified', 'pending', 'discrepancy'];
const currencies = ['INR', 'USD', 'EUR', 'GBP'];
const suppliers = ['Dell Technologies', 'HP Inc.', 'Cisco Systems', 'Godrej', 'NCR Corporation', 'Honeywell'];

const sampleBreadcrumbs = [
  'National Bank of India > India > West > Mumbai Zone > HQ Site > Admin Entity > Tower A > Wing B > Office Area > 3rd Floor > Unit 302 > Server Room',
  'National Bank of India > India > West > Mumbai Zone > HQ Site > Admin Entity > Tower A > Wing C > Banking Hall > Ground Floor > Lobby > ATM Room',
  'National Bank of India > India > North > Delhi Zone > Central Branch > Operations > Main Building > East Wing > Operations Floor > 1st Floor > Unit 101 > Cash Counter',
  'National Bank of India > India > South > Bangalore Zone > Tech Park > Technology > Innovation Center > North Wing > Dev Area > 2nd Floor > Unit 201 > Data Center',
];

function generateAssets(count: number): Asset[] {
  const assets: Asset[] = [];
  for (let i = 1; i <= count; i++) {
    const loc = mockLocations[i % mockLocations.length];
    const cat = categories[i % categories.length];
    const status = statuses[i % statuses.length];
    const recon = reconStatuses[i % reconStatuses.length];
    const pv = Math.floor(Math.random() * 500000) + 5000;
    assets.push({
      id: `ast-${String(i).padStart(6, '0')}`,
      assetId: `BANK-${String(i).padStart(6, '0')}`,
      serialNumber: `SN-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      tagNumber: `TAG-${String(i).padStart(5, '0')}`,
      name: `${cat} - Unit ${i}`,
      description: `${cat} asset located at ${loc.name}`,
      category: cat,
      subAssetType: subAssetTypes[i % subAssetTypes.length],
      entity: entities[i % entities.length],
      subLocation: subLocations[i % subLocations.length],
      locationId: loc.id,
      locationName: loc.name,
      locationBreadcrumb: sampleBreadcrumbs[i % sampleBreadcrumbs.length],
      assignedTo: 'u3',
      assignedToName: 'Amit Patel',
      status,
      reconciliationStatus: recon,
      purchaseDate: `202${(i % 4)}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
      purchaseValue: pv,
      lastVerified: recon === 'verified' ? '2025-12-15' : undefined,
      createdAt: '2023-01-15',
      updatedAt: '2025-11-20',
      assetDetails: {
        subNumber: `${i}-0`,
        assetClass: `CLS-${String(i % 20).padStart(3, '0')}`,
        costCenter: `CC-${String((i % 50) + 100).padStart(4, '0')}`,
        intOrder: i % 3 === 0 ? `IO-${String(i).padStart(6, '0')}` : undefined,
        assetDescription: `${cat} asset #${i}`,
        usefulLife: `${5 + (i % 10)} years`,
        usefulLifeInPeriods: `${(5 + (i % 10)) * 12}`,
        supplier: suppliers[i % suppliers.length],
        currency: currencies[i % currencies.length],
        capitalizedOn: `202${i % 4}-01-01`,
        apcFyStart: `₹${(pv * 0.95).toFixed(0)}`,
        acquisition: `₹${pv.toFixed(0)}`,
        currentApc: `₹${pv.toFixed(0)}`,
        depFyStart: `₹${(pv * 0.1).toFixed(0)}`,
        depForYear: `₹${(pv * 0.05).toFixed(0)}`,
        accumulDep: `₹${(pv * 0.3).toFixed(0)}`,
        bkValFyStart: `₹${(pv * 0.7).toFixed(0)}`,
        currBkVal: `₹${(pv * 0.65).toFixed(0)}`,
      },
      wfhDetails: i % 5 === 0 ? {
        serialNumber: `WFH-SN-${String(i).padStart(4, '0')}`,
        location: 'Home Office',
        entity: entities[i % entities.length],
        asset: `BANK-${String(i).padStart(6, '0')}`,
        uid: `UID-${String(i).padStart(4, '0')}`,
        userName: 'Amit Patel',
        userEmailId: 'employee@bank.com',
      } : undefined,
    });
  }
  return assets;
}

export const mockAssets: Asset[] = generateAssets(280);

export function generateMockHistory(assetId: string): AssetHistory[] {
  return [
    { id: 'h1', assetId, action: 'registered', description: 'Asset registered in the system', performedBy: 'u1', performedByName: 'Rajesh Kumar', timestamp: '2023-01-15T09:00:00Z' },
    { id: 'h2', assetId, action: 'moved', description: 'Moved from warehouse to branch', performedBy: 'u2', performedByName: 'Priya Sharma', fromLocation: 'Warehouse', toLocation: 'Mumbai - Main Branch', timestamp: '2023-02-01T11:30:00Z' },
    { id: 'h3', assetId, action: 'reassigned', description: 'Assigned to Amit Patel', performedBy: 'u2', performedByName: 'Priya Sharma', timestamp: '2023-03-10T14:00:00Z' },
    { id: 'h4', assetId, action: 'verified', description: 'Verified during Q4 reconciliation', performedBy: 'u3', performedByName: 'Amit Patel', timestamp: '2025-12-15T10:00:00Z', imageUrl: '/placeholder.svg' },
  ];
}

export const mockDashboardSummary: DashboardSummary = {
  totalAssets: 5340,
  pendingReconciliation: 926,
  verifiedAssets: 4414,
  discrepancies: 47,
  reconciliationProgress: 82.7,
  locationBreakdown: mockLocations.map((l) => ({ locationName: l.name, total: l.totalAssets, verified: l.verifiedAssets })),
  recentActivity: [
    { id: 'ra1', assetId: 'ast-000001', action: 'verified', description: 'Computer verified at Mumbai branch', performedBy: 'u3', performedByName: 'Amit Patel', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
    { id: 'ra2', assetId: 'ast-000042', action: 'moved', description: 'Furniture moved to Delhi branch', performedBy: 'u2', performedByName: 'Priya Sharma', fromLocation: 'Mumbai', toLocation: 'Delhi', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
    { id: 'ra3', assetId: 'ast-000099', action: 'registered', description: 'New ATM registered', performedBy: 'u1', performedByName: 'Rajesh Kumar', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
    { id: 'ra4', assetId: 'ast-000150', action: 'updated', description: 'Safe deposit info updated', performedBy: 'u2', performedByName: 'Priya Sharma', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  ],
};

