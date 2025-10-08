// Simple mobile-compatible version of main.tsx
console.log('Simple main.tsx loading started');

// Basic error handling
window.addEventListener('error', (event) => {
  console.error('Simple main.tsx error:', event.error);
  showSimpleError('JavaScript error: ' + (event.error ? event.error.message : event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Simple main.tsx promise rejection:', event.reason);
  showSimpleError('Loading error: ' + event.reason);
});

function showSimpleError(message) {
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
        padding: 20px;
      ">
        <div style="text-align: center; max-width: 400px;">
          <h1 style="color: #1f2937; margin-bottom: 16px;">Loading Error</h1>
          <p style="color: #6b7280; margin-bottom: 24px;">${message}</p>
          <button onclick="window.location.reload()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            margin-right: 10px;
          ">Retry</button>
          <button onclick="window.open('/mobile-debug.html', '_blank')" style="
            background: #10b981;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          ">Debug</button>
        </div>
      </div>
    `;
  }
}

// Try to load React with minimal dependencies
try {
  console.log('Attempting to import React...');
  
  // Dynamic import to avoid module loading issues
  import('./App.tsx').then(({ default: App }) => {
    console.log('App component loaded successfully');
    
    // Try to import React
    import('react').then((React) => {
      console.log('React imported successfully');
      
      import('react-dom/client').then(({ createRoot }) => {
        console.log('ReactDOM imported successfully');
        
        const rootElement = document.getElementById("root");
        if (!rootElement) {
          throw new Error('Root element not found');
        }
        
        console.log('Creating React root...');
        const root = createRoot(rootElement);
        
        console.log('Rendering App...');
        root.render(React.createElement(App));
        
        console.log('React app mounted successfully');
        
        // Hide mobile loading screen
        const mobileLoading = document.getElementById('mobile-loading');
        if (mobileLoading) {
          mobileLoading.style.display = 'none';
        }
        
        // Set success flag
        window.reactLoaded = true;
        console.log('Simple React loading completed');
        
      }).catch((error) => {
        console.error('ReactDOM import failed:', error);
        showSimpleError('Failed to load ReactDOM: ' + error.message);
      });
      
    }).catch((error) => {
      console.error('React import failed:', error);
      showSimpleError('Failed to load React: ' + error.message);
    });
    
  }).catch((error) => {
    console.error('App import failed:', error);
    showSimpleError('Failed to load App component: ' + error.message);
  });
  
} catch (error) {
  console.error('React loading failed:', error);
  showSimpleError('Failed to load React application: ' + error.message);
}
