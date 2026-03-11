import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DesktopHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="hidden md:flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground font-body">
          {user?.locationName || 'All Locations'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-1 -top-1 h-4 w-4 rounded-full p-0 text-[10px] flex items-center justify-center bg-primary text-primary-foreground">
            3
          </Badge>
        </Button>
        <div className="flex items-center gap-2 border-l pl-3">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="text-xs font-body">
            <p className="font-medium">{user?.name}</p>
            <p className="text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
