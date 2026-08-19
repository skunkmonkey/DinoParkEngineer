# Static Hosting and Route Fallbacks

Build with `npm run build`. The generated `dist/` directory is a client-only
static application. Set `VITE_BASE_PATH` to the deployment prefix (for example
`/dino-park/`) when hosting below a domain root; leave it unset for `/`.

All hosts must return `index.html` for clean application routes that do not map
to a physical file. Requests for real JavaScript, CSS, images, manifests, and
service-worker files must retain ordinary static-file and cache behavior.

## Local verification

Run `npm run preview`, open the printed URL, navigate to a nested route, and
reload that route directly. The route must render through the application
instead of returning a host 404.

## Generic static hosts

Configure the host's SPA fallback or rewrite so unmatched extensionless paths
resolve to `/index.html` (or `<base-path>/index.html`). Do not rewrite requests
for files containing an extension. HTTPS is required for production service
workers except on localhost.

## Hostinger

For Apache-backed Hostinger static hosting, add an `.htaccess` beside
`index.html` with an existing-file/existing-directory guard followed by a
rewrite to the deployment's `index.html`. Adjust the rewrite base when the app
is installed in a subdirectory. Confirm Hostinger serves the generated service
worker without an HTML fallback and with a JavaScript content type.

## Safe updates

Do not add host rules that force an open client to reload. The shell detects a
waiting build and activates it only after its persistence checkpoint reports a
safe session. Cache `index.html` and the service worker for revalidation; hashed
build assets may be cached immutably.
