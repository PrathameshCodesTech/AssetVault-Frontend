import {
  LayoutDashboard, Package, ScanLine, FileText, UserCircle, Upload, PlusCircle, ClipboardCheck, ClipboardList, ShieldCheck,
  Users, Database, MapPin, CalendarRange, Building2, Truck,
} from 'lucide-react';

import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

export default function DesktopSidebar() {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const role = user?.role;
  const isAdminRole = role === 'super_admin' || role === 'location_admin';
  const isVendorUser = user?.permissions?.includes('vendor.respond') ?? false;
  const isVendorOnly = isVendorUser && !isAdminRole;

  const vendorItems = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard },
    { title: 'My Requests', url: '/vendor/requests', icon: ClipboardList },
    { title: 'Scan', url: '/scan', icon: ScanLine },
  ];

  const mainItems = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard },
    { title: 'Assets', url: '/assets', icon: Package },
    { title: 'Scan / QR', url: '/scan', icon: ScanLine },
    { title: 'Reconciliation', url: '/reconciliation', icon: ClipboardCheck },
    ...(role === 'employee' ? [{ title: 'Verify Assets', url: '/verify', icon: ShieldCheck }] : []),
  ];

  const adminItems = [
    { title: 'Register Asset', url: '/assets/register', icon: PlusCircle },
    { title: 'Bulk Upload', url: '/assets/upload', icon: Upload },
    { title: 'Reports', url: '/reports', icon: FileText },
    { title: 'Employee Requests', url: '/admin/verification-review', icon: ShieldCheck },
    { title: 'Vendor Requests', url: '/admin/vendor-requests', icon: Truck },
  ];

  const setupItems = [
    { title: 'Users', url: '/admin/users', icon: Users },
    { title: 'Roles & Permissions', url: '/admin/roles', icon: ShieldCheck },
    { title: 'Lookups', url: '/admin/lookups', icon: Database },
    { title: 'Locations', url: '/admin/locations', icon: MapPin },
    { title: 'Verification Cycles', url: '/admin/verification-cycles', icon: CalendarRange },
    { title: 'Vendors', url: '/admin/vendors', icon: Building2 },
  ];

  const settingsItems = [
    { title: 'Profile', url: '/profile', icon: UserCircle },
  ];

  const renderMenuItems = (items: typeof mainItems) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild tooltip={item.title}>
            <NavLink to={item.url} end={item.url === '/'} className="hover:bg-sidebar-accent font-body" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
              <item.icon className="mr-2 h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground font-display tracking-wide">Asset Vault</h2>
              <p className="text-[10px] text-sidebar-foreground/50 font-body">
                {isVendorOnly ? 'Vendor Portal' : 'Asset Management'}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isVendorOnly ? (
          <SidebarGroup>
            <SidebarGroupLabel className="font-body text-[10px] tracking-widest uppercase">Vendor Portal</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(vendorItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="font-body text-[10px] tracking-widest uppercase">Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                {renderMenuItems(mainItems)}
              </SidebarGroupContent>
            </SidebarGroup>

            {isVendorUser && (
              <SidebarGroup>
                <SidebarGroupLabel className="font-body text-[10px] tracking-widest uppercase">Vendor Portal</SidebarGroupLabel>
                <SidebarGroupContent>
                  {renderMenuItems(vendorItems)}
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {(role === 'super_admin' || role === 'location_admin') && (
              <SidebarGroup>
                <SidebarGroupLabel className="font-body text-[10px] tracking-widest uppercase">Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  {renderMenuItems(adminItems)}
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {role === 'super_admin' && (
              <SidebarGroup>
                <SidebarGroupLabel className="font-body text-[10px] tracking-widest uppercase">Setup</SidebarGroupLabel>
                <SidebarGroupContent>
                  {renderMenuItems(setupItems)}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-[10px] tracking-widest uppercase">Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(settingsItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <div className="mb-2 text-xs text-sidebar-foreground/80 font-body">
            <p className="font-medium">{user.name}</p>
            <p className="capitalize text-sidebar-foreground/50">{(user.role ?? '').replace(/_/g, ' ') || 'User'}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-foreground hover:bg-primary hover:text-primary-foreground transition-colors font-body"
        >
          {collapsed ? '⏻' : 'Logout'}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
