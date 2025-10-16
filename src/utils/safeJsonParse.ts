/**
 * Safely parse JSON from a fetch response
 * Handles empty responses, non-JSON content, and parsing errors
 */
export async function safeJsonParse<T = any>(response: Response): Promise<T | null> {
  try {
    // Check if response is ok
    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      return null;
    }

    // Get response text first
    const text = await response.text();
    
    // Check if response is empty
    if (!text || text.trim() === '') {
      console.warn('Empty response received');
      return null;
    }

    // Try to parse JSON
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Response text:', text);
      return null;
    }
  } catch (error) {
    console.error('Error in safeJsonParse:', error);
    return null;
  }
}

/**
 * Enhanced fetch with safe JSON parsing
 */
export async function safeFetch<T = any>(
  url: string, 
  options?: RequestInit
): Promise<{ success: boolean; data: T | null; error?: string }> {
  try {
    const response = await fetch(url, options);
    const data = await safeJsonParse<T>(response);
    
    if (data === null) {
      return {
        success: false,
        data: null,
        error: 'Failed to parse response as JSON'
      };
    }
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Fetch error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error'
    };
  }
}
