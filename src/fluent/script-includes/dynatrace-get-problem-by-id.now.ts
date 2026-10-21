import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

/**
 * Script-callable access to the simulated MCP tool "get-problem-by-id".
 * Lets business rules, Flow/AI-agent script steps, and background scripts
 * invoke the tool directly (no MCP/HTTP call) and get the same result.
 */
export const DynatraceGetProblemById = ScriptInclude({
    $id: Now.ID['DynatraceGetProblemById'],
    name: 'DynatraceGetProblemById',
    script: Now.include('../../server/script-includes/dynatrace-get-problem-by-id.js'),
    description: 'Script-callable wrapper for the simulated Dynatrace MCP tool get-problem-by-id. Returns the MCP result object (content/isError/structuredContent) built from live em_alert data.',
    accessibleFrom: 'public',
})
