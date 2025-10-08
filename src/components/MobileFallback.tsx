import { useEffect, useState } from 'react';

interface MobileFallbackProps {
  children: React.ReactNode;
}

export function MobileFallback({ children }: MobileFallbackProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Mobile error caught:', event.error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Mobile Error</h1>
          <p className="text-muted-foreground">
            There was an error loading the app on mobile. Please try refreshing the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
