/**
 * Helper to load logo for PDF generation
 * 
 * To add your logo to the PDF, you can:
 * 1. Use a base64 encoded image
 * 2. Load from a URL
 * 3. Use the public/zoogol-logo.png file
 */

export async function loadLogoForPdf(): Promise<string | null> {
  try {
    // Load ercmax logo from public folder
    const logoPath = '/logo.png';
    
    // Fetch the image and convert to base64
    const response = await fetch(logoPath);
    if (!response.ok) {
      console.warn('Logo not found, using text-only header');
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error loading logo:', error);
    return null;
  }
}

// Example base64 logo (replace with your actual base64 string if needed)
export const ERCMAX_LOGO_BASE64 = null; // Add your base64 string here if you want

