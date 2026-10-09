import { GlideRecord, gs } from '@servicenow/glide'

/**
 * DQL response generator for the Dynatrace MCP Simulator.
 *
 * The real Dynatrace `execute-dql` tool runs a Grail query and returns a result
 * whose situational values (timestamps, time windows, bin series, counts, error
 * rates, queryId) depend on *when* and *how* it was called. Canning a static
 * blob per query is brittle: the SRE agent varies the time window
 * (from: now()-60m / -30m / -2h), bin size, limit, and exact text every run.
 *
 * So for execute-dql we GENERATE a plausible response from the parsed query
 * instead of matching a stored string. The generator:
 *   - parses the data source, filters, time window, interval/bin, limit, sort
 *   - synthesizes now()-relative timestamps and a bin series across the window
 *   - draws stable "facts" (service catalog/topology, the Davis problem, log
 *     templates, per-service error-rate profile, entity schema) from editable
 *     rows in the Canned MCP Response table, falling back to built-in defaults
 *   - emits the real Grail envelope: content[] (Query metadata / Grail types /
 *     Query result records) + structuredContent { records, metadata, types }
 *
 * Unknown/unsupported shapes return a valid-but-empty Grail result (records: [])
 * rather than an error, so the agent degrades gracefully. Genuinely malformed
 * DQL (unbalanced quotes/parens) can optionally be reported as a DQL parse
 * error, mirroring the real server.
 */

var TABLE = 'x_snc_dynatrace_mc_response'
var FACT_TOOL = '_fact'

/* ------------------------------- fact loading ------------------------------ */

/** Read an editable base-fact row (tool_name=_fact, match_key=name) or null. */
function readFact(name) {
    try {
        var gr = new GlideRecord(TABLE)
        gr.addQuery('tool_name', FACT_TOOL)
        gr.addQuery('match_key', name)
        gr.addQuery('active', true)
        gr.setLimit(1)
        gr.query()
        if (gr.next()) {
            return JSON.parse('' + gr.getValue('response_payload'))
        }
    } catch (e) {
        /* fall through to defaults */
    }
    return null
}

/** Service/topology + error-rate profile catalog. Editable via the 'service-catalog' fact. */
function getServiceCatalog() {
    var fact = readFact('service-catalog')
    if (fact && fact.services) return fact
    return {
        services: {
            'SERVICE-612D78ED86A2A09B': {
                name: 'frontend',
                technology: 'NODE_JS',
                iconType: 'node-js',
                environment: 'aew31262',
                baselineRps: 8,
                called_by: ['SERVICE-352C0D90592C8454'],
                calls: [
                    'SERVICE-50FA7E919B28E12B',
                    'SERVICE-3C92115F407E5A92',
                    'SERVICE-FA5C2B6FCA01E2EF',
                    'SERVICE-5173FDDC82067426',
                    'SERVICE-6550EEA117BD5577',
                    'SERVICE-837D260324B57999',
                    'SERVICE-889783342AAF4FF8',
                    'SERVICE-826D760F82C46C41',
                ],
                errorProfile: { endpoint: 'GET /api/recommendations', peakErrorRate: 7.89 },
            },
        },
    }
}

/** Representative error log line templates. Editable via the 'log-templates' fact. */
function getLogTemplates() {
    var fact = readFact('log-templates')
    if (fact && fact.lines) return fact.lines
    return [
        {
            content:
                'ConnectError: [unknown] network error\n    at nz.from (http://frontend-proxy:8080/_next/static/chunks/1y691jxrd1b_3.js:1:116629)\n    at http://frontend-proxy:8080/_next/static/chunks/1y691jxrd1b_3.js:1:123264',
            status: 'ERROR',
            loglevel: 'ERROR',
            'log.iostream': 'stdout',
            'container.name': 'load-generator',
            'host.name': 'ubuntu5',
            'log.source': 'Container Output',
            'dt.openpipeline.source': 'oneagent',
        },
    ]
}

