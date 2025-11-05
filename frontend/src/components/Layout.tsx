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
        <div className="min-h-screen flex w-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 mobile-layout relative">
          {/* Decorative blur elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gray-700/20 rounded-full blur-3xl"></div>
          </div>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <header className="h-14 sm:h-16 border-b border-gray-700 bg-gray-800/95 backdrop-blur-sm flex items-center px-3 sm:px-6 sticky top-0 z-10 shadow-sm">
            <SidebarTrigger className="text-gray-300 hover:text-red-400 transition-colors" />
            <div className="ml-2 sm:ml-4 font-heading font-bold text-lg sm:text-xl text-white">
              MyDay
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-transparent">
            <div className="min-h-full w-full px-3 sm:px-6 py-3 sm:py-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </MobileFallback>
  );
}