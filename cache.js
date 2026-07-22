const CACHE_NAME = 'inventory-finder-cache-v3';
const STATIC_FILES = [
    'index.html',
    'inventory-finder.css',
    'inventory-finder.js',
    'local.js',
    'supabase-js.min.js',
    'admin.html',
    'admin.css',
    'update.js',
    'xlsx.full.min.js',
    'test_dms_extsys_item_valid.json',
    'test_wms_iv_f.json',
    'test_wms_lc_f.json',
    'cache.js',
    'fuse.min.js',
];

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', (event) => {
    console.log('Service worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Cache opened, adding files...');
            const promises = STATIC_FILES.map(file => 
                cache.add(file)
                    .then(() => console.log(`✅ Cached: ${file}`))
                    .catch(err => console.warn(`❌ Failed to cache: ${file}`, err))
            );
            return Promise.all(promises);
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            console.log('Cache lookup for:', event.request.url, 'found:', !!cachedResponse);
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                return response;
            }).catch((err) => {
                console.warn('[SW] Fetch failed, returning fallback:', event.request.url, err);
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
                // return empty 404 response
                return new Response('Not found', { status: 404 });
            });
        })
    );
});  
