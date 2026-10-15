import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

/**
 * Script-callable access to the simulated MCP tool "execute-dql".
 * Lets business rules, Flow/AI-agent script steps, and background scripts
 * invoke the tool directly (no MCP/HTTP call) and get the same result.
 */
export const DynatraceExecuteDql = ScriptInclude({
    $id: Now.ID['DynatraceExecuteDql'],
    name: 'DynatraceExecuteDql',
    script: Now.include('../../server/script-includes/dynatrace-execute-dql.js'),
    description: 'Script-callable wrapper for the simulated Dynatrace MCP tool execute-dql. Returns the MCP result object (content/isError/structuredContent) with generated Grail data.',
    accessibleFrom: 'public',
})
