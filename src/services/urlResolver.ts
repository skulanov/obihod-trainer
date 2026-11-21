/**
 * Resolves a relative static resource path (e.g. "data/catalog.json" or "audio/trop_8_К.mp3")
 * so it works both at domain root ("/") and under GitHub Pages subpaths
 * ("https://<username>.github.io/<repository>/") even when using hash routing.
 */
export function resolveStaticUrl(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, '');
  const encodedPath = cleaned
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const baseEnv = import.meta.env.BASE_URL || './';
  const currentUrl =
    typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'http://localhost/';

  // Ensure directory URL ends with "/" when resolving relative "./"
  const baseUrl = new URL(baseEnv, currentUrl);
  return new URL(encodedPath, baseUrl).toString();
}
