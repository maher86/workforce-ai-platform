export function pilotOrigin(value) {
  const url = new URL(value || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port || !url.hostname.includes('.') || url.hostname.endsWith('.local')) {
    throw new Error('WORKFORCE_ANDROID_ORIGIN must be one HTTPS origin without credentials, path, port or token');
  }
  return url.origin;
}
