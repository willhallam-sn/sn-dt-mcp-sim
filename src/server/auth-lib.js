import { gs } from '@servicenow/glide'

/**
 * In-handler authentication + source restriction for the public MCP endpoint.
 *
 * The Scripted REST routes are public at the platform level (no ServiceNow
 * login), so the handler runs as the unauthenticated guest user and must gate
 * itself here. Two gates are layered, checked IP-first then key:
 *   1. IP allow list  (x_snc_dynatrace_mc.mcp_allowed_ips)   -> 403 / -32003
 *   2. API key        (x_snc_dynatrace_mc.mcp_inbound_key_hash) -> 401 / -32001
 *
 * The guest never decrypts the credential. A privileged business rule hashes
 * the real key at save time into mcp_inbound_key_hash; here we just hash the
 * presented key the same way and compare.
 *
 * SHA-256 is pure JS so it runs identically in the guest handler and the
 * privileged business rule. The salt/algorithm are duplicated (inlined) in
 * src/server/key-hash-br.js -- KEEP BOTH COPIES IN SYNC.
 */

export var KEY_HASH_PROPERTY = 'x_snc_dynatrace_mc.mcp_inbound_key_hash'
export var ALLOWED_IPS_PROPERTY = 'x_snc_dynatrace_mc.mcp_allowed_ips'
export var KEY_HASH_SALT = 'x_snc_dynatrace_mc::mcp-inbound::v1'
export var CREDENTIAL_PLACEHOLDER = 'REPLACE_WITH_REAL_KEY'

