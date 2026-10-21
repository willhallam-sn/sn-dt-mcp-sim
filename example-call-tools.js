/*
 * example-call-tools.js — Dynatrace MCP Simulator
 *
 * Example of calling each simulated MCP tool DIRECTLY from a server-side script
 * (no MCP/HTTP request), via the public Script Include wrappers. Paste into
 * Scripts - Background with the application scope set to "Dynatrace MCP
 * Simulator" (or call these classes from a business rule / Flow / AI-agent
 * script step the same way).
 *
 * Each wrapper takes the SAME input as the corresponding MCP tool and returns
 * the SAME MCP result object: { content, isError, structuredContent }.
 */
(function () {
    /* ----------------------------------------------------------------------
     * Tool 1: get-problem-by-id
     * MCP input: { problemId }
     * -------------------------------------------------------------------- */
    var problemTool = new x_snc_dynatrace_mc.DynatraceGetProblemById();

    // Pick a real problem id from em_alert so the demo returns data.
    // (Replace with any specific id, e.g. 'P-261013'.)
    var problemId = 'P-261013';
    var alert = new GlideRecord('em_alert');
    alert.addQuery('message_key', 'STARTSWITH', 'P-');
    alert.orderByDesc('sys_updated_on');
    alert.setLimit(1);
    alert.query();
    if (alert.next()) {
        problemId = '' + alert.getValue('message_key');
    }

    // Full MCP result object (same as an MCP tools/call result).
    var problemResult = problemTool.getProblemById(problemId);

    // Convenience accessor: just the Davis problem record(s).
    var problemRecords = problemTool.getRecords(problemId);

    gs.info('[example] get-problem-by-id(' + problemId + ') isError=' + problemResult.isError + ', records=' + problemRecords.length);
    if (problemRecords.length) {
        var p = problemRecords[0];
        gs.info(
            '[example]   display_id=' + p.display_id +
            ', status=' + p['event.status'] +
            ', name=' + p['event.name'] +
            ', service=' + JSON.stringify(p.affected_entity_names),
        );
    }
    // The exact-MCP-arg form (identical return) would be:
    //   problemTool.call({ problemId: problemId });

    /* ----------------------------------------------------------------------
     * Tool 2: execute-dql
     * MCP input: { dqlQueryString }
     * -------------------------------------------------------------------- */
    var dqlTool = new x_snc_dynatrace_mc.DynatraceExecuteDql();

    var queries = [
        // Davis problem by id (reuses the same em_alert-backed data).
        'fetch dt.davis.problems, from:now() - 24h | filter display_id == "' + problemId + '"',
        // Service entity detail.
        'fetch dt.entity.service | filter id == "SERVICE-612D78ED86A2A09B"',
        // Error-rate time series (bins span the requested window/interval).
        'fetch spans, from: now() - 60m | filter in(dt.entity.service, array("SERVICE-612D78ED86A2A09B")) ' +
            '| filter span.name == "GET /api/recommendations" ' +
            '| summarize { totalRequests = count(), errorRequests = countIf(span.status == "error") }, ' +
            'by: { interval = bin(timestamp, 5m) } | sort interval desc | limit 12',
    ];

    for (var i = 0; i < queries.length; i++) {
        var q = queries[i];
        var dqlResult = dqlTool.execute(q); // full MCP result object
        var records = dqlTool.getRecords(q); // convenience: records array
        gs.info('[example] execute-dql #' + (i + 1) + ' isError=' + dqlResult.isError + ', records=' + records.length);
        gs.info('[example]   query: ' + q);
        if (records.length) {
            gs.info('[example]   first record: ' + JSON.stringify(records[0]));
        }
    }

    // The exact-MCP-arg form (identical return) would be:
    //   dqlTool.call({ dqlQueryString: queries[0] });

    gs.info('[example] Done. See the structuredContent.records of each result for the data an agent would consume.');
})();
