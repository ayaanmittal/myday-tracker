import { useEffect, useState } from 'react';

export function MobileDebug() {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [reactLoaded, setReactLoaded] = useState(false);

  useEffect(() => {
    const updateDebugInfo = () => {
      const info: string[] = [];
      
      // Check if we're on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      info.push(`Mobile Device: ${isMobile}`);
      
      // Check viewport
      info.push(`Viewport: ${window.innerWidth}x${window.innerHeight}`);
      
      // Check if React is loaded
      info.push(`React Loaded: ${reactLoaded}`);
      
      // Check if DOM is ready
      info.push(`DOM Ready: ${document.readyState}`);
      
      setDebugInfo(info);
    };

    updateDebugInfo();
    
    // Check for JavaScript errors
    const handleError = (event: ErrorEvent) => {
      const errorMsg = `JS Error: ${event.message} at ${event.filename}:${event.lineno}`;
      setErrors(prev => [...prev, errorMsg]);
    };

    window.addEventListener('error', handleError);
    
    // Check for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMsg = `Promise Rejection: ${event.reason}`;
      setErrors(prev => [...prev, errorMsg]);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [reactLoaded]);

  // Set React as loaded when component mounts
  useEffect(() => {
    setReactLoaded(true);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      maxHeight: '200px',
      overflow: 'auto'
    }}>
      <div>Mobile Debug Info:</div>
      {debugInfo.map((info, index) => (
        <div key={index}>{info}</div>
      ))}
      {errors.length > 0 && (
        <div style={{ marginTop: '10px', color: '#ff6b6b' }}>
          <div>Errors:</div>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
