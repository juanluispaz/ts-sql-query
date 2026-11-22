// Temporal where the runtime has none (Node 22 and 24): the polyfill installs itself only when globalThis has no
// Temporal, so Node 26 and Bun run with their own. The library never imports it: it reads globalThis.Temporal.
import 'temporal-polyfill/global'
