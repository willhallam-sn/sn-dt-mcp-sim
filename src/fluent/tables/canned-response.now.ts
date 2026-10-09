import '@servicenow/sdk/global'
import {
    Table,
    StringColumn,
    ChoiceColumn,
    BooleanColumn,
    IntegerColumn,
    MultiLineTextColumn,
    Form,
    default_view,
} from '@servicenow/sdk/core'

/**
 * Stores canned MCP interactions for the Dynatrace MCP Simulator.
 * Each row maps an MCP method (and, for tool calls, a tool name + argument
 * match key) to the JSON-RPC `result` payload that the simulated server returns.
 * Editing a row's `response_payload` instantly changes what the fake tenant
 * returns -- no code change required.
 */
export const x_snc_dynatrace_mc_response = Table({
    name: 'x_snc_dynatrace_mc_response',
    label: 'Canned MCP Response',
    schema: {
        name: StringColumn({
            label: 'Name',
            maxLength: 255,
            mandatory: true,
        }),
        method: ChoiceColumn({
            label: 'MCP Method',
            maxLength: 40,
            default: 'tools/call',
            dropdown: 'dropdown_without_none',
            choices: {
                initialize: { label: 'initialize' },
                'tools/list': { label: 'tools/list' },
                'tools/call': { label: 'tools/call' },
                ping: { label: 'ping' },
            },
        }),
        tool_name: StringColumn({
            label: 'Tool Name',
            maxLength: 255,
        }),
        match_type: ChoiceColumn({
            label: 'Match Type',
            maxLength: 20,
            default: 'key',
            dropdown: 'dropdown_without_none',
            choices: {
                exact: { label: 'Exact arguments' },
                key: { label: 'Match key' },
                default: { label: 'Default (fallback)' },
            },
        }),
        match_key: StringColumn({
            label: 'Match Key',
            maxLength: 4000,
        }),
        request_arguments: MultiLineTextColumn({
            label: 'Request Arguments (JSON)',
            maxLength: 100000,
        }),
        response_payload: MultiLineTextColumn({
            label: 'Response Payload (JSON result)',
            maxLength: 1000000,
            mandatory: true,
        }),
        sequence: IntegerColumn({
            label: 'Order',
            default: 100,
        }),
        active: BooleanColumn({
            label: 'Active',
            default: true,
        }),
        notes: MultiLineTextColumn({
            label: 'Notes',
            maxLength: 4000,
        }),
    },
})

Form({
    table: 'x_snc_dynatrace_mc_response',
    view: default_view,
    sections: [
        {
            caption: 'Canned MCP Response',
            content: [
                {
                    layout: 'two-column',
                    leftElements: [
                        { field: 'name', type: 'table_field' },
                        { field: 'method', type: 'table_field' },
                        { field: 'tool_name', type: 'table_field' },
                        { field: 'active', type: 'table_field' },
                    ],
                    rightElements: [
                        { field: 'match_type', type: 'table_field' },
                        { field: 'match_key', type: 'table_field' },
                        { field: 'sequence', type: 'table_field' },
                    ],
                },
                {
                    layout: 'one-column',
                    elements: [
                        { field: 'request_arguments', type: 'table_field' },
                        { field: 'response_payload', type: 'table_field' },
                        { field: 'notes', type: 'table_field' },
                    ],
                },
            ],
        },
    ],
})
