import '@servicenow/sdk/global'
import { Record, BusinessRule, CrossScopePrivilege } from '@servicenow/sdk/core'

/**
 * API-key authentication for the public MCP endpoint ("privileged hash-sync").
 *
 * - The key is stored ENCRYPTED in a Connections & Credentials api_key_credentials
 *   record. It ships with a non-functional placeholder (never a real key in git).
 * - A before insert/update business rule on THIS record decrypts the key in the
 *   privileged save context, computes SHA256(salt::key), and writes it to the
 *   runtime property x_snc_dynatrace_mc.mcp_inbound_key_hash. The public guest
 *   handler compares against that hash — it never decrypts anything.
 * - The hash property is intentionally NOT Fluent-managed (a Property() record is
 *   write-protected at runtime, which would block the BR's gs.setProperty()).
 *
 * Post-install: set a real key on this credential to populate the hash and
 * unlock the endpoint.
 */
export const mcpApiKeyCredential = Record({
    $id: Now.ID['mcp-api-key-credential'],
    table: 'api_key_credentials',
    data: {
        name: 'Dynatrace MCP Simulator inbound API key',
        // Placeholder — replace with a real key post-install (fires the BR).
        api_key: 'REPLACE_WITH_REAL_KEY',
        type: 'api_key',
        active: true,
        application: '8b0588293b738750f40c93ae53e45a94',
    },
})

BusinessRule({
    $id: Now.ID['mcp-key-hash-sync'],
    name: 'MCP inbound key hash sync',
    table: 'api_key_credentials',
    // 'after' (not 'before'): a password2 value only decrypts reliably once it
    // is committed. On instances where the legacy encrypter is disabled
    // (KB0552099), getDecryptedValue() returns null for an uncommitted value, so
    // a 'before' rule would lag one save. 'after' reads the saved key correctly.
    when: 'after',
    action: ['insert', 'update'],
    order: 100,
    // Filter on the record's own $id (NOT a hardcoded sys_id) so it survives
    // re-scope/reinstall — the Now.ID hash is resolved at build time.
    filterCondition: `sys_id=${mcpApiKeyCredential.$id}`,
    script: Now.include('../../server/key-hash-br.js'),
})

// Cross-scope privileges used ONLY by the business rule to read the credential
// via Connections & Credentials (never by the request handler).
CrossScopePrivilege({
    $id: Now.ID['xsp-cc-get-credential'],
    status: 'allowed',
    operation: 'execute',
    targetName: 'ScriptableStandardCredentialsProvider.getCredentialByID',
    targetScope: 'global',
    targetType: 'scriptable',
})

CrossScopePrivilege({
    $id: Now.ID['xsp-cc-get-attribute'],
    status: 'allowed',
    operation: 'execute',
    targetName: 'ScriptableStandardCredential.getAttribute',
    targetScope: 'global',
    targetType: 'scriptable',
})
