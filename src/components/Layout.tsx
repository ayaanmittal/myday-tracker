import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { FirstTimeRulesDialog } from './FirstTimeRulesDialog';
// import { MobileDebug } from './MobileDebug';
import { MobileFallback } from './MobileFallback';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <MobileFallback>
      <SidebarProvider>
        <FirstTimeRulesDialog />
        {/* <MobileDebug /> */}
        <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-secondary/20 mobile-layout">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 sm:h-16 border-b border-gray-200 bg-white backdrop-blur-sm flex items-center px-3 sm:px-6 sticky top-0 z-10 shadow-sm">
            <SidebarTrigger className="text-gray-600 hover:text-gray-900" />
            <div className="ml-2 sm:ml-4 font-heading font-bold text-lg sm:text-xl text-gray-900">
              MyDay
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-gray-50/30">
            <div className="min-h-full w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </MobileFallback>
  );
}