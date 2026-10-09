import { GlideRecord, gs } from '@servicenow/glide'

/**
 * Shared logic for the Dynatrace MCP Simulator.
 *
 * The simulator stores canned MCP interactions in the
 * `x_snc_dynatrace_mc_response` table. Each row holds the JSON-RPC `result`
 * payload returned for a given MCP method (and, for tool calls, a tool name +
 * argument match key). This module provides the lookup/matching used by the
 * MCP endpoint and the parsing used by the capture-file import endpoint.
 */

export var TABLE = 'x_snc_dynatrace_mc_response'

/** Collapse all whitespace so DQL / argument matching is tolerant of formatting. */
export function normalizeWhitespace(s) {
    return String(s == null ? '' : s)
        .replace(/\s+/g, ' ')
        .trim()
}

/** Deterministic stringify with sorted keys, for generic argument matching. */
export function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        var parts = []
        for (var i = 0; i < value.length; i++) {
            parts.push(stableStringify(value[i]))
        }
        return '[' + parts.join(',') + ']'
    }
    var keys = Object.keys(value).sort()
    var props = []
    for (var k = 0; k < keys.length; k++) {
        props.push(JSON.stringify(keys[k]) + ':' + stableStringify(value[keys[k]]))
    }
    return '{' + props.join(',') + '}'
}

/**
 * Derive a stable match key from a tool name + arguments. Mirrors the key
 * stored on seed/imported rows so an incoming call lines up with a canned row.
 */
export function extractKey(toolName, args) {
    var a = args || {}
    if (typeof a.dqlQueryString === 'string') {
        return 'dql:' + normalizeWhitespace(a.dqlQueryString)
    }
    if (typeof a.problemId === 'string') {
        return 'problemId:' + a.problemId
    }
    if (typeof a.entityId === 'string') {
        return 'entityId:' + a.entityId
    }
    return 'args:' + stableStringify(a)
}

export function deepEqual(a, b) {
    if (a === b) return true
    if (a === null || b === null) return a === b
    if (typeof a !== 'object' || typeof b !== 'object') return a === b
    var aArr = Array.isArray(a)
    var bArr = Array.isArray(b)
    if (aArr !== bArr) return false
    if (aArr) {
        if (a.length !== b.length) return false
        for (var i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false
        }
        return true
    }
    var ak = Object.keys(a)
    var bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    for (var j = 0; j < ak.length; j++) {
        var key = ak[j]
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false
        if (!deepEqual(a[key], b[key])) return false
    }
    return true
}

function safeParse(str, fallback) {
    try {
        return JSON.parse(str)
    } catch (e) {
        return fallback
    }
}

/** Read active rows for a method (optionally a specific tool), ordered by sequence. */
function readRows(method, toolName) {
    var rows = []
    var gr = new GlideRecord(TABLE)
    gr.addQuery('active', true)
    gr.addQuery('method', method)
    if (toolName) {
        gr.addQuery('tool_name', toolName)
    }
    gr.orderBy('sequence')
    gr.query()
    while (gr.next()) {
        rows.push({
            match_type: '' + gr.getValue('match_type'),
            match_key: '' + gr.getValue('match_key'),
            request_arguments: '' + gr.getValue('request_arguments'),
            response_payload: '' + gr.getValue('response_payload'),
            tool_name: '' + gr.getValue('tool_name'),
        })
    }
    return rows
}

/** The initialize result (serverInfo etc). Echoes back the client protocolVersion when present. */
export function buildInitializeResult(params) {
    var rows = readRows('initialize', null)
    var result
    if (rows.length) {
        result = safeParse(rows[0].response_payload, null)
    }
    if (!result) {
        result = {
            protocolVersion: '2025-06-18',
            capabilities: {
                resources: { subscribe: false, listChanged: false },
                tools: { listChanged: false },
            },
            serverInfo: { name: 'dynatrace-mcp', version: '1.0' },
        }
    }
    if (params && params.protocolVersion) {
        result.protocolVersion = params.protocolVersion
    }
    return result
}

/** The tools/list result. Uses a canned row if present, otherwise synthesizes from tool-call rows. */
export function buildToolsListResult() {
    var rows = readRows('tools/list', null)
    if (rows.length) {
        var canned = safeParse(rows[0].response_payload, null)
        if (canned) return canned
    }
    var tools = []
    var seen = {}
    var gr = new GlideRecord(TABLE)
    gr.addQuery('active', true)
    gr.addQuery('method', 'tools/call')
    gr.orderBy('tool_name')
    gr.query()
    while (gr.next()) {
        var t = '' + gr.getValue('tool_name')
        if (t && !seen[t]) {
            seen[t] = true
            tools.push({
                name: t,
                description: 'Simulated Dynatrace MCP tool: ' + t,
                inputSchema: { type: 'object', additionalProperties: true },
            })
        }
    }
    return { tools: tools }
}

/**
 * Find the canned tool result for a tool call. Precedence: exact argument
 * match, then match-key, then a tool-level default. Returns the parsed MCP
 * result object (content/isError/structuredContent) or null if nothing matches.
 */
export function findToolResult(toolName, args) {
    var rows = readRows('tools/call', toolName)
    var incomingKey = extractKey(toolName, args)
    var i

    for (i = 0; i < rows.length; i++) {
        if (rows[i].match_type === 'exact') {
            var stored = safeParse(rows[i].request_arguments, null)
            if (stored && deepEqual(stored, args || {})) {
                return safeParse(rows[i].response_payload, null)
            }
        }
    }
    for (i = 0; i < rows.length; i++) {
        if (rows[i].match_type === 'key' && rows[i].match_key === incomingKey) {
            return safeParse(rows[i].response_payload, null)
        }
    }
    for (i = 0; i < rows.length; i++) {
        if (rows[i].match_type === 'default') {
            return safeParse(rows[i].response_payload, null)
        }
    }
    return null
}

