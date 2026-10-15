// @ts-nocheck
/*
 * Script Include wrapper: DynatraceGetProblemById
 *
 * Thin bridge that exposes the simulated Dynatrace MCP tool "get-problem-by-id"
 * to server-side scripts (business rules, Flow/AI-agent script steps,
 * background scripts) WITHOUT making an MCP/HTTP call. It delegates to the same
 * generator the /mcp endpoint uses (resolveToolResult in mcp-lib.js), so the
 * script result is identical to a tools/call result.
 *
 * Per the SDK "bridging modules through script includes" pattern, this wrapper
 * uses Class.create + require() and must NOT import Glide APIs. All logic lives
 * in the bundled module. The require path includes the package version; it is
 * the same resolvable module id the generated REST operation scripts use.
 *
 * Usage:
 *   var dt = new x_snc_dynatrace_mc.DynatraceGetProblemById();
 *   var result  = dt.getProblemById('P-261013'); // full MCP result object
 *   var records = dt.getRecords('P-261013');      // just structuredContent.records
 *   var raw     = dt.call({ problemId: 'P-261013' }); // exact MCP-arg parity
 */
var DynatraceGetProblemById = Class.create()
DynatraceGetProblemById.prototype = {
    initialize: function () {
        this._lib = require('./src/server/mcp-lib.js')
    },

    /**
     * Same input as the MCP tool. Pass the tool arguments object ({ problemId }).
     * Returns the MCP result object: { content, isError, structuredContent }.
     */
    call: function (args) {
        return this._lib.resolveToolResult('get-problem-by-id', args || {})
    },

    /** Convenience: pass the problem id directly. Returns the MCP result object. */
    getProblemById: function (problemId) {
        return this.call({ problemId: problemId })
    },

    /** Convenience: the structuredContent.records array (empty array if none). */
    getRecords: function (problemId) {
        var r = this.getProblemById(problemId)
        return (r && r.structuredContent && r.structuredContent.records) || []
    },

    type: 'DynatraceGetProblemById',
}
