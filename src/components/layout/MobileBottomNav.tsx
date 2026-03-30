import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ScanLine, Package, UserCircle, ClipboardList, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdminRole = user?.role === 'super_admin' || user?.role === 'location_admin';
  const isVendorOnly = (user?.permissions?.includes('vendor.respond') ?? false) && !isAdminRole;

  const tabs = isVendorOnly
    ? [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Requests', icon: ClipboardList, path: '/vendor/requests' },
        { label: 'Scan', icon: ScanLine, path: '/scan' },
        { label: 'Profile', icon: UserCircle, path: '/profile' },
      ]
    : [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Scan', icon: ScanLine, path: '/scan' },
        { label: 'My Assets', icon: Package, path: '/assets' },
        ...(user?.role === 'employee' ? [{ label: 'Verify', icon: ShieldCheck, path: '/verify' }] : []),
        { label: 'Profile', icon: UserCircle, path: '/profile' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card safe-bottom md:hidden">
      <div className="flex items-center justify-around py-1">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors font-body',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
