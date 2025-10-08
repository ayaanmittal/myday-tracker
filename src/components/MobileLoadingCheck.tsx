import { useEffect, useState } from 'react';

interface MobileLoadingCheckProps {
  children: React.ReactNode;
}

export function MobileLoadingCheck({ children }: MobileLoadingCheckProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Add a small delay to ensure everything is loaded on mobile
      const timer = setTimeout(() => {
        setIsLoaded(true);
      }, 100);

      // Check for common mobile loading issues
      const checkLoading = () => {
        // Check if critical resources are loaded
        const scripts = document.querySelectorAll('script[src]');
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        
        let loadedCount = 0;
        const totalResources = scripts.length + stylesheets.length;
        
        const checkResource = (element: Element) => {
          return new Promise((resolve) => {
            if (element instanceof HTMLElement) {
              if (element.tagName === 'SCRIPT') {
                const script = element as HTMLScriptElement;
                if (script.src) {
                  const img = new Image();
                  img.onload = () => resolve(true);
                  img.onerror = () => resolve(false);
                  img.src = script.src;
                } else {
                  resolve(true);
                }
              } else if (element.tagName === 'LINK') {
                const link = element as HTMLLinkElement;
                if (link.href) {
                  const img = new Image();
                  img.onload = () => resolve(true);
                  img.onerror = () => resolve(false);
                  img.src = link.href;
                } else {
                  resolve(true);
                }
              } else {
                resolve(true);
              }
            } else {
              resolve(true);
            }
          });
        };

        Promise.all([...scripts, ...stylesheets].map(checkResource))
          .then((results) => {
            loadedCount = results.filter(Boolean).length;
            if (loadedCount === totalResources) {
              setIsLoaded(true);
            }
          })
          .catch((error) => {
            console.error('Mobile loading check error:', error);
            setLoadingError('Failed to load resources');
            setIsLoaded(true); // Still show the app
          });
      };

      // Run the check after a short delay
      setTimeout(checkLoading, 50);

      return () => clearTimeout(timer);
    } else {
      // On desktop, load immediately
      setIsLoaded(true);
    }
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Loading Error</h1>
          <p className="text-muted-foreground">{loadingError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
