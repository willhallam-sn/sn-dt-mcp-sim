import { parseExchanges, exchangeToSpec, upsertSpec, TABLE } from './mcp-lib.js'
import { checkAccess, logRequest } from './auth-lib.js'
import { GlideRecord } from '@servicenow/glide'

/**
 * Capture-file import endpoint.
 *
 * POST the contents of a capture file (such as mcp-rronly.json) to populate the
 * Canned MCP Response table. Accepts the saved envelope
 * ({ result: { content: "<stream>" } }), a raw concatenated/NDJSON stream of
 * { request, response } objects, or a JSON array of them. Each tool call and
 * the initialize handshake become (or update) a row, so the simulated tenant
 * returns exactly what the real Dynatrace MCP server returned.
 *
 * After loading, a tools/list row is (re)generated from the discovered tools
 * and their observed argument shapes.
 */

function regenerateToolsList() {
    // Collect distinct tools and the union of argument keys seen for each.
    var toolArgs = {}
    var gr = new GlideRecord(TABLE)
    gr.addQuery('method', 'tools/call')
    gr.addQuery('active', true)
    gr.query()
    while (gr.next()) {
        var name = '' + gr.getValue('tool_name')
        if (!name) continue
        if (!toolArgs[name]) toolArgs[name] = {}
        var argsStr = '' + gr.getValue('request_arguments')
        try {
            var args = JSON.parse(argsStr)
            if (args && typeof args === 'object') {
                var keys = Object.keys(args)
                for (var i = 0; i < keys.length; i++) {
                    toolArgs[name][keys[i]] = true
                }
            }
        } catch (e) {
            /* ignore */
        }
    }

    var tools = []
    var names = Object.keys(toolArgs).sort()
    for (var n = 0; n < names.length; n++) {
        var tname = names[n]
        var props = {}
        var required = []
        var argKeys = Object.keys(toolArgs[tname])
        for (var a = 0; a < argKeys.length; a++) {
            props[argKeys[a]] = { type: 'string' }
            required.push(argKeys[a])
        }
        var schema = { type: 'object', properties: props, additionalProperties: true }
        if (required.length) schema.required = required
        tools.push({
            name: tname,
            description: 'Simulated Dynatrace MCP tool: ' + tname,
            inputSchema: schema,
        })
    }

    var result = { tools: tools }
    upsertSpec({
        method: 'tools/list',
        tool_name: '',
        match_type: 'default',
        match_key: '',
        name: 'tools/list (auto-generated)',
        request_arguments: '',
        response_payload: JSON.stringify(result),
    })
    return tools.length
}

export function handleImport(request, response) {
    response.setHeader('Content-Type', 'application/json')

    // Gate: IP allow list, then API key (same gate as /mcp).
    var access = checkAccess(request)
    if (!access.ok) {
        if (access.status === 401) {
            response.setHeader('WWW-Authenticate', 'Bearer realm="dynatrace-mcp"')
        }
        response.setStatus(access.status)
        response.setBody({ success: false, error: access.message })
        logRequest(request, access.reason, access.status, access.reason === 'ip-denied' ? 'ip-denied' : 'import')
        return
    }

    var raw = ''
    try {
        raw = request.body && request.body.dataString ? request.body.dataString : ''
    } catch (e) {
        raw = ''
    }

    if (!raw) {
        response.setStatus(400)
        response.setBody({ success: false, error: 'Empty request body. POST the capture file contents.' })
        return
    }

    var exchanges
    try {
        exchanges = parseExchanges(raw)
    } catch (e) {
        response.setStatus(400)
        response.setBody({ success: false, error: 'Could not parse capture: ' + e })
        return
    }

    var created = 0
    var updated = 0
    var skipped = 0
    for (var i = 0; i < exchanges.length; i++) {
        var spec = exchangeToSpec(exchanges[i])
        if (!spec) {
            skipped++
            continue
        }
        var action = upsertSpec(spec)
        if (action === 'created') created++
        else updated++
    }

    var toolCount = regenerateToolsList()

    response.setStatus(200)
    response.setBody({
        success: true,
        exchanges: exchanges.length,
        created: created,
        updated: updated,
        skipped: skipped,
        tools_advertised: toolCount,
    })
}
