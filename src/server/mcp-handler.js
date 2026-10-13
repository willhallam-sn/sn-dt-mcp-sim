import {
    buildInitializeResult,
    buildToolsListResult,
    resolveToolResult,
    missingToolResult,
    jsonrpcResult,
    jsonrpcError,
    newSessionId,
    readRequestBody,
} from './mcp-lib.js'
import { checkAccess, logRequest } from './auth-lib.js'

/**
 * MCP Streamable-HTTP endpoint for the Dynatrace MCP Simulator.
 *
 * Public at the platform level; this handler gates itself with an IP allow
 * list then an API key (see auth-lib.js) before doing any MCP work, so an AI
 * agent connects exactly as it would to a real Dynatrace MCP server.
 *
 *   - initialize            -> serverInfo + capabilities (+ Mcp-Session-Id header)
 *   - notifications/*       -> 202 Accepted, no body
 *   - tools/list            -> advertised tools
 *   - tools/call            -> canned result looked up from the response table
 *   - ping                  -> {}
 */

function dispatch(message) {
    if (!message || typeof message !== 'object') {
        return jsonrpcError(null, -32600, 'Invalid Request')
    }

    var id = message.id
    var isNotification = id === undefined || id === null
    var method = message.method
    var params = message.params || {}

    if (isNotification) {
        return null
    }

    switch (method) {
        case 'initialize':
            return jsonrpcResult(id, buildInitializeResult(params))
        case 'tools/list':
            return jsonrpcResult(id, buildToolsListResult())
        case 'tools/call': {
            var toolName = params.name
            var args = params.arguments || {}
            var result = resolveToolResult(toolName, args)
            if (!result) {
                result = missingToolResult(toolName, args)
            }
            return jsonrpcResult(id, result)
        }
        case 'ping':
            return jsonrpcResult(id, {})
        default:
            return jsonrpcError(id, -32601, 'Method not found: ' + method)
    }
}

function summarize(message) {
    if (Array.isArray(message)) {
        return 'batch(' + message.length + ')'
    }
    if (message && typeof message === 'object') {
        var m = message.method || '?'
        if (m === 'tools/call' && message.params && message.params.name) {
            return 'tools/call:' + message.params.name
        }
        return '' + m
    }
    return '-'
}

/** True if the client negotiated the SSE transport (MCP Streamable HTTP). */
function wantsSse(request) {
    var accept = ''
    try {
        accept = '' + (request.getHeader('Accept') || request.getHeader('accept') || '')
    } catch (e) {
        accept = ''
    }
    return /text\/event-stream/i.test(accept)
}

/**
 * Emit one or more JSON-RPC responses as an SSE stream, the way the real
 * dynatrace-mcp server (MCP SDK Streamable HTTP transport) does. Each message
 * is its own `event: message` / `data: <json>` frame; the stream then closes.
 */
function sendSse(response, messages) {
    response.setStatus(200)
    response.setContentType('text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    var list = Array.isArray(messages) ? messages : [messages]
    var buf = ''
    for (var i = 0; i < list.length; i++) {
        buf += 'event: message\ndata: ' + JSON.stringify(list[i]) + '\n\n'
    }
    var writer = response.getStreamWriter()
    writer.writeString(buf)
}

export function handleMcp(request, response) {
    response.setHeader('Content-Type', 'application/json')

    // Gate: IP allow list, then API key.
    var access = checkAccess(request)
    if (!access.ok) {
        if (access.status === 401) {
            response.setHeader('WWW-Authenticate', 'Bearer realm="dynatrace-mcp"')
        }
        response.setStatus(access.status)
        response.setBody(jsonrpcError(null, access.code, access.message))
        logRequest(request, access.reason, access.status, access.reason === 'ip-denied' ? 'ip-denied' : '-')
        return
    }

    var body = readRequestBody(request)

    // Preserve / assign an MCP session id.
    var sessionId = ''
    try {
        sessionId = request.getHeader('mcp-session-id') || ''
    } catch (e) {
        sessionId = ''
    }
    if (!sessionId) {
        sessionId = newSessionId()
    }
    response.setHeader('Mcp-Session-Id', sessionId)

    // Resolve the JSON-RPC message from the parsed body or the raw string.
    var message = body.json
    if (message === undefined) {
        if (!body.raw) {
            response.setStatus(202)
            logRequest(request, 'OK', 202, 'empty-body')
            return
        }
        try {
            message = JSON.parse(body.raw)
        } catch (e) {
            response.setStatus(400)
            response.setBody(jsonrpcError(null, -32700, 'Parse error'))
            logRequest(request, 'OK', 400, 'parse-error')
            return
        }
    }

    var summary = summarize(message)
    var sse = wantsSse(request)

    // Collect responses (notifications produce none).
    var responses = []
    if (Array.isArray(message)) {
        for (var i = 0; i < message.length; i++) {
            var r = dispatch(message[i])
            if (r !== null) {
                responses.push(r)
            }
        }
    } else {
        var single = dispatch(message)
        if (single !== null) {
            responses.push(single)
        }
    }

    // Notifications/responses only -> 202 Accepted, no body (both transports).
    if (responses.length === 0) {
        response.setStatus(202)
        logRequest(request, 'OK', 202, summary)
        return
    }

    var payload = Array.isArray(message) ? responses : responses[0]
    if (sse) {
        sendSse(response, payload)
        logRequest(request, 'OK', 200, summary + ' (sse)')
        return
    }
    response.setStatus(200)
    response.setBody(payload)
    logRequest(request, 'OK', 200, summary)
}