/** Pure-JS FIPS 180-4 SHA-256. Returns lowercase hex. */
export function sha256(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount))
    }
    var maxWord = Math.pow(2, 32)
    var result = ''
    var words = []
    ascii = unescape(encodeURIComponent(ascii))
    var asciiBitLength = ascii.length * 8

    var hash = []
    var k = []
    var primeCounter = 0

    var isComposite = {}
    for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (var i = 0; i < 313; i += candidate) {
                isComposite[i] = candidate
            }
            hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0
            k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0
        }
    }

    ascii += '\x80'
    while ((ascii.length % 64) - 56) {
        ascii += '\x00'
    }
    for (var i = 0; i < ascii.length; i++) {
        var j = ascii.charCodeAt(i)
        if (j >> 8) return ''
        words[i >> 2] |= j << (((3 - i) % 4) * 8)
    }
    words[words.length] = (asciiBitLength / maxWord) | 0
    words[words.length] = asciiBitLength

    for (var j2 = 0; j2 < words.length;) {
        var w = words.slice(j2, (j2 += 16))
        var oldHash = hash
        hash = hash.slice(0, 8)

        for (var i2 = 0; i2 < 64; i2++) {
            var w15 = w[i2 - 15]
            var w2 = w[i2 - 2]
            var a = hash[0]
            var e = hash[4]
            var temp1 =
                hash[7] +
                (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
                ((e & hash[5]) ^ (~e & hash[6])) +
                k[i2] +
                (w[i2] =
                    i2 < 16
                        ? w[i2]
                        : (w[i2 - 16] +
                              (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                              w[i2 - 7] +
                              (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                          0)
            var temp2 =
                (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
                ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))
            hash = [(temp1 + temp2) | 0].concat(hash)
            hash[4] = (hash[4] + temp1) | 0
        }

        for (var i3 = 0; i3 < 8; i3++) {
            hash[i3] = (hash[i3] + oldHash[i3]) | 0
        }
    }

    for (var i4 = 0; i4 < 8; i4++) {
        for (var j3 = 3; j3 + 1; j3--) {
            var b = (hash[i4] >> (j3 * 8)) & 255
            result += (b < 16 ? '0' : '') + b.toString(16)
        }
    }
    return result
}

/** Hash a presented key with the shared salt. Empty/placeholder -> '' (never matches). */
export function hashApiKey(key) {
    if (!key) return ''
    if (key === CREDENTIAL_PLACEHOLDER) return ''
    return sha256(KEY_HASH_SALT + '::' + key)
}

function getHeader(request, name) {
    try {
        return request.getHeader(name)
    } catch (e) {
        return null
    }
}

/** Extract the presented API key: Bearer, bare Authorization, or X-API-Key. */
export function extractApiKey(request) {
    var auth = getHeader(request, 'Authorization') || getHeader(request, 'authorization')
    if (auth) {
        auth = ('' + auth).trim()
        var m = /^bearer\s+(.+)$/i.exec(auth)
        if (m) return m[1].trim()
        return auth
    }
    var xk = getHeader(request, 'X-API-Key') || getHeader(request, 'x-api-key')
    if (xk) return ('' + xk).trim()
    return ''
}

/** True if the presented key hashes to the stored hash. Unconfigured -> locked. */
export function isAuthorized(request) {
    var stored = ('' + (gs.getProperty(KEY_HASH_PROPERTY, '') || '')).trim()
    if (!stored) return false
    var presented = extractApiKey(request)
    if (!presented) return false
    return hashApiKey(presented) === stored
}

/* ------------------------------- IP allow list ------------------------------ */

/**
 * Resolve the client IP.
 *
 * Prefer gs.getSession().getClientIP(): the platform resolves this from the
 * ServiceNow edge/load balancer at a trusted position, so it is harder to
 * forge than a raw X-Forwarded-For header the caller can set freely. Fall back
 * to X-Forwarded-For / X-Real-IP only if the session lookup is unavailable.
 *
 * Note: for any proxied HTTP request this value is still ultimately derived
 * from forwarding metadata, so treat the IP allow list as defense-in-depth,
 * not a hard boundary. The API key remains the primary gate.
 */
export function getClientIp(request) {
    try {
        var sess = gs.getSession()
        if (sess) {
            var sip = '' + sess.getClientIP()
            if (sip && sip.toLowerCase() !== 'null') return sip.trim()
        }
    } catch (e) {}
    var xff = getHeader(request, 'X-Forwarded-For') || getHeader(request, 'x-forwarded-for')
    if (xff) return ('' + xff).split(',')[0].trim()
    var xr = getHeader(request, 'X-Real-IP') || getHeader(request, 'x-real-ip')
    if (xr) return ('' + xr).trim()
    return ''
}

function getAllowedIpEntries() {
    var raw = ('' + (gs.getProperty(ALLOWED_IPS_PROPERTY, '') || '')).trim()
    if (!raw) return []
    var out = []
    var parts = raw.split(',')
    for (var i = 0; i < parts.length; i++) {
        var e = parts[i].trim()
        if (e) out.push(e)
    }
    return out
}

function ipv4ToInt(ip) {
    var parts = ('' + ip).split('.')
    if (parts.length !== 4) return null
    var n = 0
    for (var i = 0; i < 4; i++) {
        if (!/^\d+$/.test(parts[i])) return null
        var o = parseInt(parts[i], 10)
        if (isNaN(o) || o < 0 || o > 255) return null
        n = n * 256 + o
    }
    return n >>> 0
}

function ipMatchesEntry(clientIp, entry) {
    if (entry.indexOf('/') === -1) {
        var a = ipv4ToInt(clientIp)
        var b = ipv4ToInt(entry)
        if (a !== null && b !== null) return a === b
        return ('' + clientIp).toLowerCase() === ('' + entry).toLowerCase()
    }
    var seg = entry.split('/')
    var net = ipv4ToInt(seg[0])
    var bits = parseInt(seg[1], 10)
    var ci = ipv4ToInt(clientIp)
    if (net === null || ci === null || isNaN(bits) || bits < 0 || bits > 32) return false
    if (bits === 0) return true
    var mask = (0xffffffff << (32 - bits)) >>> 0
    return (net & mask) === (ci & mask)
}

/** Empty list => allow all. Populated => client IP must match; fail closed if unknown. */
export function isSourceAllowed(request) {
    var entries = getAllowedIpEntries()
    if (entries.length === 0) return true
    var ip = getClientIp(request)
    if (!ip) return false
    for (var i = 0; i < entries.length; i++) {
        if (ipMatchesEntry(ip, entries[i])) return true
    }
    return false
}

/* ------------------------------- gate + logging ----------------------------- */

/** IP first, then key. Returns {ok:true} or {ok:false,status,code,message,reason}. */
export function checkAccess(request) {
    if (!isSourceAllowed(request)) {
        return { ok: false, status: 403, code: -32003, message: 'Source IP not allowed', reason: 'ip-denied' }
    }
    if (!isAuthorized(request)) {
        return { ok: false, status: 401, code: -32001, message: 'Invalid or missing API key', reason: 'key-denied' }
    }
    return { ok: true, reason: 'OK' }
}

/** One filterable [MCP] syslog line per request. Denials use gs.warn. */
export function logRequest(request, reason, status, rpcSummary) {
    var ip = getClientIp(request) || '-'
    var ua = '-'
    var uri = '-'
    try {
        ua = getHeader(request, 'User-Agent') || getHeader(request, 'user-agent') || '-'
    } catch (e) {}
    try {
        uri = request.uri || '-'
    } catch (e) {}
    var auth = reason === 'OK' ? 'OK' : 'DENIED'
    var line =
        '[MCP] auth=' + auth + ' rpc=' + (rpcSummary || '-') + ' status=' + status + ' ip=' + ip + ' ua="' + ua + '" uri="' + uri + '"'
    if (auth === 'OK') {
        gs.info(line)
    } else {
        gs.warn(line)
    }
}
