# Implementation Brief: In-Handler API-Key Auth + IP Allow List for a Public Scripted REST Endpoint

> A self-contained briefing for implementing this app's authentication and
> source-restriction approach in a **different** project / fresh build-agent
> session. Replace `<scope>` throughout with the new app's scope prefix. It
> assumes a **public (unauthenticated) Scripted REST endpoint** that must gate
> itself in-script — that constraint is the entire reason this design exists.

## 1. The problem this solves

The endpoint is intentionally **public at the platform level** (the Scripted REST
routes have `authentication: false, authorization: false, internalRole: false`)
so an external client can call in with only an API key — no ServiceNow login. The
consequence: the handler executes as the **unauthenticated guest user**, which
**cannot decrypt** a Connections & Credentials secret and **cannot call
cross-scope `sn_cc` APIs** at request time. So all authentication must be done
with information already available to a guest: the request headers and a
pre-computed value in a system property.

Two independent gates are layered, checked in this order on every request:
1. **IP allow list** (defense-in-depth, optional) → reject with 403 if the source isn't allowed.
2. **API key** (primary gate, always on) → reject with 401 if the presented key doesn't match.

---

## 2. Authentication: the "privileged hash-sync" pattern

**Core idea:** never decrypt the credential in the request path. Instead, decrypt
it once at *save time* (in a privileged context), compute a salted hash, and
stash the hash in a system property. The guest handler just hashes the presented
key the same way and compares.

### Components

**(a) Encrypted credential record** — `api_key_credentials` table, created via
Fluent `Record()`. Ships with a **non-functional placeholder** value (never a
real key in git). Capture it in an exported const so other Fluent records can
reference its `.$id`.

**(b) `before insert/update` Business Rule** on that credential, filtered to just
that record. **Critical:** filter on the record's `.$id` (e.g.
`` filterCondition: `sys_id=${cred.$id}` ``), NOT a hardcoded sys_id literal — a
literal breaks on reinstall/re-scope because the `Now.ID` hash changes, and the
rule then silently never fires. The rule runs in the privileged admin save
context, so it CAN decrypt. Its script:
   - Resolves the plaintext key with a 3-tier fallback: (1) `sn_cc`
     `StandardCredentialsProvider().getCredentialByID(sysId).getAttribute('api_key')`,
     (2) `current.getElement('api_key').getDecryptedValue()`,
     (3) `current.getValue('api_key')`.
   - Computes `salted_hash = SHA256(SALT + '::' + key)`.
   - Writes it: `gs.setProperty('<scope>.mcp_inbound_key_hash', hash)`.
   - If the key is empty/placeholder, writes an empty hash → endpoint stays
     locked (rejects everything).

**(c) The request handler** extracts the presented key, hashes it with the same
salt, and compares to the stored property. No credential access occurs.

