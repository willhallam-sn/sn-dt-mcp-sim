// @ts-nocheck
/*
 * Script Include wrapper: DynatraceExecuteDql
 *
 * Thin bridge that exposes the simulated Dynatrace MCP tool "execute-dql" to
 * server-side scripts (business rules, Flow/AI-agent script steps, background
 * scripts) WITHOUT making an MCP/HTTP call. It delegates to the same generator
 * the /mcp endpoint uses (resolveToolResult in mcp-lib.js), so the script
 * result is identical to a tools/call result.
 *
 * Per the SDK "bridging modules through script includes" pattern, this wrapper
 * uses Class.create + require() and must NOT import Glide APIs. All logic lives
 * in the bundled module. The require path includes the package version; it is
 * the same resolvable module id the generated REST operation scripts use.
 *
 * Usage:
 *   var dql = new x_snc_dynatrace_mc.DynatraceExecuteDql();
 *   var result  = dql.execute('fetch dt.davis.problems ...'); // full MCP result
 *   var records = dql.getRecords('fetch dt.davis.problems ...'); // records only
 *   var raw     = dql.call({ dqlQueryString: 'fetch ...' });   // exact MCP parity
 */
var DynatraceExecuteDql = Class.create()
DynatraceExecuteDql.prototype = {
    initialize: function () {
        this._lib = require('./src/server/mcp-lib.js')
    },

    /**
     * Same input as the MCP tool. Pass the tool arguments object
     * ({ dqlQueryString }). Returns the MCP result object:
     * { content, isError, structuredContent }.
     */
    call: function (args) {
        return this._lib.resolveToolResult('execute-dql', args || {})
    },

    /** Convenience: pass the DQL string directly. Returns the MCP result object. */
    execute: function (dqlQueryString) {
        return this.call({ dqlQueryString: dqlQueryString })
    },

    /** Convenience: the structuredContent.records array (empty array if none). */
    getRecords: function (dqlQueryString) {
        var r = this.execute(dqlQueryString)
        return (r && r.structuredContent && r.structuredContent.records) || []
    },

    type: 'DynatraceExecuteDql',
}
