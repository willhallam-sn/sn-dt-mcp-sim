import { RestApi } from '@servicenow/sdk/core'
import { handleMcp, handleMcpGet, handleMcpDelete } from '../../server/mcp-handler'
import { handleImport } from '../../server/mcp-import'

/**
 * Dynatrace MCP Simulator REST service.
 *
 * Base URL: /api/x_snc_dynatrace_mc/dynatrace_mcp
 *   POST /mcp     -> MCP Streamable-HTTP endpoint (point an MCP client here)
 *   POST /import  -> load a capture file into the Canned MCP Response table
 */
RestApi({
    $id: Now.ID['dynatrace-mcp-api'],
    name: 'Dynatrace MCP Simulator',
    serviceId: 'dynatrace_mcp',
    consumes: 'application/json',
    produces: 'application/json',
    shortDescription: 'Emulates the Dynatrace MCP server over a REST endpoint using canned responses.',
    routes: [
        {
            $id: Now.ID['dynatrace-mcp-route-mcp'],
            name: 'mcp',
            method: 'POST',
            path: '/mcp',
            script: handleMcp,
            consumes: 'application/json',
            produces: 'application/json,text/event-stream',
            // Public at the platform level: no ServiceNow login. The handler
            // gates itself with an API key (+ optional IP allow list) so an
            // external MCP client can connect like a real Dynatrace tenant.
            authentication: false,
            authorization: false,
            internalRole: false,
            requestExample: '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get-problem-by-id","arguments":{"problemId":"P-261013"}}}',
            shortDescription: 'MCP JSON-RPC endpoint (initialize, tools/list, tools/call, ping). Public; API-key gated in-script.',
        },
        {
            $id: Now.ID['dynatrace-mcp-route-mcp-get'],
            name: 'mcp_get',
            method: 'GET',
            path: '/mcp',
            script: handleMcpGet,
            produces: 'application/json',
            // MCP Streamable-HTTP clients open GET /mcp to listen for
            // server-initiated SSE. We don't push, so this returns 405 (per
            // spec). Must exist, else the platform 404s the GET before our
            // script runs and the client's session worker crashes.
            authentication: false,
            authorization: false,
            internalRole: false,
            shortDescription: 'MCP server-stream probe. Returns 405 (no server-initiated SSE). Public.',
        },
        {
            $id: Now.ID['dynatrace-mcp-route-mcp-delete'],
            name: 'mcp_delete',
            method: 'DELETE',
            path: '/mcp',
            script: handleMcpDelete,
            produces: 'application/json',
            // MCP session termination; acknowledged with 200 so teardown is clean.
            authentication: false,
            authorization: false,
            internalRole: false,
            shortDescription: 'MCP session termination. Returns 200. Public.',
        },
        {
            $id: Now.ID['dynatrace-mcp-route-import'],
            name: 'import',
            method: 'POST',
            path: '/import',
            script: handleImport,
            consumes: 'application/json',
            produces: 'application/json',
            // Public + API-key gated in-script (same gate as /mcp).
            authentication: false,
            authorization: false,
            internalRole: false,
            shortDescription: 'Load a capture file (e.g. mcp-rronly.json) into the canned response table. Public; API-key gated in-script.',
        },
    ],
})
