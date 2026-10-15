import { GlideRecord, gs } from '@servicenow/glide'

/**
 * get-problem-by-id response generator for the Dynatrace MCP Simulator.
 *
 * Instead of a static canned payload, this builds a Davis problem record
 * dynamically from a live em_alert record whose message_key matches the
 * requested problemId (with fallbacks for group alerts that store a sys_id in
 * message_key — the real id is then in additional_info.ProblemID /
 * sn_alert_tags.t_problemid). The alert's additional_info JSON carries the
 * Dynatrace specifics as flattened.<field>.<index> keys, which we reassemble
 * into the arrays a Davis problem record uses.
 *
 * The result is the exact MCP envelope the real dynatrace-mcp server returns:
 * 3 content[] text blocks (Query metadata / Grail types / Query result records)
 * plus structuredContent { records, metadata.grail (echoing the canonical
 * fetch dt.davis.problems query), types }. now()-relative timeframe + fresh
 * queryId. No matching alert -> a valid-but-empty Grail result (records: []),
 * never a spurious isError.
 *
 * This module is self-contained (its own envelope builder) so dql-generator.js
 * can reuse mapProblemRecordById() without an import cycle.
 */

var ALERT_TABLE = 'em_alert'

/* --------------------------------- helpers --------------------------------- */

function nowMs() {
    return new Date().getTime()
}

function tsNano(ms) {
    return new Date(ms).toISOString().replace('Z', '000000Z')
}

/** Convert a stored glide_date_time value ("2026-10-13 12:04:12", UTC) to Grail nanos. */
function gdtToNano(value) {
    var v = ('' + (value || '')).trim()
    if (!v) return null
    return v.replace(' ', 'T') + '.000000000Z'
}

function epochSec(ms) {
    return ms / 1000
}

