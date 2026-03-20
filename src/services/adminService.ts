import api from "./api";

// ---------------------------------------------------------------------------
// Interfaces — all IDs are UUID strings
// ---------------------------------------------------------------------------

export interface RoleSummary {
  role_code: string;
  role_name: string;
  is_primary: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  phone: string;
  is_active: boolean;
  date_joined: string;
  role_summary: RoleSummary[];
}

export interface AdminUserCreate {
  email: string;
  first_name: string;
  last_name: string;
  employee_code?: string;
  phone?: string;
  is_active?: boolean;
}

export interface AdminUserUpdate {
  first_name?: string;
  last_name?: string;
  employee_code?: string;
  phone?: string;
  is_active?: boolean;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
  is_active: boolean;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  permission_count: number;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
}

export interface RoleCreate {
  code: string;
  name: string;
  description?: string;
  template_id?: string;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface PermissionTemplatePermission {
  id: string;
  code: string;
  name: string;
  module: string;
}

export interface PermissionTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  permissions: PermissionTemplatePermission[];
}

export interface Assignment {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role_id: string;
  role_code: string;
  role_name: string;
  location_id: string | null;
  location_name: string | null;
  is_primary: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface AssignmentCreate {
  user_id: string;
  role_id: string;
  location_id?: string | null;
  is_primary: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface LookupItem {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface SubType extends LookupItem {
  category_id: string;
  category_name: string;
}

export interface SubTypeCreate {
  category_id: string;
  code: string;
  name: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
}

export interface SupplierCreate {
  code: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface LocationType {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  can_hold_assets: boolean;
  is_active: boolean;
}

export interface Location {
  id: string;
  location_type_id: string;
  location_type_code: string;
  location_type_name: string;
  parent_id: string | null;
  parent_name: string | null;
  code: string;
  name: string;
  depth: number;
  path: string;
  is_active: boolean;
}

export interface LocationCreate {
  location_type_id: string;
  parent_id?: string | null;
  code: string;
  name: string;
}

export interface LocationUpdate {
  name?: string;
  is_active?: boolean;
}

export interface VerificationCycle {
  id: string;
  name: string;
  code: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  created_by_email: string;
  request_count: number;
  created_at: string;
}

export interface CycleCreate {
  name: string;
  code: string;
  description?: string;
  start_date: string;
  end_date: string;
}

export interface CycleUpdate {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function fetchAdminUsers(params?: { search?: string; is_active?: boolean }): Promise<AdminUser[]> {
  const { data } = await api.get("/admin/users/", { params });
  return (data.results ?? data) as AdminUser[];
}

export async function fetchAdminUser(id: string): Promise<AdminUser> {
  const { data } = await api.get(`/admin/users/${id}/`);
  return data as AdminUser;
}

export async function createAdminUser(payload: AdminUserCreate): Promise<AdminUser> {
  const { data } = await api.post("/admin/users/", payload);
  return data as AdminUser;
}

export async function updateAdminUser(id: string, payload: AdminUserUpdate): Promise<AdminUser> {
  const { data } = await api.patch(`/admin/users/${id}/`, payload);
  return data as AdminUser;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function fetchAdminRoles(): Promise<Role[]> {
  const { data } = await api.get("/admin/roles/");
  return (data.results ?? data) as Role[];
}

export async function fetchAdminRole(id: string): Promise<RoleDetail> {
  const { data } = await api.get(`/admin/roles/${id}/`);
  return data as RoleDetail;
}

export async function createAdminRole(payload: RoleCreate): Promise<Role> {
  const { data } = await api.post("/admin/roles/", payload);
  return data as Role;
}

export async function updateAdminRole(id: string, payload: RoleUpdate): Promise<Role> {
  const { data } = await api.patch(`/admin/roles/${id}/`, payload);
  return data as Role;
}

export async function assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
  await api.post(`/admin/roles/${roleId}/permissions/`, { permission_id: permissionId });
}

export async function removePermissionFromRole(roleId: string, permId: string): Promise<void> {
  await api.delete(`/admin/roles/${roleId}/permissions/${permId}/`);
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export async function fetchAdminPermissions(params?: { module?: string }): Promise<Permission[]> {
  const { data } = await api.get("/admin/permissions/", { params });
  return (data.results ?? data) as Permission[];
}

export async function fetchPermissionTemplates(): Promise<PermissionTemplate[]> {
  const { data } = await api.get("/admin/permission-templates/");
  return (data.results ?? data) as PermissionTemplate[];
}

export async function fetchPermissionTemplate(id: string): Promise<PermissionTemplate> {
  const { data } = await api.get(`/admin/permission-templates/${id}/`);
  return data as PermissionTemplate;
}

export async function applyTemplateToRole(roleId: string, templateId: string): Promise<void> {
  await api.post(`/admin/roles/${roleId}/apply-template/`, { template_id: templateId });
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function fetchAdminAssignments(params?: { user_id?: string; role_id?: string }): Promise<Assignment[]> {
  const { data } = await api.get("/admin/assignments/", { params });
  return (data.results ?? data) as Assignment[];
}

export async function createAdminAssignment(payload: AssignmentCreate): Promise<Assignment> {
  const { data } = await api.post("/admin/assignments/", payload);
  return data as Assignment;
}

export async function updateAdminAssignment(id: string, payload: Partial<Assignment>): Promise<Assignment> {
  const { data } = await api.patch(`/admin/assignments/${id}/`, payload);
  return data as Assignment;
}

export async function deleteAdminAssignment(id: string): Promise<void> {
  await api.delete(`/admin/assignments/${id}/`);
}

// ---------------------------------------------------------------------------
// Lookups - Categories
// ---------------------------------------------------------------------------

export async function fetchCategories(params?: { search?: string; is_active?: boolean }): Promise<LookupItem[]> {
  const { data } = await api.get("/admin/lookups/categories/", { params });
  return (data.results ?? data) as LookupItem[];
}

export async function createCategory(payload: { code: string; name: string }): Promise<LookupItem> {
  const { data } = await api.post("/admin/lookups/categories/", payload);
  return data as LookupItem;
}

export async function updateCategory(id: string, payload: { name?: string; is_active?: boolean }): Promise<LookupItem> {
  const { data } = await api.patch(`/admin/lookups/categories/${id}/`, payload);
  return data as LookupItem;
}

// ---------------------------------------------------------------------------
// Lookups - SubTypes
// ---------------------------------------------------------------------------

export async function fetchSubTypes(params?: { search?: string; is_active?: boolean }): Promise<SubType[]> {
  const { data } = await api.get("/admin/lookups/subtypes/", { params });
  return (data.results ?? data) as SubType[];
}

export async function createSubType(payload: SubTypeCreate): Promise<SubType> {
  const { data } = await api.post("/admin/lookups/subtypes/", payload);
  return data as SubType;
}

export async function updateSubType(id: string, payload: { name?: string; is_active?: boolean }): Promise<SubType> {
  const { data } = await api.patch(`/admin/lookups/subtypes/${id}/`, payload);
  return data as SubType;
}

// ---------------------------------------------------------------------------
// Lookups - Entities
// ---------------------------------------------------------------------------

export async function fetchEntities(params?: { search?: string; is_active?: boolean }): Promise<LookupItem[]> {
  const { data } = await api.get("/admin/lookups/entities/", { params });
  return (data.results ?? data) as LookupItem[];
}

export async function createEntity(payload: { code: string; name: string }): Promise<LookupItem> {
  const { data } = await api.post("/admin/lookups/entities/", payload);
  return data as LookupItem;
}

export async function updateEntity(id: string, payload: { name?: string; is_active?: boolean }): Promise<LookupItem> {
  const { data } = await api.patch(`/admin/lookups/entities/${id}/`, payload);
  return data as LookupItem;
}

// ---------------------------------------------------------------------------
// Lookups - Cost Centers
// ---------------------------------------------------------------------------

export async function fetchCostCenters(params?: { search?: string; is_active?: boolean }): Promise<LookupItem[]> {
  const { data } = await api.get("/admin/lookups/cost-centers/", { params });
  return (data.results ?? data) as LookupItem[];
}

export async function createCostCenter(payload: { code: string; name: string }): Promise<LookupItem> {
  const { data } = await api.post("/admin/lookups/cost-centers/", payload);
  return data as LookupItem;
}

export async function updateCostCenter(id: string, payload: { name?: string; is_active?: boolean }): Promise<LookupItem> {
  const { data } = await api.patch(`/admin/lookups/cost-centers/${id}/`, payload);
  return data as LookupItem;
}

// ---------------------------------------------------------------------------
// Lookups - Suppliers
// ---------------------------------------------------------------------------

export async function fetchSuppliers(params?: { search?: string; is_active?: boolean }): Promise<Supplier[]> {
  const { data } = await api.get("/admin/lookups/suppliers/", { params });
  return (data.results ?? data) as Supplier[];
}

export async function createSupplier(payload: SupplierCreate): Promise<Supplier> {
  const { data } = await api.post("/admin/lookups/suppliers/", payload);
  return data as Supplier;
}

export async function updateSupplier(id: string, payload: { name?: string; email?: string; phone?: string; is_active?: boolean }): Promise<Supplier> {
  const { data } = await api.patch(`/admin/lookups/suppliers/${id}/`, payload);
  return data as Supplier;
}

// ---------------------------------------------------------------------------
// Location Types
// ---------------------------------------------------------------------------

export async function fetchLocationTypes(): Promise<LocationType[]> {
  const { data } = await api.get("/admin/location-types/");
  return (data.results ?? data) as LocationType[];
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function fetchLocations(params?: { location_type?: string; parent_id?: string; is_active?: boolean; search?: string }): Promise<Location[]> {
  const { data } = await api.get("/admin/locations/", { params });
  return (data.results ?? data) as Location[];
}

export async function createLocation(payload: LocationCreate): Promise<Location> {
  const { data } = await api.post("/admin/locations/", payload);
  return data as Location;
}

export async function updateLocation(id: string, payload: LocationUpdate): Promise<Location> {
  const { data } = await api.patch(`/admin/locations/${id}/`, payload);
  return data as Location;
}

// ---------------------------------------------------------------------------
// Verification Cycles
// ---------------------------------------------------------------------------

export async function fetchCycles(params?: { status?: string }): Promise<VerificationCycle[]> {
  const { data } = await api.get("/admin/verification-cycles/", { params });
  return (data.results ?? data) as VerificationCycle[];
}

export async function createCycle(payload: CycleCreate): Promise<VerificationCycle> {
  const { data } = await api.post("/admin/verification-cycles/", payload);
  return data as VerificationCycle;
}

export async function updateCycle(id: string, payload: CycleUpdate): Promise<VerificationCycle> {
  const { data } = await api.patch(`/admin/verification-cycles/${id}/`, payload);
  return data as VerificationCycle;
}

export async function activateCycle(id: string): Promise<VerificationCycle> {
  const { data } = await api.post(`/admin/verification-cycles/${id}/activate/`);
  return data as VerificationCycle;
}

export async function closeCycle(id: string): Promise<VerificationCycle> {
  const { data } = await api.post(`/admin/verification-cycles/${id}/close/`);
  return data as VerificationCycle;
}