/* --------------------------------- helpers --------------------------------- */

var UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 }

function nowMs() {
    return new Date().getTime()
}

/** Format epoch ms as a Grail nanosecond timestamp: 2026-10-09T13:59:24.123000000Z */
function tsNano(ms) {
    return new Date(ms).toISOString().replace('Z', '000000Z')
}

/** Grail metadata.grail.analysisTimeframe uses float epoch seconds. */
function epochSec(ms) {
    return ms / 1000
}

function parseWindowSeconds(dql) {
    var m = dql.match(/from:\s*now\(\)\s*-\s*(\d+)\s*([smhd])/i)
    if (m) return parseInt(m[1], 10) * UNIT_SECONDS[m[2].toLowerCase()]
    return 7200 // default 2h
}

function parseIntervalSeconds(dql) {
    var m = dql.match(/interval:\s*(\d+)\s*([smhd])/i)
    if (m) return parseInt(m[1], 10) * UNIT_SECONDS[m[2].toLowerCase()]
    var b = dql.match(/bin\(\s*timestamp\s*,\s*(\d+)\s*([smhd])\)/i)
    if (b) return parseInt(b[1], 10) * UNIT_SECONDS[b[2].toLowerCase()]
    return 300 // default 5m
}

function parseLimit(dql) {
    var m = dql.match(/\|\s*limit\s+(\d+)/i)
    return m ? parseInt(m[1], 10) : 0
}

function parseSortDesc(dql) {
    var m = dql.match(/\|\s*sort\s+[\w.]+\s+(asc|desc)/i)
    if (m) return m[1].toLowerCase() === 'desc'
    return true // Grail default for these series is desc
}

function firstMatch(dql, re) {
    var m = dql.match(re)
    return m ? m[1] : null
}

function isoDuration(seconds) {
    if (seconds % 86400 === 0) return 'P' + seconds / 86400 + 'D'
    if (seconds % 3600 === 0) return 'PT' + seconds / 3600 + 'H'
    if (seconds % 60 === 0) return 'PT' + seconds / 60 + 'M'
    return 'PT' + seconds + 'S'
}