**(d) Cross-scope privileges** (`CrossScopePrivilege`, declared in Fluent so
they're source-controlled): `ScriptableStandardCredentialsProvider.getCredentialByID`
and `ScriptableStandardCredential.getAttribute` — used **only** by the business
rule, never the handler. (If you emit SSE, also declare `getStreamWriter` /
`writeString`.)

### Why the key-hash property is NOT Fluent-managed

Do **not** declare `<scope>.mcp_inbound_key_hash` with Fluent `Property()`. A
Fluent-managed `sys_properties` record is platform-protected against runtime
writes, which would block the business rule's `gs.setProperty()`. Let the BR
create it at runtime instead.

### Header extraction (precedence)

Accept whichever standard header the caller uses:
1. `Authorization: Bearer <key>` (regex `^bearer\s+(.+)$`, case-insensitive)
2. bare `Authorization: <key>`
3. `X-API-Key: <key>`

### SHA-256 must be pure-JS and inlined (important platform constraint)

- Use a **pure-JavaScript FIPS 180-4 SHA-256** (returns lowercase hex). Do NOT
  use Glide crypto — the function must run in both the privileged BR context and
  the unprivileged guest context.
- Keep a canonical `authConfig.ts` (exports `KEY_HASH_PROPERTY`,
  `KEY_HASH_SALT = '<scope>::mcp-inbound::v1'`, `CREDENTIAL_PLACEHOLDER`, and a
  `hashApiKey()` helper) and `sha256.ts` as the single source of truth, consumed
  at build time by the Fluent-compiled BR.
- **BUT** also **inline copies** of the SHA-256 function + constants into each
  runtime server module (the handler AND the BR script). Reason: the platform's
  runtime module resolver can't resolve relative imports between app server
  modules (it strips the `.ts` extension, but `sys_module` paths include `.ts`,
  so the lookup fails). Each runtime module must be self-contained. **If you
  change the salt or algorithm, update every inlined copy.**

### Pseudocode — handler auth check

```
function isAuthorized(request):
    storedHash = gs.getProperty('<scope>.mcp_inbound_key_hash', '').trim()
    if not storedHash: return false            // unconfigured → locked
    presented = extractApiKey(request)
    if not presented: return false
    return hashApiKey(presented) === storedHash   // hashApiKey returns '' for empty/placeholder

// on failure: HTTP 401, WWW-Authenticate: Bearer realm="...", JSON/JSON-RPC error (-32001)
```

---

## 3. IP allow list (defense-in-depth source restriction)

A single runtime property, **`<scope>.mcp_allowed_ips`**: a comma-separated list
of entries, each one of:
- exact **IPv4** (`203.0.113.9`)
- **IPv4 CIDR** (`198.51.100.0/24`)
- exact **IPv6** (case-insensitive string match)

### Behavior rules

- **Absent/empty ⇒ feature DISABLED, allow all.** This is the safe, portable
  default (API key still gates). A populated list silently 403s anything it
  doesn't match.
- **Populated ⇒** resolve the client IP; if it matches no entry → **HTTP 403** +
  error code (`-32003`).
- **Fail closed:** if the list is set but the client IP can't be determined, deny.
- Checked **before** the API-key check, on every verb (POST/GET/DELETE).

### Client IP resolution

Leftmost `X-Forwarded-For` entry (`xff.split(',')[0].trim()`), else `X-Real-IP`.

### IPv4 + CIDR matching

```
ipv4ToInt(ip): validate 4 octets ≤255 → 32-bit unsigned int (or null)
match(clientIp, entry):
    if entry has no '/':  exact → compare ints if both parse as IPv4, else lowercase string compare (IPv6)
    else: split network/bits; mask = (0xFFFFFFFF << (32-bits)) >>> 0; return (netInt & mask) === (clientIp_int & mask)
         // guard bits 0..32; bits===0 matches all
```

### Pseudocode — handler entry

```
function process(request, response):
    if not isSourceAllowed(request):   // empty list ⇒ true
        log('DENIED', 'ip-denied', 403); sendForbidden(403, -32003); return
    if not isAuthorized(request):
        log('DENIED', '-', 401); sendUnauthorized(401, -32001); return
    ... handle request ...
```

### ⚠️ Honest limitations to document

- XFF is **client-supplied and spoofable** → this is **defense in depth, not a
  hard boundary**; the API key remains the primary gate. For a hard boundary, use
  the platform's IP Address Access Control (High Security Settings) or an edge WAF.
- "Restrict to the hosting instance" has no clean signal: an instance calling its
  own public URL egresses from a **private `10.x` app-node address** (often a pool
  of several), so the practical config is `10.0.0.0/8` — but that **blocks any
  public-IP caller** (many PDIs/external integrations). Default the shipped value
  to empty; let operators opt in once they've watched the logs to learn their real
  source IPs.

---

## 4. Runtime properties summary (all created at runtime, none Fluent-managed)

| Property | Set by | Default | Purpose |
|---|---|---|---|
| `<scope>.mcp_inbound_key_hash` | business rule | empty (locked) | salted hash of the valid key |
| `<scope>.mcp_allowed_ips` | admin / helper script | `''` (allow all) | IP allow list |

Provide a root-level **background-script helper** (e.g. `init-properties.js`) with
a `CONFIG` block that sets the allow list in one run and logs each value — run it
in **Scripts - Background** in the app scope. (The key-hash property is populated
by saving the credential, not by this script.)

---

## 5. Observability

Emit one filterable syslog line per request, prefixed `[MCP]` (or your app tag), e.g.:

```
[MCP] method=POST auth=OK|DENIED rpc=<summary|ip-denied> status=<code> ip=<client> ua="<ua>" uri="<uri>"
```

Use `gs.warn` for denials (`auth=DENIED rpc=ip-denied status=403` vs.
`rpc=- status=401`) so you can distinguish IP-based from key-based rejections and
watch for legitimate callers getting blocked before tightening the list.

---

## 6. Build order & gotchas checklist

1. Write `sha256.ts` + `authConfig.ts` (canonical).
2. Build the handler: inline SHA-256 + constants; add `extractApiKey`,
   `isAuthorized`, `sendUnauthorized`.
3. Add IP functions: `getAllowedIpEntries`, `getClientIp`, `ipv4ToInt`,
   `ipMatchesEntry`, `isSourceAllowed`, `sendForbidden`.
4. Wire both checks into every route entry point (IP first, then key).
5. Fluent: credential `Record()` (placeholder, exported const) + `before` BR
   (filter via `.$id`, inline SHA-256) + `CrossScopePrivilege`s + public
   `RestApi` routes.
6. **Post-install (manual, required):** set a real key on the credential (fires
   the BR → populates the hash); optionally set the allow list.

**Pitfalls that will bite you:**
- Hardcoded sys_id in the BR filter → silent lockout after re-scope. Use `.$id`.
- Declaring the hash property via `Property()` → BR can't write it. Leave it runtime-created.
- Relative import between server modules → runtime resolution failure. Inline instead.
- Non-empty allow-list default in a shared artifact → silent 403s for forkers. Default empty.
- Treating the IP list as a security boundary → it isn't; keep the API key as the real gate.
