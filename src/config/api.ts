// Central API base URL configuration
// Use `VITE_API_BASE_URL` in production to point to your backend (e.g., Node/Express server)
// Leave empty for development if you rely on Vite proxy

export function getApiBaseUrl(): string {
  // Prefer Vite env at build/runtime in browser
  // Fallback to process.env for server-side usage
  const fromVite = (typeof import.meta !== 'undefined' && (import.meta as any).env)
    ? (import.meta as any).env.VITE_API_BASE_URL
    : undefined;
  const fromNode = (typeof process !== 'undefined' && process.env)
    ? process.env.VITE_API_BASE_URL || process.env.API_BASE_URL
    : undefined;

  const base = (fromVite ?? fromNode ?? '').trim();
  if (!base) return '';
  // Remove trailing slash to avoid // in URLs
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function joinApiPath(path: string): string {
  const base = getApiBaseUrl();
  if (!base) return path; // relative path for dev proxy
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}`;
}


