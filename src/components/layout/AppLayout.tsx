import { SidebarProvider } from '@/components/ui/sidebar';
import DesktopSidebar from './DesktopSidebar';
import DesktopHeader from './DesktopHeader';
import MobileBottomNav from './MobileBottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <DesktopSidebar />
        </div>
        <div className="flex-1 flex flex-col min-h-screen">
          <DesktopHeader />
          <main className="flex-1 pb-20 md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