function uuid() {
    try {
        return ('' + gs.generateGUID()).replace(/(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5')
    } catch (e) {
        return '01a0f800-0000-7000-0000-000000000000'
    }
}

function safeParse(str, fallback) {
    try {
        return JSON.parse(str)
    } catch (e) {
        return fallback
    }
}

/* ------------------------------ type inference ----------------------------- */

function inferType(value) {
    if (value === null || value === undefined) return { type: 'string', types: [] }
    if (Array.isArray(value)) {
        var elemType = value.length ? inferType(value[0]) : { type: 'string', types: [] }
        return { type: 'array', types: [{ mappings: { element: elemType }, indexRange: [0, Math.max(0, value.length - 1)] }] }
    }
    if (typeof value === 'boolean') return { type: 'boolean', types: [] }
    if (typeof value === 'object') {
        var mappings = {}
        for (var k in value) {
            if (Object.prototype.hasOwnProperty.call(value, k)) mappings[k] = inferType(value[k])
        }
        return { type: 'record', types: [{ mappings: mappings, indexRange: [] }] }
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return { type: 'timestamp', types: [] }
    return { type: 'string', types: [] }
}

function buildTypeMappings(record) {
    var mappings = {}
    for (var k in record) {
        if (Object.prototype.hasOwnProperty.call(record, k)) mappings[k] = inferType(record[k])
    }
    return mappings
}

/* ------------------------------ envelope builder --------------------------- */

var PROBLEM_WINDOW_SEC = 86400 // Davis problem lookups use from:now() - 24h

function problemQueryText(problemId) {
    return (
        'fetch dt.davis.problems, from:now() - 24h\n' +
        '| filter event.id == "' + problemId + '" OR event.id == concat("' + problemId + '", "V2") OR display_id == "' + problemId + '"'
    )
}

/** Assemble the full Grail MCP result from records + the echoed query. */
function buildGrailResult(problemId, records, scannedRecords) {
    var end = nowMs()
    var start = end - PROBLEM_WINDOW_SEC * 1000
    var query = problemQueryText(problemId)
    var grail = {
        canonicalQuery: query,
        timezone: 'Z',
        query: query,
        scannedRecords: scannedRecords,
        dqlVersion: 'V1_0',
        scannedBytes: scannedRecords * 2015,
        scannedDataPoints: 0,
        analysisTimeframe: { start: epochSec(start), end: epochSec(end) },
        locale: 'und',
        executionTimeMilliseconds: 45 + Math.floor(Math.random() * 20),
        notifications: [],
        queryId: uuid(),
        sampled: false,
    }
    var types = records.length ? [{ mappings: buildTypeMappings(records[0]), indexRange: [0, Math.max(0, records.length - 1)] }] : []

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

/* ------------------------------ alert -> record ---------------------------- */

/** Parse additional_info's flattened.<field>.<index> keys into { field: [values...] }. */
function parseFlattened(additionalInfo) {
    var out = { arrays: {}, scalars: {} }
    if (!additionalInfo || typeof additionalInfo !== 'object') return out
    for (var key in additionalInfo) {
        if (!Object.prototype.hasOwnProperty.call(additionalInfo, key)) continue
        var val = additionalInfo[key]
        if (key.indexOf('flattened.') === 0) {
            var rest = key.substring('flattened.'.length)
            var m = rest.match(/^(.*)\.(\d+)$/)
            if (m) {
                var field = m[1]
                var idx = parseInt(m[2], 10)
                if (!out.arrays[field]) out.arrays[field] = []
                out.arrays[field][idx] = val
            }
        } else {
            out.scalars[key] = val
        }
    }
    return out
}

/** Extract the markdown problem body + a concise title from the alert text. */
function deriveNameAndDescription(gr) {
    var description = '' + (gr.getValue('description') || '')
    var shortDesc = '' + (gr.getValue('short_description') || '')
    var text = description || shortDesc
    // Alerts prefix the markdown with "Dynatrace problem P-xxxx: " — strip it.
    text = text.replace(/^.*?Dynatrace problem\s+\S+:\s*/i, '')
    // The remaining markdown usually starts with "# <title>".
    var name = ''
    var h = text.match(/#\s*([^\n]+)/)
    if (h) {
        name = h[1].trim()
    } else {
        // fall back to text before the first " - " or the metric name
        var dash = shortDesc.indexOf(' - ')
        name = dash > 0 ? shortDesc.substring(0, dash).trim() : '' + (gr.getValue('metric_name') || 'Davis problem')
    }
    return { name: name, description: text || shortDesc }
}

/** Map an em_alert GlideRecord (positioned on a row) to a Davis problem record. */
export function mapAlertToProblemRecord(gr, problemId) {
    var addl = safeParse('' + (gr.getValue('additional_info') || ''), {}) || {}
    var flat = parseFlattened(addl)
    var arrays = flat.arrays
    var scalars = flat.scalars

    var displayId = problemId || scalars.ProblemID || '' + gr.getValue('message_key')
    var state = '' + (gr.getValue('state') || '')
    var closed = state === 'Closed'
    var status = closed ? 'CLOSED' : 'ACTIVE'

    var nd = deriveNameAndDescription(gr)
    var startNano = gdtToNano(gr.getValue('initial_event_time'))
    var lastNano = gdtToNano(gr.getValue('last_event_time'))

    var affectedIds = arrays['affected_entity_ids'] || []
    var affectedNames = arrays['affected_entity_names'] || []
    var affectedTypes = arrays['affected_entity_types'] || []
    var serviceIds = arrays['dt.entity.service'] || []
    var eventIds = arrays['dt.davis.event_ids'] || []
    var ssIds = arrays['smartscape.affected_entity.ids'] || []
    var ssTypes = arrays['smartscape.affected_entity.types'] || []
    var pipelines = arrays['dt.openpipeline.pipelines'] || ['davis.problems:default']

    // smartscape.affected_entities: zip name + smartscape id + smartscape type.
    var ssEntities = []
    var count = Math.max(ssIds.length, affectedNames.length)
    for (var i = 0; i < count; i++) {
        ssEntities.push({
            name: affectedNames[i] !== undefined ? affectedNames[i] : '',
            id: ssIds[i] !== undefined ? ssIds[i] : affectedIds[i],
            type: ssTypes[i] !== undefined ? ssTypes[i] : 'SERVICE',
        })
    }

    var rec = {
        timestamp: lastNano || startNano,
        'event.category': 'ERROR',
        display_id: displayId,
        'dt.davis.mute.status': 'NOT_MUTED',
        affected_entity_types: affectedTypes.length ? affectedTypes : ['dt.entity.service'],
        'event.status': status,
        'dt.davis.impact_level': scalars.davis_impact_level ? [scalars.davis_impact_level] : ['Services'],
        'dt.analysis.offset': '-300000000000',
        'smartscape.affected_entities': ssEntities,
        'dt.entity.service': serviceIds,
        'event.kind': scalars.event_kind || 'DAVIS_PROBLEM',
        'dt.analysis.ready': true,
        affected_entity_ids: affectedIds,
        'labels.alerting_profile': ['Default'],
        'event.severity': '' + (gr.getValue('severity') || '3'),
        'smartscape.affected_entity.ids': ssIds,
        'event.name': nd.name,
        'dt.davis.is_duplicate': false,
        'dt.davis.is_frequent_event': false,
        affected_entity_names: affectedNames,
        'dt.davis.event_ids': eventIds,
        'maintenance.is_under_maintenance': ('' + gr.getValue('maintenance')) === 'true' || ('' + gr.getValue('maintenance')) === '1',
        'event.description': nd.description,
        'dt.duration_marker': '300000000000',
        'event.status_transition': 'UPDATED',
        'smartscape.affected_entity.types': ssTypes,
        'event.id': scalars.event_id || displayId,
        'event.start': startNano,
        'dt.openpipeline.source': 'classic_root_cause_analysis',
        'dt.openpipeline.pipelines': pipelines,
    }

    // Closed problems carry an end time + resolved duration.
    if (closed && lastNano) {
        rec['event.end'] = lastNano
        rec['resolved_problem_duration'] = '300000000000'
    }

    return rec
}

/** Locate the em_alert for a problemId. Returns a positioned GlideRecord or null. */
export function findAlertByProblemId(problemId) {
    if (!problemId) return null

    // 1. Direct message_key match (the common case).
    var gr = new GlideRecord(ALERT_TABLE)
    gr.addQuery('message_key', problemId)
    gr.orderByDesc('sys_updated_on')
    gr.setLimit(1)
    gr.query()
    if (gr.next()) return gr

    // 2. Fallback: group alerts store a sys_id in message_key; the real id lives
    //    in additional_info / sn_alert_tags. Match on those.
    var gr2 = new GlideRecord(ALERT_TABLE)
    var qc = gr2.addQuery('additional_info', 'CONTAINS', problemId)
    qc.addOrCondition('sn_alert_tags', 'CONTAINS', problemId)
    gr2.orderByDesc('sys_updated_on')
    gr2.setLimit(1)
    gr2.query()
    if (gr2.next()) return gr2

    return null
}

/** Return a single Davis problem record for a problemId, or null if no alert matches. */
export function mapProblemRecordById(problemId) {
    var gr = findAlertByProblemId(problemId)
    if (!gr) return null
    return mapAlertToProblemRecord(gr, problemId)
}

/* --------------------------------- entry ----------------------------------- */

/**
 * Generate the MCP tool result for a get-problem-by-id call.
 * @param {object} args - expects { problemId }
 */
export function generateProblemResult(args) {
    var problemId = args && args.problemId ? ('' + args.problemId).trim() : ''
    if (!problemId) {
        return buildGrailResult('', [], 0)
    }
    var rec = mapProblemRecordById(problemId)
    var records = rec ? [rec] : []
    var scanned = rec ? 1219 : 0
    return buildGrailResult(problemId, records, scanned)
}
