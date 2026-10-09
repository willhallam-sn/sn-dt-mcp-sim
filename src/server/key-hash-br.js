// @ts-nocheck
/*
 * Business rule script (inlined into the BR record via Now.include).
 *
 * Runs in the PRIVILEGED admin save context on the api_key_credentials record,
 * so it CAN decrypt the key. It computes SHA256(salt::key) and stores it in the
 * runtime property x_snc_dynatrace_mc.mcp_inbound_key_hash, which the public
 * (guest) MCP handler compares against. The plaintext key is never written
 * anywhere and never reaches the request path.
 *
 * SHA-256 + salt are INLINED here on purpose: a Now.include script is raw text
 * and cannot resolve module imports. The canonical copy lives in
 * src/server/auth-lib.js -- IF YOU CHANGE THE SALT OR ALGORITHM, UPDATE BOTH.
 */
;(function executeRule(current, previous) {
    var SALT = 'x_snc_dynatrace_mc::mcp-inbound::v1'
    var PLACEHOLDER = 'REPLACE_WITH_REAL_KEY'
    var PROP = 'x_snc_dynatrace_mc.mcp_inbound_key_hash'

    function sha256(ascii) {
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

        for (var j2 = 0; j2 < words.length; ) {
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

    var key = ''

    // Tier 1: Connections & Credentials provider (works on update once saved).
    try {
        var sysId = current.getUniqueValue()
        var provider = new sn_cc.StandardCredentialsProvider()
        var cred = provider.getCredentialByID(sysId)
        if (cred) {
            var attr = cred.getAttribute('api_key')
            if (attr) key = '' + attr
        }
    } catch (e1) {
        /* fall through */
    }

    // Tier 2: decrypted value on the record being saved (works on insert).
    if (!key) {
        try {
            var dv = current.getElement('api_key').getDecryptedValue()
            if (dv) key = '' + dv
        } catch (e2) {
            /* fall through */
        }
    }

    // Tier 3: raw value (last resort).
    if (!key) {
        try {
            var rv = current.getValue('api_key')
            if (rv) key = '' + rv
        } catch (e3) {
            /* give up */
        }
    }

    var hashHex = ''
    if (key && key !== PLACEHOLDER) {
        hashHex = sha256(SALT + '::' + key)
    }

    gs.setProperty(PROP, hashHex)
    gs.info(
        '[MCP] inbound key-hash sync: ' +
            (hashHex ? 'configured — endpoint unlocked' : 'empty/placeholder — endpoint LOCKED (rejects all)'),
    )
})(current, previous)
