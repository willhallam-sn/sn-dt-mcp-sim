import {
    buildInitializeResult,
    buildToolsListResult,
    findToolResult,
    missingToolResult,
    jsonrpcResult,
    jsonrpcError,
    newSessionId,
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
            var result = findToolResult(toolName, args)
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

    var raw = ''
    try {
        raw = request.body && request.body.dataString ? request.body.dataString : ''
    } catch (e) {
        raw = ''
    }

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

    if (!raw) {
        response.setStatus(202)
        logRequest(request, 'OK', 202, 'empty-body')
        return
    }

    var message
    try {
        message = JSON.parse(raw)
    } catch (e) {
        response.setStatus(400)
        response.setBody(jsonrpcError(null, -32700, 'Parse error'))
        logRequest(request, 'OK', 400, 'parse-error')
        return
    }

    var summary = summarize(message)

    if (Array.isArray(message)) {
        var out = []
        for (var i = 0; i < message.length; i++) {
            var r = dispatch(message[i])
            if (r !== null) {
                out.push(r)
            }
        }
        if (out.length === 0) {
            response.setStatus(202)
            logRequest(request, 'OK', 202, summary)
            return
        }
        response.setStatus(200)
        response.setBody(out)
        logRequest(request, 'OK', 200, summary)
        return
    }

    var single = dispatch(message)
    if (single === null) {
        response.setStatus(202)
        logRequest(request, 'OK', 202, summary)
        return
    }
    response.setStatus(200)
    response.setBody(single)
    logRequest(request, 'OK', 200, summary)
}