/** MCP tool result used when no canned row matches (isError so clients see a clean failure). */
export function missingToolResult(toolName, args) {
    return {
        content: [
            {
                type: 'text',
                text:
                    'No canned response configured for tool "' +
                    toolName +
                    '" with arguments ' +
                    JSON.stringify(args || {}) +
                    '. Add a row to the Canned MCP Response table or import a capture file.',
            },
        ],
        isError: true,
    }
}

export function jsonrpcResult(id, result) {
    return { jsonrpc: '2.0', id: id === undefined ? null : id, result: result }
}

export function jsonrpcError(id, code, message) {
    return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code: code, message: message } }
}

export function newSessionId() {
    return gs.generateGUID()
}

/* --------------------------------------------------------------------------
 * Capture-file parsing (used by the import endpoint)
 * ------------------------------------------------------------------------ */

/**
 * Unwrap a capture file to the raw request/response stream. Accepts:
 *  - the saved envelope { success, result: { content: "<stream>" } }
 *  - a plain stream of concatenated/NDJSON { request, response } objects
 *  - a JSON array of { request, response } objects
 */
export function unwrapCapture(text) {
    var t = String(text == null ? '' : text).trim()
    var obj = safeParse(t, undefined)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        if (obj.result && typeof obj.result.content === 'string') return obj.result.content
        if (typeof obj.content === 'string') return obj.content
    }
    return t
}

/** Extract top-level JSON values from a concatenated/NDJSON stream. */
export function parseConcatenatedJson(text) {
    var objs = []
    var depth = 0
    var inStr = false
    var esc = false
    var start = -1
    for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i)
        if (inStr) {
            if (esc) {
                esc = false
            } else if (c === '\\') {
                esc = true
            } else if (c === '"') {
                inStr = false
            }
            continue
        }
        if (c === '"') {
            inStr = true
            continue
        }
        if (c === '{' || c === '[') {
            if (depth === 0) start = i
            depth++
            continue
        }
        if (c === '}' || c === ']') {
            depth--
            if (depth === 0 && start >= 0) {
                var sub = text.substring(start, i + 1)
                try {
                    objs.push(JSON.parse(sub))
                } catch (e) {
                    /* ignore malformed fragment */
                }
                start = -1
            }
            continue
        }
    }
    return objs
}

/** Turn a capture file's text into an array of { request, response } exchange objects. */
export function parseExchanges(text) {
    var stream = unwrapCapture(text)
    var parsed = parseConcatenatedJson(stream)
    if (parsed.length === 1 && Array.isArray(parsed[0])) {
        return parsed[0]
    }
    return parsed
}

/**
 * Interpret a single captured exchange and return an upsert spec, or null to
 * skip (e.g. the empty initialized ack). The stored payload is the inner MCP
 * `result` object that the real Dynatrace MCP server returned.
 */
export function exchangeToSpec(exchange) {
    if (!exchange || typeof exchange !== 'object') return null
    var reqStr = exchange.request
    var respStr = exchange.response
    if (!respStr) return null

    var resp = safeParse(respStr, null)
    if (!resp || typeof resp !== 'object') return null
    var result = resp.response
    if (result === undefined || result === null || result === '') return null

    var req = reqStr ? safeParse(reqStr, null) : null
    if (!req || typeof req !== 'object') return null

    // initialize handshake
    if (req.protocolVersion && req.clientInfo) {
        return {
            method: 'initialize',
            tool_name: '',
            match_type: 'default',
            match_key: '',
            name: 'initialize',
            request_arguments: '',
            response_payload: JSON.stringify(result),
        }
    }

    // tools/call: { name, arguments }
    if (typeof req.name === 'string' && req.arguments !== undefined) {
        var args = req.arguments || {}
        var key = extractKey(req.name, args)
        var shortKey = key.length > 80 ? key.substring(0, 77) + '...' : key
        return {
            method: 'tools/call',
            tool_name: req.name,
            match_type: 'key',
            match_key: key,
            name: req.name + ' :: ' + shortKey,
            request_arguments: JSON.stringify(args),
            response_payload: JSON.stringify(result),
            arg_keys: Object.keys(args),
        }
    }

    return null
}

/** Insert or update a canned-response row from a spec. Returns 'created' or 'updated'. */
export function upsertSpec(spec) {
    var gr = new GlideRecord(TABLE)
    gr.addQuery('method', spec.method)
    gr.addQuery('tool_name', spec.tool_name || '')
    if (spec.method === 'tools/call') {
        gr.addQuery('match_key', spec.match_key)
    }
    gr.setLimit(1)
    gr.query()
    var action
    if (gr.next()) {
        action = 'updated'
    } else {
        gr.initialize()
        gr.setValue('method', spec.method)
        gr.setValue('tool_name', spec.tool_name || '')
        gr.setValue('match_key', spec.match_key || '')
        gr.setValue('sequence', 100)
        action = 'created'
    }
    gr.setValue('name', spec.name)
    gr.setValue('match_type', spec.match_type)
    gr.setValue('request_arguments', spec.request_arguments || '')
    gr.setValue('response_payload', spec.response_payload)
    gr.setValue('active', true)
    if (action === 'created') {
        gr.insert()
    } else {
        gr.update()
    }
    return action
}
