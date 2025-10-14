import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('Main.tsx loading started');

// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
console.log('Is mobile device:', isMobile);

// Enhanced error handling for mobile
window.addEventListener('error', (event) => {
  console.error('JavaScript error in main.tsx:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
  
  // Only show error UI for critical errors, not minor issues
  const isCriticalError = event.error && (
    event.error.message?.includes('Cannot read properties') ||
    event.error.message?.includes('Cannot access') ||
    event.error.message?.includes('is not defined') ||
    event.error.message?.includes('is not a function') ||
    event.error.message?.includes('NetworkError') ||
    event.error.message?.includes('Failed to fetch')
  );
  
  // Show user-friendly error on mobile for critical errors only
  if (isMobile && isCriticalError) {
    // Check if error UI is already shown
    if (document.querySelector('.mobile-error-overlay')) {
      return;
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'mobile-error-overlay';
    errorDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #fef2f2;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="text-align: center; max-width: 300px;">
          <h2 style="color: #dc2626; margin-bottom: 16px;">Mobile Error</h2>
          <p style="color: #7f1d1d; margin-bottom: 16px;">There was an error loading the app on mobile. Please try refreshing the page.</p>
          <div style="background: #f3f4f6; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 12px; text-align: left;">
            <strong>Error:</strong> ${event.message}<br>
            <strong>File:</strong> ${event.filename}<br>
            <strong>Line:</strong> ${event.lineno}
          </div>
          <button onclick="window.location.reload()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          ">Refresh Page</button>
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Only show error UI for critical promise rejections
  const isCriticalRejection = event.reason && (
    event.reason.message?.includes('NetworkError') ||
    event.reason.message?.includes('Failed to fetch') ||
    event.reason.message?.includes('Cannot read properties') ||
    event.reason.message?.includes('Cannot access') ||
    event.reason.message?.includes('is not defined')
  );
  
  if (isMobile && isCriticalRejection) {
    // Check if error UI is already shown
    if (document.querySelector('.mobile-error-overlay')) {
      return;
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'mobile-error-overlay';
    errorDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #fef2f2;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="text-align: center; max-width: 300px;">
          <h2 style="color: #dc2626; margin-bottom: 16px;">Mobile Error</h2>
          <p style="color: #7f1d1d; margin-bottom: 16px;">There was an error loading the app on mobile. Please try refreshing the page.</p>
          <div style="background: #f3f4f6; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 12px; text-align: left;">
            <strong>Promise Error:</strong> ${event.reason}
          </div>
          <button onclick="window.location.reload()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          ">Refresh Page</button>
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
});

// Mobile loading optimization
if (isMobile) {
  console.log('Mobile optimizations applied');
  // Mobile optimizations are handled by the build process
  // No need to preload source files in production
}

// Enhanced root creation with error handling
try {
  console.log('Attempting to create React root');
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  console.log('Root element found, creating React root');
  const root = createRoot(rootElement);
  
  console.log('Rendering App component');
  root.render(<App />);
  
  console.log('React app mounted successfully');
  
  // Hide mobile loading screen once React is mounted
  const mobileLoading = document.getElementById('mobile-loading');
  if (mobileLoading) {
    console.log('Hiding mobile loading screen');
    setTimeout(() => {
      mobileLoading.style.display = 'none';
    }, 1000);
  }
  
  // Set a flag that React has loaded
  (window as any).reactLoaded = true;
  console.log('React loaded flag set');
  
} catch (error) {
  console.error('Failed to mount React app:', error);
  
  // Show fallback error message
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="text-align: center; max-width: 400px; padding: 20px;">
          <h1 style="color: #1f2937; margin-bottom: 16px;">Loading Error</h1>
          <p style="color: #6b7280; margin-bottom: 24px;">Failed to load the application. Please check your internet connection and try again.</p>
          <button onclick="window.location.reload()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          ">Retry</button>
        </div>
      </div>
    `;
  }
}