function uuid() {
    try {
        return ('' + gs.generateGUID()).replace(/(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5')
    } catch (e) {
        return '01a0f000-0000-7000-0000-000000000000'
    }
}

/** Small deterministic pseudo-random in [0,1) seeded by an integer, for stable jitter. */
function rand(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453
    return x - Math.floor(x)
}

/* ------------------------------ envelope builder --------------------------- */

/**
 * Assemble the full Grail result (content[] + structuredContent) from records,
 * the per-field type mappings, and query metadata.
 */
function buildGrailResult(dql, records, typeMappings, scannedRecords, windowSec) {
    var end = nowMs()
    var start = end - windowSec * 1000
    var grail = {
        canonicalQuery: dql,
        timezone: 'Z',
        query: dql,
        scannedRecords: scannedRecords,
        dqlVersion: 'V1_0',
        scannedBytes: scannedRecords * 1024,
        scannedDataPoints: 0,
        analysisTimeframe: { start: epochSec(start), end: epochSec(end) },
        locale: 'und',
        executionTimeMilliseconds: 30 + Math.floor(rand(scannedRecords + 1) * 170),
        notifications: [],
        queryId: uuid(),
        sampled: false,
    }
    var types = records.length ? [{ mappings: typeMappings || {}, indexRange: [0, Math.max(0, records.length - 1)] }] : []

    var metaText = 'Query metadata:\n' + JSON.stringify({ grail: grail, metrics: [] }, null, 2)
    var typesText = 'Grail types for the records in the query result:\n' + JSON.stringify(types, null, 2)
    var recordsText = 'Query result records:\n' + JSON.stringify(records, null, 2)

    return {
        content: [
            { type: 'text', text: metaText },
            { type: 'text', text: typesText },
            { type: 'text', text: recordsText },
        ],
        isError: false,
        structuredContent: {
            records: records,
            metadata: { grail: grail, metrics: [] },
            types: types,
        },
    }
}

function strType() {
    return { type: 'string', types: [] }
}
function longType() {
    return { type: 'long', types: [] }
}
function doubleType() {
    return { type: 'double', types: [] }
}

/* -------------------------------- generators ------------------------------- */

var SERVICE_SCHEMA_FIELDS = [
    'dt.system.table', 'dt.system.environment', 'lifetime', 'serviceType', 'instantiates', 'externalDependency',
    'belongs_to', 'fallbackServiceType', 'databaseName', 'gcpZone', 'applicationReleaseVersion', 'publicDomainName',
    'serviceDetectionAttributes', 'remoteServiceName', 'softwareTechnologies', 'webApplicationId', 'esbApplicationName',
    'path', 'publicCloudId', 'ibmCtgServerName', 'entity.detected_name', 'entity.name', 'id', 'clustered_by',
    'customIconPath', 'entity.conditional_name', 'sends_to', 'ipAddress', 'receives_from', 'called_by',
    'indirectly_sends_to', 'webServiceName', 'boshName', 'tags', 'webServiceNamespace', 'contains', 'port',
    'databaseHostNames', 'serviceSubType', 'unifiedServiceIndicators', 'applicationEnvironment', 'runs_on', 'icon',
    'className', 'applicationBuildVersion', 'remoteEndpoint', 'matchedServiceDetectionV2Rules', 'managementZones',
    'entity.type', 'databaseVendor', 'serviceTechnologyTypes', 'applicationName', 'agentTechnologyType',
    'cloudDatabaseProvider', 'publicCloudRegion', 'oneAgentCustomHostName', 'webServerName', 'groups',
    'entity.customized_name', 'akkaActorSystem', 'contextRoot', 'indirectly_receives_from', 'isExternalService',
    'dt.security_context', 'ibmCtgGatewayUrl', 'calls', 'awsNameTag', 'remoteCrossEnvironments',
]

function genDescribe(dql, source) {
    var records = []
    if (source === 'dt.entity.service') {
        var fact = readFact('service-schema')
        var fields = fact && fact.fields ? fact.fields : null
        if (fields) {
            records = fields
        } else {
            for (var i = 0; i < SERVICE_SCHEMA_FIELDS.length; i++) {
                records.push({ field: SERVICE_SCHEMA_FIELDS[i], data_types: ['string'] })
            }
        }
    }
    var mappings = { field: strType(), data_types: { type: 'array', types: [{ mappings: { element: strType() }, indexRange: [0, 0] }] } }
    return buildGrailResult(dql, records, mappings, 0, parseWindowSeconds(dql))
}

function genEntityService(dql) {
    var id = firstMatch(dql, /(SERVICE-[0-9A-Fa-f]+)/)
    var catalog = getServiceCatalog()
    var svc = id && catalog.services[id] ? catalog.services[id] : null
    var end = nowMs()
    var rec
    if (svc) {
        rec = {
            'entity.name': svc.name,
            id: id,
            'dt.system.table': 'entities',
            'dt.system.environment': svc.environment || 'aew31262',
            lifetime: { start: tsNano(end - 18 * 3600 * 1000), end: tsNano(end) },
            serviceType: 'UNIFIED',
            serviceDetectionAttributes: { 'service.name': svc.name },
            softwareTechnologies: ['type:' + (svc.technology || 'NODE_JS') + ',edition:null,version:null'],
            'entity.detected_name': svc.name,
            called_by: { 'dt.entity.service': svc.called_by || [] },
            unifiedServiceIndicators: ['METRIC', 'TRACE'],
            icon: { primaryIconType: svc.iconType || 'node-js' },
            'entity.type': 'SERVICE',
            calls: { 'dt.entity.service': svc.calls || [] },
        }
    } else if (id) {
        rec = {
            'entity.name': 'service-' + id.substring(8, 14).toLowerCase(),
            id: id,
            'dt.system.table': 'entities',
            lifetime: { start: tsNano(end - 18 * 3600 * 1000), end: tsNano(end) },
            serviceType: 'UNIFIED',
            'entity.type': 'SERVICE',
            unifiedServiceIndicators: ['METRIC', 'TRACE'],
        }
    }
    var records = rec ? [rec] : []
    var mappings = { 'entity.name': strType(), id: strType(), 'entity.type': strType() }
    return buildGrailResult(dql, records, mappings, records.length, parseWindowSeconds(dql))
}

function genProblems(dql) {
    var fact = readFact('problem')
    var end = nowMs()
    var rec
    if (fact && fact.record) {
        rec = fact.record
    } else {
        rec = {
            timestamp: tsNano(end - 60 * 1000),
            'event.category': 'ERROR',
            display_id: firstMatch(dql, /(P-\d+)/) || 'P-261013',
            'event.status': 'OPEN',
            'event.kind': 'DAVIS_PROBLEM',
            'event.name': 'Failure rate increase',
            'event.severity': '3',
            affected_entity_ids: ['SERVICE-612D78ED86A2A09B'],
            affected_entity_names: ['frontend'],
            'dt.entity.service': ['SERVICE-612D78ED86A2A09B'],
            'event.start': tsNano(end - 6 * 60 * 1000),
            'event.description':
                '# Failure rate increase\n\nThe error rate increased to 7.89 %.\nEndpoint GET /api/recommendations has a failure rate increase.',
        }
    }
    var mappings = { display_id: strType(), 'event.name': strType(), 'event.status': strType() }
    return buildGrailResult(dql, [rec], mappings, 1219, parseWindowSeconds(dql))
}

function genLogs(dql) {
    var limit = parseLimit(dql) || 50
    var windowSec = parseWindowSeconds(dql)
    var templates = getLogTemplates()
    var end = nowMs()
    // Logs only come back when the query targets error/stderr and matches content.
    var wantsError = /matchesValue\(\s*status\s*,\s*"error"\)|status\s*==\s*"error"|log\.iostream\s*==\s*"stderr"/i.test(dql)
    var phrase = firstMatch(dql, /matchesPhrase\(\s*content\s*,\s*"([^"]+)"\)/i)
    var records = []
    if (wantsError && templates.length) {
        var n = Math.min(limit, templates.length * 3)
        for (var i = 0; i < n; i++) {
            var t = templates[i % templates.length]
            if (phrase && t.content.toLowerCase().indexOf(phrase.toLowerCase()) === -1 && i >= templates.length) continue
            var ms = end - Math.floor((windowSec * 1000 * (i + 1)) / (n + 1))
            var rec = { timestamp: tsNano(ms), 'event.type': 'LOG' }
            for (var k in t) {
                if (Object.prototype.hasOwnProperty.call(t, k)) rec[k] = t[k]
            }
            records.push(rec)
        }
    }
    var mappings = { timestamp: { type: 'timestamp', types: [] }, content: strType(), status: strType(), loglevel: strType() }
    return buildGrailResult(dql, records, mappings, 112000 + Math.floor(rand(windowSec) * 2000), windowSec)
}

/** spans with summarize + bin(): produce an error-rate time series across the window. */
function genSpanSeries(dql) {
    var windowSec = parseWindowSeconds(dql)
    var intervalSec = parseIntervalSeconds(dql)
    var limit = parseLimit(dql)
    var desc = parseSortDesc(dql)
    var id = firstMatch(dql, /(SERVICE-[0-9A-Fa-f]+)/)
    var spanName = firstMatch(dql, /span\.name\s*==\s*"([^"]+)"/i)
    var rateName = firstMatch(dql, /fieldsAdd\s+(\w+)\s*=/i) || 'errorRate'

    var catalog = getServiceCatalog()
    var svc = id && catalog.services[id] ? catalog.services[id] : null
    var baselineRps = svc ? svc.baselineRps || 8 : 8
    var profile = svc ? svc.errorProfile : null
    // Error spike applies when the query targets the affected endpoint (or whole service).
    var spiking = profile && (!spanName || spanName === profile.endpoint)
    var peak = spiking ? profile.peakErrorRate || 7.89 : 0

    var binCount = Math.max(1, Math.floor(windowSec / intervalSec))
    if (limit && limit < binCount) binCount = limit
    var end = nowMs()

    var records = []
    for (var i = 0; i < binCount; i++) {
        // i = 0 is the most recent bin.
        var binStart = end - (i + 1) * intervalSec * 1000
        var total = Math.round(baselineRps * intervalSec * (0.8 + rand(i + 1) * 0.4))
        if (spanName) total = Math.max(1, Math.round(total * 0.05)) // single endpoint is a fraction of service traffic
        // Ramp the error rate up over the two most recent bins to the profile peak.
        var rate = 0
        if (spiking) {
            if (i === 0) rate = peak
            else if (i === 1) rate = peak * 0.5
            else rate = 0
        }
        var errors = Math.round((total * rate) / 100)
        var r = { interval: tsNano(binStart), totalRequests: '' + total, errorRequests: '' + errors }
        r[rateName] = Math.round((errors === 0 ? 0 : (errors * 100.0) / total) * 100) / 100
        records.push(r)
    }
    if (!desc) records.reverse()

    var mappings = {
        interval: { type: 'timestamp', types: [] },
        totalRequests: longType(),
        errorRequests: longType(),
    }
    mappings[rateName] = doubleType()
    return buildGrailResult(dql, records, mappings, 300000 + Math.floor(rand(windowSec) * 80000), windowSec)
}

/** spans with summarize but no bin(): group error counts by span.name. */
function genSpanGroups(dql) {
    var windowSec = parseWindowSeconds(dql)
    var limit = parseLimit(dql) || 20
    var id = firstMatch(dql, /(SERVICE-[0-9A-Fa-f]+)/)
    var catalog = getServiceCatalog()
    var svc = id && catalog.services[id] ? catalog.services[id] : null
    var records = []
    if (svc && svc.errorProfile) {
        records.push({
            'service.name': svc.name,
            'span.name': svc.errorProfile.endpoint,
            errorCount: '' + (40 + Math.floor(rand(1) * 20)),
            uniqueTraces: '' + (30 + Math.floor(rand(2) * 15)),
        })
    }
    if (records.length > limit) records = records.slice(0, limit)
    var mappings = { 'service.name': strType(), 'span.name': strType(), errorCount: longType(), uniqueTraces: longType() }
    return buildGrailResult(dql, records, mappings, 1189000 + Math.floor(rand(windowSec) * 2000), windowSec)
}

/** timeseries metric query: arrays of values across the window at the interval. */
function genTimeseries(dql) {
    var windowSec = parseWindowSeconds(dql)
    var intervalSec = parseIntervalSeconds(dql)
    var id = firstMatch(dql, /(SERVICE-[0-9A-Fa-f]+)/)
    var catalog = getServiceCatalog()
    var svc = id && catalog.services[id] ? catalog.services[id] : null
    var baselineRps = svc ? svc.baselineRps || 8 : 8
    var profile = svc ? svc.errorProfile : null

    // Parse metric aliases: "<alias> = sum(<metric>)"
    var aliasRe = /(\w+)\s*=\s*\w+\(([a-z0-9_.]+)\)/gi
    var aliases = []
    var m
    while ((m = aliasRe.exec(dql)) !== null) {
        aliases.push({ alias: m[1], metric: m[2] })
    }
    if (!aliases.length) aliases = [{ alias: 'value', metric: 'dt.service.request.count' }]

    var binCount = Math.max(1, Math.floor(windowSec / intervalSec))
    var end = nowMs()
    var startMs = end - windowSec * 1000

    var totals = []
    var failures = []
    for (var i = 0; i < binCount; i++) {
        var total = Math.round(baselineRps * intervalSec * (0.8 + rand(i + 1) * 0.4))
        totals.push(total)
        var isLast = i >= binCount - 2
        var rate = profile && isLast ? (profile.peakErrorRate || 7.89) * (i === binCount - 1 ? 1 : 0.5) : 0
        failures.push(Math.round((total * rate) / 100))
    }

    var rec = { timeframe: { start: tsNano(startMs), end: tsNano(end) }, interval: isoDuration(intervalSec) }
    var mappings = { timeframe: { type: 'timeframe', types: [] }, interval: { type: 'duration', types: [] } }
    for (var a = 0; a < aliases.length; a++) {
        var al = aliases[a]
        var arr
        if (/failure/i.test(al.metric) || /fail/i.test(al.alias)) arr = failures
        else arr = totals
        rec[al.alias] = arr
        mappings[al.alias] = { type: 'array', types: [{ mappings: { element: longType() }, indexRange: [0, binCount - 1] }] }
    }
    return buildGrailResult(dql, [rec], mappings, 100000 + Math.floor(rand(windowSec) * 50000), windowSec)
}

function emptyResult(dql) {
    return buildGrailResult(dql, [], {}, 0, parseWindowSeconds(dql))
}

/** Mirror the real server's parse error for obviously malformed DQL (unbalanced quotes/parens). */
function looksMalformed(dql) {
    var quotes = (dql.match(/"/g) || []).length
    if (quotes % 2 !== 0) return true
    var open = (dql.match(/\(/g) || []).length
    var close = (dql.match(/\)/g) || []).length
    return open !== close
}

function parseErrorResult(dql) {
    return {
        content: [
            {
                type: 'text',
                text:
                    'Invalid DQL query provided\n' +
                    JSON.stringify(
                        {
                            exceptionType: 'DQL-ERROR-PARSING',
                            errorType: 'PARSE_ERROR',
                            errorMessage: 'Unexpected token. Please check the query syntax.',
                            queryString: dql,
                            queryId: uuid(),
                        },
                        null,
                        2,
                    ),
            },
        ],
        isError: true,
    }
}

/* --------------------------------- entry ----------------------------------- */

/**
 * Generate an MCP tool result for an execute-dql call.
 * @param {object} args - the tool arguments, expects { dqlQueryString }
 */
export function generateDqlResult(args) {
    var dql = args && args.dqlQueryString ? ('' + args.dqlQueryString).trim() : ''
    if (!dql) return emptyResult('')

    if (looksMalformed(dql)) return parseErrorResult(dql)

    // describe <source>
    var desc = dql.match(/^\s*describe\s+([a-z0-9_.]+)/i)
    if (desc) return genDescribe(dql, desc[1])

    // timeseries ...
    if (/^\s*timeseries\b/i.test(dql)) return genTimeseries(dql)

    // fetch <source> ...
    var fetch = dql.match(/^\s*fetch\s+([a-z0-9_.]+)/i)
    if (fetch) {
        var source = fetch[1]
        if (source === 'dt.davis.problems') return genProblems(dql)
        if (source === 'dt.entity.service') return genEntityService(dql)
        if (source === 'logs') return genLogs(dql)
        if (source === 'spans') {
            var hasSummarize = /\|\s*summarize\b/i.test(dql)
            var hasBin = /bin\(\s*timestamp/i.test(dql) || /interval:/i.test(dql)
            if (hasSummarize && hasBin) return genSpanSeries(dql)
            if (hasSummarize) return genSpanGroups(dql)
            return emptyResult(dql)
        }
        // other entity/data sources: valid-but-empty
        return emptyResult(dql)
    }

    return emptyResult(dql)
}
