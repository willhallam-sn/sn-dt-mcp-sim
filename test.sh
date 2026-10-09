#!/bin/bash -x
curl -X POST https://lotsofitom.service-now.com/api/x_snc_dynatrace_mc/dynatrace_mcp/mcp \
  -H "Authorization: Bearer $DT_SIM_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get-problem-by-id","arguments":{"problemId":"P-261013"}}}'
