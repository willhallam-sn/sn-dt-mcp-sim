import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    '1b2554613b778750f40c93ae53e45a7a': {
                        table: 'sys_scope_privilege'
                        id: '1b2554613b778750f40c93ae53e45a7a'
                    }
                    '5b2554613b778750f40c93ae53e45a72': {
                        table: 'sys_scope_privilege'
                        id: '5b2554613b778750f40c93ae53e45a72'
                    }
                    '5bead0a53bb78750f40c93ae53e45ad3': {
                        table: 'sys_scope_privilege'
                        id: '5bead0a53bb78750f40c93ae53e45ad3'
                    }
                    '83ea90a93b778750f40c93ae53e45a22': {
                        table: 'sys_scope_privilege'
                        id: '83ea90a93b778750f40c93ae53e45a22'
                    }
                    '972558293b378750f40c93ae53e45aa3': {
                        table: 'sys_scope_privilege'
                        id: '972558293b378750f40c93ae53e45aa3'
                    }
                    '9bead0a53bb78750f40c93ae53e45af1': {
                        table: 'sys_scope_privilege'
                        id: '9bead0a53bb78750f40c93ae53e45af1'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: 'a466267aa61f485d902627e2be494530'
                    }
                    ce9818693b778750f40c93ae53e45acc: {
                        table: 'sys_scope_privilege'
                        id: 'ce9818693b778750f40c93ae53e45acc'
                    }
                    d3ead0a53bb78750f40c93ae53e45af9: {
                        table: 'sys_scope_privilege'
                        id: 'd3ead0a53bb78750f40c93ae53e45af9'
                    }
                    'dynatrace-mcp-api': {
                        table: 'sys_ws_definition'
                        id: '2f6c3987e580432b9f87a4f432426014'
                    }
                    'dynatrace-mcp-route-import': {
                        table: 'sys_ws_operation'
                        id: '36fdcf4ae63e4c41916838e559ca2f98'
                    }
                    'dynatrace-mcp-route-mcp': {
                        table: 'sys_ws_operation'
                        id: '53d67b59ceb14538a8ba089e806eb838'
                    }
                    'mcp-api-key-credential': {
                        table: 'api_key_credentials'
                        id: '3f5986c5db2646ad94bdb050f5afea84'
                    }
                    'mcp-key-hash-sync': {
                        table: 'sys_script'
                        id: '293f66337fdc4acb851a3bd1f00d907f'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '55bd19d6fbf84e54be683c3a0444cc85'
                    }
                    'src_server_auth-lib_js': {
                        table: 'sys_module'
                        id: '1d2c2c1e8f8e4ad19c6a642cea69564c'
                    }
                    'src_server_key-hash-br_js': {
                        table: 'sys_module'
                        id: '9cd0119425ab4f1c8670655acec8119f'
                    }
                    'src_server_mcp-handler_js': {
                        table: 'sys_module'
                        id: 'be764494ed5147b6807fc8a782cc57c6'
                    }
                    'src_server_mcp-import_js': {
                        table: 'sys_module'
                        id: '92ec9985898541cb80347ebf61ff9aa5'
                    }
                    'src_server_mcp-lib_js': {
                        table: 'sys_module'
                        id: '43b645b12fd14a30b2773504b56b3020'
                    }
                    'xsp-cc-get-attribute': {
                        table: 'sys_scope_privilege'
                        id: 'b2ffbc03c5ae495aac15cd93ad992608'
                    }
                    'xsp-cc-get-credential': {
                        table: 'sys_scope_privilege'
                        id: '7e0e1efae6a84fc096e13eeabd1488b0'
                    }
                }
                composite: [
                    {
                        table: 'sys_ui_element'
                        id: '06748f3dba834760afb7e1f6f8a0f3db'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: '.end_split'
                            position: '9'
                        }
                    },
                    {
                        table: 'sys_ui_section'
                        id: '0be32df47e6e420ba0077728832426f6'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            caption: 'Canned MCP Response'
                            view: {
                                id: 'Default view'
                                key: {
                                    name: 'NULL'
                                }
                            }
                            sys_domain: 'global'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '0db8ff10cc32430cabbab705c77e9295'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_type'
                            value: 'key'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '0f73e9c961744301b73bfb9b962d5f6f'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'tool_name'
                            position: '3'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '1ad74b90af604df3bb82f0f3c7d59f5e'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'method'
                            position: '2'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '1c43eb60d8054941927fee27d012153e'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1cd3cdedfc714a90af362c3653ef7cc5'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'method'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '246876845de94a8b9c0264640ae14791'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'match_type'
                            position: '6'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '26c81dcac1624a3da22dccfec6537d60'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'match_key'
                            position: '7'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '2b9365a0842f46e1ba002e89a8d0777c'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: '.split'
                            position: '5'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2e7d5675aba9436584e49739792db935'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'active'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3271d8593e36486280c475508cf65a3b'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'request_arguments'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '331c7ca546da42bda9f25d07c5175f84'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '341e4e58930044c180f6d0f692123e92'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'active'
                            position: '4'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3e2e23a0d9ce42fc9bc0072c0e353f6f'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_type'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '4b63974a53a349c382063ec35922b7f7'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'response_payload'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '6117713e145a4e50993e786d4c252795'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_type'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7732a86f982d4b98a36be40e492eedd5'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_type'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '77348e56425c4ddfb741b40f2e8bfee2'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'tool_name'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7954596bcf9b4229ae6ade95fade34ed'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'sequence'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7e27c10e7e2a4fa692b11559fed01120'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'response_payload'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '82b4af6feb254fb28b852a6dbbb4e86a'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'method'
                            value: 'ping'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '85b311d6f2ee4c50960dca788a1a51fb'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'method'
                            value: 'initialize'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '881137ea1836415590942b86ddc6fff2'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'active'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '886698f42234416bb6ad0685db510ab0'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9d259faaadfb40c4ac2bb5e829e8fe2b'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'name'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'a7c754f8f7ae43909ac5112397080fd0'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'notes'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'aed7e3a944534b28abe5b146d2cf75cc'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'method'
                            value: 'tools/list'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b2fd6aee46d544eab922420726a368f2'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_key'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_form'
                        id: 'b795f0bb5af54d2d8546b3c78aa8c0f5'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            view: {
                                id: 'Default view'
                                key: {
                                    name: 'NULL'
                                }
                            }
                            sys_domain: 'global'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'b840ae4c0e9b41a3b543870290672a00'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: '.begin_split'
                            position: '0'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bb3fe44c0c2f4cd897912b305272a7e2'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'notes'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'bc268d9453cd41cba4de36204c145694'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'response_payload'
                            position: '11'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'bcfa92d262214f1fbe281ef60c9c1e50'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_type'
                            value: 'exact'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bdbf75b83e5f4e3992bce9bbb303efbf'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'method'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'c7e3584085a549d3810292fa0563cfc4'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_type'
                            value: 'default'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c952dc914ec841b6a13023ddcb631d5e'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'name'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'cb6365881d914cdeb5f9e5321fa74c89'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'cd89679d019d4c229360b8234dc36b03'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'name'
                            position: '1'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'ce562d3ef2504e5783e61b0b0dafb979'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'notes'
                            position: '12'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'daa9ca2efae24eaaaa4c0c7a4fb6e9c3'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'sequence'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'db70e04529134ca8a87a4cdfbbd0eefc'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'tool_name'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: 'e1bd5852aef947fea07429308a3e05fa'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'method'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e7a84413772940b09234b11e458e54dd'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'match_key'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'eb6b7cf4bdbb4d93b0a8a94f940a3dbe'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'request_arguments'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_form_section'
                        id: 'ecafcca52826487a81a20e726f557799'
                        key: {
                            sys_ui_form: {
                                id: 'b795f0bb5af54d2d8546b3c78aa8c0f5'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ee42d0d343c14ccd9121fded11ae35b2'
                        key: {
                            name: 'x_snc_dynatrace_mc_response'
                            element: 'method'
                            value: 'tools/call'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'ee6a607d5cd845e9ad65bf8c4f54e8ee'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'sequence'
                            position: '8'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'f1f119a70dd24b2eb59cf78f430ae99a'
                        key: {
                            sys_ui_section: {
                                id: '0be32df47e6e420ba0077728832426f6'
                                key: {
                                    name: 'x_snc_dynatrace_mc_response'
                                    caption: 'Canned MCP Response'
                                    view: {
                                        id: 'Default view'
                                        key: {
                                            name: 'NULL'
                                        }
                                    }
                                    sys_domain: 'global'
                                }
                            }
                            element: 'request_arguments'
                            position: '10'
                        }
                    },
                ]
            }
        }
    }
}
