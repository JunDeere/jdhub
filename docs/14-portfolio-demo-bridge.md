# Optional portfolio demo bridge

## Defaults and scope

Both modes are disabled by default. Production and development require independent
explicit opt-ins. This patch does not enable a deployed environment.

The bridge installs only inside an iframe and only when the signed-in user's
`isDemo` value is exactly `true`. It exposes only `preview.navigate` to these five
canonical targets: `dashboard`, `projects`, `tasks`, `scheduling`, and
`knowledge-base`. No private context, account data, tokens, mutation actions,
admin routes, or additional capabilities are sent. Existing demo authentication
is still required; this bridge does not sign in or bypass authentication.

## Production configuration (future, explicit opt-in)

- `VITE_PORTFOLIO_BRIDGE_ENABLED=false` is the default. Only the literal string
  `true` enables the production bridge.
- `VITE_PORTFOLIO_PARENT_ORIGIN` defaults to empty. A valid example is
  `https://jdeere.net`. Configure exactly one canonical HTTPS DNS/IPv4 origin.
- No wildcard, trailing slash, path, userinfo, query, fragment, whitespace,
  noncanonical hostname, or malformed/noncanonical port is accepted. Explicit
  default port `:443` is rejected; omit it. Canonical nondefault ports are allowed.
- Invalid configuration fails closed without adding a message listener.

These are public Vite **build-time** values, never secrets. The production Compose
build passes the flag and origin as frontend Docker build arguments, defaulting
to false and empty. Changing runtime environment variables on an already-built
frontend cannot change the bridge. Enabling later requires an explicitly
configured rebuild and separately authorized deployment. The ordinary Compose
build does not forward these optional production settings; use the documented
production override when intentionally configuring a production build.

## Independent development configuration

For the Vite development server, place
`VITE_PORTFOLIO_DEV_BRIDGE_ENABLED=true` in a local, untracked frontend env file
only when intentionally testing. Vite reads env files from `frontend/`; the
repository-root Compose `.env` is not automatically read by `npm run dev`.
Development accepts only `http://127.0.0.1:3300`. Neither `localhost` nor a
production origin is allowed. The production opt-in cannot enable development;
the development opt-in cannot enable a production build. Docker does not forward
the dev flag because the shipped image contains a production build.

## Message and lifecycle security

The existing channel `jdeere-portfolio`, version `1`, project `jdhub`, UUID request
IDs and nonce, exact envelope keys, action/payload/cursor schemas, and parent
window identity are checked. Origins must equal the configured origin exactly.
Replies use that exact origin, never `*`. The first valid init pins the nonce for
that installation. Request IDs are single-use across init and command messages;
replays are silently ignored, including during in-flight navigation. At 4096
unique IDs the installation fails closed until a fresh installation/reload.

`app:ready` reports navigation only and `cursorMode: none`. Ready/results contain
protocol metadata and status only. Navigation completion is acknowledged only
after the requested page is present in the rendered DOM and remains the active
target. Navigation errors/timeouts return `rejected`. Logout immediately stops
the listener, aborts render waits, cancels scheduled frames/highlights, and
suppresses late success or failure replies. Effect cleanup does the same when
demo eligibility changes or the app unmounts.

## Verification

From `frontend/`: `npm test`, `npm run lint`, `npm run build`.
From `backend/`: `npm test` for the existing backend regression suite.

Tests inject environment and window objects without activating any actual env
file. Coverage includes default-off behavior, production/dev independence,
canonical origin rejection, demo/top-level gating, parent identity, nonce and
schema checks, all five allowed targets, private/write/context rejection,
replays, navigation errors, actual render confirmation, timeout and logout
cleanup. Production embedding/CSP/frame-ancestors and a real browser demo login
must be validated separately before a future deployment; these checks do not
change server framing policy or claim live integration validation.
