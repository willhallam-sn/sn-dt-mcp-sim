/*
 * init-properties.js — Dynatrace MCP Simulator
 *
 * Optional helper for the OPTIONAL IP allow list. Run in Scripts - Background
 * with the application scope set to "Dynatrace MCP Simulator".
 *
 * The API-key hash property (x_snc_dynatrace_mc.mcp_inbound_key_hash) is NOT set
 * here — it is populated automatically by saving a real key on the
 * "Dynatrace MCP Simulator inbound API key" credential (api_key_credentials).
 *
 * IP allow list behavior:
 *   - empty  => feature DISABLED, allow all (API key still gates). Safe default.
 *   - set    => comma-separated IPv4 / IPv4 CIDR / exact IPv6; anything else 403s.
 *     XFF is client-supplied/spoofable — defense in depth only, not a hard boundary.
 */
(function () {
    var CONFIG = {
        // e.g. '203.0.113.9, 198.51.100.0/24'  — leave '' to allow all.
        allowedIps: '',
    }

    var ALLOWED_IPS_PROPERTY = 'x_snc_dynatrace_mc.mcp_allowed_ips'

    gs.setProperty(ALLOWED_IPS_PROPERTY, CONFIG.allowedIps)
    gs.info('[MCP] ' + ALLOWED_IPS_PROPERTY + ' = "' + gs.getProperty(ALLOWED_IPS_PROPERTY, '') + '"')
    gs.info(
        '[MCP] key-hash property currently: ' +
            (gs.getProperty('x_snc_dynatrace_mc.mcp_inbound_key_hash', '') ? 'configured (endpoint unlocked)' : 'empty (endpoint locked — set a real key on the credential)'),
    )
})()
