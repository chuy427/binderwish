// Browsers (and the offline service worker) can reuse the page for a while after
// a deploy, so an open or cached page can run old code. On load, compare this page's build with
// dist/version.json (fetched uncached) and reload once if a newer one is live.
const FLAG = 'binderwish.reloadedFor';

export async function reloadIfOutdated() {
  if (import.meta.env.DEV) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (!build || build === __BUILD_ID__) return;
    // Only once per new build, so a stale CDN edge can never cause a reload loop.
    if (sessionStorage.getItem(FLAG) === build) return;
    sessionStorage.setItem(FLAG, build);
    location.reload();
  } catch { /* offline or blocked — keep running this version */ }
}
