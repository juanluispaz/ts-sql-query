import type { TsSqlDatabaseErrorCode, TsSqlErrorReason } from '../../TsSqlError.js'

export interface MySqlMariaDbEngineError {
    errno?: number
    code?: string
    sqlState?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    message?: string
}

const MYSQL_MARIADB_ERROR_CODE_NUMBERS = new Map<string, number>([
    ['EE_CANTCREATEFILE', 1],
    ['EE_READ', 2],
    ['EE_WRITE', 3],
    ['EE_BADCLOSE', 4],
    ['EE_OUTOFMEMORY', 5],
    ['EE_DELETE', 6],
    ['EE_LINK', 7],
    ['EE_EOFERR', 9],
    ['EE_CANTLOCK', 10],
    ['EE_CANTUNLOCK', 11],
    ['EE_DIR', 12],
    ['EE_STAT', 13],
    ['EE_CANT_CHSIZE', 14],
    ['EE_CANT_OPEN_STREAM', 15],
    ['EE_GETWD', 16],
    ['EE_SETWD', 17],
    ['EE_DISK_FULL', 20],
    ['EE_CANT_MKDIR', 21],
    ['EE_UNKNOWN_CHARSET', 22],
    ['EE_OUT_OF_FILERESOURCES', 23],
    ['EE_CANT_READLINK', 24],
    ['EE_CANT_SYMLINK', 25],
    ['EE_REALPATH', 26],
    ['EE_SYNC', 27],
    ['EE_UNKNOWN_COLLATION', 28],
    ['EE_FILENOTFOUND', 29],
    ['EE_CHANGE_OWNERSHIP', 31],
    ['EE_CHANGE_PERMISSIONS', 32],
    ['EE_CANT_SEEK', 33],
    ['EE_CAPACITY_EXCEEDED', 34],
    ['EE_DISK_FULL_WITH_RETRY_MSG', 35],
    ['EE_FAILED_TO_OPEN_DEFAULTS_FILE', 47],
    ['EE_FAILED_TO_HANDLE_DEFAULTS_FILE', 48],
    ['EE_WRONG_DIRECTIVE_IN_CONFIG_FILE', 49],
    ['EE_INCORRECT_GRP_DEFINITION_IN_CONFIG_FILE', 51],
    ['EE_OPTION_WITHOUT_GRP_IN_CONFIG_FILE', 52],
    ['EE_CONFIG_FILE_PERMISSION_ERROR', 53],
    ['EE_IGNORE_WORLD_WRITABLE_CONFIG_FILE', 54],
    ['EE_SSL_ERROR_FROM_FILE', 59],
    ['EE_SSL_ERROR', 60],
    ['EE_UNKNOWN_PROTOCOL_OPTION', 63],
    ['EE_FAILED_TO_LOCATE_SERVER_PUBLIC_KEY', 64],
    ['EE_PUBLIC_KEY_NOT_IN_PEM_FORMAT', 65],
    ['EE_UNKNOWN_VARIABLE', 67],
    ['EE_UNKNOWN_OPTION', 68],
    ['EE_UNKNOWN_SHORT_OPTION', 69],
    ['EE_OPTION_WITHOUT_ARGUMENT', 70],
    ['EE_OPTION_REQUIRES_ARGUMENT', 71],
    ['EE_SHORT_OPTION_REQUIRES_ARGUMENT', 72],
    ['EE_OPTION_IGNORED_DUE_TO_INVALID_VALUE', 73],
    ['EE_OPTION_WITH_EMPTY_VALUE', 74],
    ['EE_FAILED_TO_ASSIGN_MAX_VALUE_TO_OPTION', 75],
    ['EE_INCORRECT_BOOLEAN_VALUE_FOR_OPTION', 76],
    ['EE_FAILED_TO_SET_OPTION_VALUE', 77],
    ['EE_INCORRECT_INT_VALUE_FOR_OPTION', 78],
    ['EE_INCORRECT_UINT_VALUE_FOR_OPTION', 79],
    ['EE_INVALID_DECIMAL_VALUE_FOR_OPTION', 84],
    ['CR_UNKNOWN_ERROR', 2000],
    ['CR_SOCKET_CREATE_ERROR', 2001],
    ['CR_CONNECTION_ERROR', 2002],
    ['CR_CONN_HOST_ERROR', 2003],
    ['CR_IPSOCK_ERROR', 2004],
    ['CR_UNKNOWN_HOST', 2005],
    ['CR_SERVER_GONE_ERROR', 2006],
    ['CR_VERSION_ERROR', 2007],
    ['CR_OUT_OF_MEMORY', 2008],
    ['CR_WRONG_HOST_INFO', 2009],
    ['CR_SERVER_HANDSHAKE_ERR', 2012],
    ['CR_SERVER_LOST', 2013],
    ['CR_COMMANDS_OUT_OF_SYNC', 2014],
    ['CR_NAMEDPIPEWAIT_ERROR', 2016],
    ['CR_NAMEDPIPEOPEN_ERROR', 2017],
    ['CR_NAMEDPIPESETSTATE_ERROR', 2018],
    ['CR_CANT_READ_CHARSET', 2019],
    ['CR_NET_PACKET_TOO_LARGE', 2020],
    ['CR_PROBE_REPLICA_CONNECT', 2024],
    ['CR_PROBE_SOURCE_CONNECT', 2025],
    ['CR_SSL_CONNECTION_ERROR', 2026],
    ['CR_MALFORMED_PACKET', 2027],
    ['CR_WRONG_LICENSE', 2028],
    ['CR_NULL_POINTER', 2029],
    ['CR_NO_PREPARE_STMT', 2030],
    ['CR_PARAMS_NOT_BOUND', 2031],
    ['CR_DATA_TRUNCATED', 2032],
    ['CR_NO_PARAMETERS_EXISTS', 2033],
    ['CR_INVALID_PARAMETER_NO', 2034],
    ['CR_INVALID_BUFFER_USE', 2035],
    ['CR_UNSUPPORTED_PARAM_TYPE', 2036],
    ['CR_SHARED_MEMORY_CONNECT_REQUEST_ERROR', 2038],
    ['CR_SHARED_MEMORY_CONNECT_ANSWER_ERROR', 2039],
    ['CR_SHARED_MEMORY_CONNECT_FILE_MAP_ERROR', 2040],
    ['CR_SHARED_MEMORY_CONNECT_MAP_ERROR', 2041],
    ['CR_SHARED_MEMORY_FILE_MAP_ERROR', 2042],
    ['CR_SHARED_MEMORY_MAP_ERROR', 2043],
    ['CR_SHARED_MEMORY_EVENT_ERROR', 2044],
    ['CR_SHARED_MEMORY_CONNECT_ABANDONED_ERROR', 2045],
    ['CR_SHARED_MEMORY_CONNECT_SET_ERROR', 2046],
    ['CR_CONN_UNKNOW_PROTOCOL', 2047],
    ['CR_INVALID_CONN_HANDLE', 2048],
    ['CR_FETCH_CANCELED', 2050],
    ['CR_NO_DATA', 2051],
    ['CR_NO_STMT_METADATA', 2052],
    ['CR_NO_RESULT_SET', 2053],
    ['CR_NOT_IMPLEMENTED', 2054],
    ['CR_SERVER_LOST_EXTENDED', 2055],
    ['CR_STMT_CLOSED', 2056],
    ['CR_NEW_STMT_METADATA', 2057],
    ['CR_ALREADY_CONNECTED', 2058],
    ['CR_AUTH_PLUGIN_CANNOT_LOAD', 2059],
    ['CR_DUPLICATE_CONNECTION_ATTR', 2060],
    ['CR_AUTH_PLUGIN_ERR', 2061],
    ['CR_INSECURE_API_ERR', 2062],
    ['CR_FILE_NAME_TOO_LONG', 2063],
    ['CR_SSL_FIPS_MODE_ERR', 2064],
    ['CR_DEPRECATED_COMPRESSION_NOT_SUPPORTED', 2065],
    ['CR_COMPRESSION_WRONGLY_CONFIGURED', 2066],
    ['CR_KERBEROS_USER_NOT_FOUND', 2067],
    ['CR_LOAD_DATA_LOCAL_INFILE_REJECTED', 2068],
    ['CR_LOAD_DATA_LOCAL_INFILE_REALPATH_FAIL', 2069],
    ['CR_DNS_SRV_LOOKUP_FAILED', 2070],
    ['CR_MANDATORY_TRACKER_NOT_FOUND', 2071],
    ['CR_INVALID_FACTOR_NO', 2072],
    ['CR_CANT_GET_SESSION_DATA', 2073],
    ['CR_INVALID_CLIENT_CHARSET', 2074],
    ['CR_TLS_SERVER_NOT_FOUND', 2075],
    ['ER_DB_CREATE_EXISTS', 1007],
    ['ER_DB_DROP_EXISTS', 1008],
    ['ER_CON_COUNT_ERROR', 1040],
    ['ER_OUT_OF_RESOURCES', 1041],
    ['ER_BAD_HOST_ERROR', 1042],
    ['ER_HANDSHAKE_ERROR', 1043],
    ['ER_DBACCESS_DENIED_ERROR', 1044],
    ['ER_ACCESS_DENIED_ERROR', 1045],
    ['ER_NO_DB_ERROR', 1046],
    ['ER_BAD_NULL_ERROR', 1048],
    ['ER_BAD_DB_ERROR', 1049],
    ['ER_TABLE_EXISTS_ERROR', 1050],
    ['ER_BAD_TABLE_ERROR', 1051],
    ['ER_NON_UNIQ_ERROR', 1052],
    ['ER_BAD_FIELD_ERROR', 1054],
    ['ER_TOO_LONG_IDENT', 1059],
    ['ER_DUP_FIELDNAME', 1060],
    ['ER_DUP_KEYNAME', 1061],
    ['ER_DUP_ENTRY', 1062],
    ['ER_PARSE_ERROR', 1064],
    ['ER_EMPTY_QUERY', 1065],
    ['ER_NONUNIQ_TABLE', 1066],
    ['ER_KEY_COLUMN_DOES_NOT_EXITS', 1072],
    ['ER_FILE_EXISTS_ERROR', 1086],
    ['ER_CANT_DROP_FIELD_OR_KEY', 1091],
    ['ER_UPDATE_TABLE_USED', 1093],
    ['ER_NO_TABLES_USED', 1096],
    ['ER_UNKNOWN_PROCEDURE', 1106],
    ['ER_WRONG_PARAMCOUNT_TO_PROCEDURE', 1107],
    ['ER_WRONG_PARAMETERS_TO_PROCEDURE', 1108],
    ['ER_UNKNOWN_TABLE', 1109],
    ['ER_FIELD_SPECIFIED_TWICE', 1110],
    ['ER_INVALID_GROUP_FUNC_USE', 1111],
    ['ER_RECORD_FILE_FULL', 1114],
    ['ER_UNKNOWN_CHARACTER_SET', 1115],
    ['ER_TOO_MANY_TABLES', 1116],
    ['ER_TOO_MANY_FIELDS', 1117],
    ['ER_TOO_BIG_ROWSIZE', 1118],
    ['ER_OUTOFMEMORY', 1037],
    ['ER_OUT_OF_SORTMEMORY', 1038],
    ['ER_STACK_OVERRUN', 1119],
    ['ER_CANT_FIND_UDF', 1122],
    ['ER_UDF_EXISTS', 1125],
    ['ER_FUNCTION_NOT_DEFINED', 1128],
    ['ER_HOST_IS_BLOCKED', 1129],
    ['ER_HOST_NOT_PRIVILEGED', 1130],
    ['ER_NO_SUCH_TABLE', 1146],
    ['ER_SYNTAX_ERROR', 1149],
    ['ER_NET_PACKET_TOO_LARGE', 1153],
    ['ER_NET_READ_ERROR', 1158],
    ['ER_NET_READ_INTERRUPTED', 1159],
    ['ER_NET_ERROR_ON_WRITE', 1160],
    ['ER_NET_WRITE_INTERRUPTED', 1161],
    ['ER_TOO_LONG_STRING', 1162],
    ['ER_DUP_UNIQUE', 1169],
    ['ER_TOO_MANY_ROWS', 1172],
    ['ER_KEY_DOES_NOT_EXITS', 1176],
    ['ER_CANT_DO_THIS_DURING_AN_TRANSACTION', 1179],
    ['ER_ERROR_DURING_COMMIT', 1180],
    ['ER_ERROR_DURING_ROLLBACK', 1181],
    ['ER_FT_MATCHING_KEY_NOT_FOUND', 1191],
    ['ER_LOCK_OR_ACTIVE_TRANSACTION', 1192],
    ['ER_UNKNOWN_SYSTEM_VARIABLE', 1193],
    ['ER_CRASHED_ON_USAGE', 1194],
    ['ER_CRASHED_ON_REPAIR', 1195],
    ['ER_TRANS_CACHE_FULL', 1197],
    ['ER_TOO_MANY_USER_CONNECTIONS', 1203],
    ['ER_LOCK_WAIT_TIMEOUT', 1205],
    ['ER_LOCK_TABLE_FULL', 1206],
    ['ER_READ_ONLY_TRANSACTION', 1207],
    ['ER_WRONG_ARGUMENTS', 1210],
    ['ER_NO_PERMISSION_TO_CREATE_USER', 1211],
    ['ER_NO_REFERENCED_ROW', 1216],
    ['ER_ROW_IS_REFERENCED', 1217],
    ['ER_LOCK_DEADLOCK', 1213],
    ['ER_USER_LIMIT_REACHED', 1226],
    ['ER_SPECIFIC_ACCESS_DENIED_ERROR', 1227],
    ['ER_NO_DEFAULT', 1230],
    ['ER_WRONG_VALUE_FOR_VAR', 1231],
    ['ER_WRONG_TYPE_FOR_VAR', 1232],
    ['ER_SUBQUERY_NO_1_ROW', 1242],
    ['ER_UNKNOWN_STMT_HANDLER', 1243],
    ['ER_ILLEGAL_REFERENCE', 1247],
    ['ER_WARN_DATA_OUT_OF_RANGE', 1264],
    ['ER_TRUNCATED_WRONG_VALUE', 1292],
    ['ER_SP_ALREADY_EXISTS', 1304],
    ['ER_SP_DOES_NOT_EXIST', 1305],
    ['ER_QUERY_INTERRUPTED', 1317],
    ['ER_SP_WRONG_NO_OF_ARGS', 1318],
    ['ER_SP_BADSELECT', 1319],
    ['ER_SP_CURSOR_ALREADY_OPEN', 1325],
    ['ER_SP_CURSOR_NOT_OPEN', 1326],
    ['ER_SP_UNDECLARED_VAR', 1327],
    ['ER_SIGNAL_NOT_FOUND', 1643],
    ['ER_DIVISION_BY_ZERO', 1365],
    ['ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 1366],
    ['ER_PROCACCESS_DENIED_ERROR', 1370],
    ['ER_REGEXP_ERROR', 1139],
    ['ER_WRONG_VALUE_FOR_TYPE', 1411],
    ['ER_DATA_TOO_LONG', 1406],
    ['ER_NONEXISTING_PROC_GRANT', 1403],
    ['ER_CANT_CREATE_USER_WITH_GRANT', 1410],
    ['ER_SP_DUP_HANDLER', 1413],
    ['ER_CANT_CREATE_GEOMETRY_OBJECT', 1416],
    ['ER_TABLE_DEF_CHANGED', 1412],
    ['ER_ROW_IS_REFERENCED_2', 1451],
    ['ER_NO_REFERENCED_ROW_2', 1452],
    ['ER_MAX_PREPARED_STMT_COUNT_REACHED', 1461],
    ['ER_DUP_ENTRY_WITH_KEY_NAME', 1586],
    ['ER_XA_RBTIMEOUT', 1613],
    ['ER_XA_RBDEADLOCK', 1614],
    ['ER_DATA_OUT_OF_RANGE', 1690],
    ['ER_INDEX_CORRUPT', 1712],
    ['ER_DA_INVALID_CONDITION_NUMBER', 1758],
    ['ER_FOREIGN_DUPLICATE_KEY_WITH_CHILD_INFO', 1761],
    ['ER_FOREIGN_DUPLICATE_KEY_WITHOUT_CHILD_INFO', 1762],
    ['ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION', 1792],
    ['ER_ACCESS_DENIED_NO_PASSWORD_ERROR', 1698],
    ['ER_ACCESS_DENIED_CHANGE_USER_ERROR', 1873],
    ['ER_NOT_SUPPORTED_YET', 1235],
    ['ER_INVALID_JSON_TEXT', 3140],
    ['ER_INVALID_JSON_TEXT_IN_PARAM', 3141],
    ['ER_INVALID_JSON_CHARSET', 3144],
    ['ER_INVALID_JSON_CHARSET_IN_FUNCTION', 3145],
    ['ER_INVALID_TYPE_FOR_JSON', 3146],
    ['ER_INVALID_CAST_TO_JSON', 3147],
    ['ER_JSON_VALUE_TOO_BIG', 3150],
    ['ER_JSON_KEY_TOO_BIG', 3151],
    ['ER_NUMERIC_JSON_VALUE_OUT_OF_RANGE', 3155],
    ['ER_INVALID_JSON_VALUE_FOR_CAST', 3156],
    ['ER_JSON_DOCUMENT_TOO_DEEP', 3157],
    ['ER_JSON_DOCUMENT_NULL_KEY', 3158],
    ['ER_SRS_PARSE_ERROR', 3517],
    ['ER_SRS_NOT_FOUND', 3548],
    ['ER_CHECK_CONSTRAINT_VIOLATED', 3819],
    ['ER_INVALID_JSON_TYPE', 3853],
    ['ER_FUNCTIONAL_INDEX_DATA_IS_TOO_LONG', 3907],
    ['ER_INVALID_JSON_VALUE_FOR_FUNC_INDEX', 3903],
    ['ER_CONSTRAINT_FAILED', 4025],
])

const MYSQL_DUPLICATE_CONSTRAINT_ERROR_NUMBERS = new Set([1022, 1062, 1169, 1557, 1586, 1761, 1762, 1859])
const MYSQL_NOT_NULL_CONSTRAINT_ERROR_NUMBERS = new Set([1048, 3673])
const MYSQL_FOREIGN_KEY_CONSTRAINT_ERROR_NUMBERS = new Set([1216, 1217, 1451, 1452, 3008])
const MYSQL_CHECK_CONSTRAINT_ERROR_NUMBERS = new Set([3819, 4025])
const MYSQL_INVALID_VALUE_TOO_LONG_ERROR_NUMBERS = new Set([1162, 1406, 1917, 3046, 3056, 3150, 3151, 3718, 3907, 4159, 4160, 4203])
const MYSQL_INVALID_VALUE_OUT_OF_RANGE_ERROR_NUMBERS = new Set([1264, 1690, 1916, 3020, 3048, 3049, 3050, 3051, 3155, 3669, 3706, 3737, 3738, 3739, 3740, 4103, 4105, 4106, 4124, 4125, 4126, 4127])
const MYSQL_INVALID_JSON_ERROR_NUMBERS = new Set([3140, 3141, 3144, 3145, 3146, 3147, 3156, 3157, 3158, 3853, 3903, 3966, 3967, 4035, 4036, 4037, 4038, 4039, 4041, 4042, 4044, 4045, 4046, 4048, 4049, 4050, 4051, 4076, 4176, 4178, 4179, 4186, 4193])
const MYSQL_DATABASE_NOT_FOUND_ERROR_NUMBERS = new Set([1008, 1046, 1049, 3503])
const MYSQL_TABLE_NOT_FOUND_ERROR_NUMBERS = new Set([1051, 1109, 1146, 1932, 4092])
const MYSQL_COLUMN_NOT_FOUND_ERROR_NUMBERS = new Set([1054, 1072, 4082])
const MYSQL_ROUTINE_NOT_FOUND_ERROR_NUMBERS = new Set([1106, 1122, 1128, 1305, 1630, 4095, 4096])
const MYSQL_INDEX_NOT_FOUND_ERROR_NUMBERS = new Set([1091, 1176, 1191, 4206, 4222])
const MYSQL_DATABASE_ALREADY_EXISTS_ERROR_NUMBERS = new Set([1007])
const MYSQL_TABLE_ALREADY_EXISTS_ERROR_NUMBERS = new Set([1050])
const MYSQL_COLUMN_ALREADY_EXISTS_ERROR_NUMBERS = new Set([1060, 1110])
const MYSQL_ROUTINE_ALREADY_EXISTS_ERROR_NUMBERS = new Set([1125, 1304])
const MYSQL_INDEX_ALREADY_EXISTS_ERROR_NUMBERS = new Set([1061])
const MYSQL_AMBIGUOUS_IDENTIFIER_ERROR_NUMBERS = new Set([1052, 1066])
const MYSQL_SYNTAX_ERROR_NUMBERS = new Set([1064, 1149])
const MYSQL_INVALID_PARAMETER_ERROR_NUMBERS = new Set([1107, 1108, 1210, 1230, 1231, 1232, 1277, 1318, 1330, 1331, 1332, 1333, 1414, 1582, 1583, 1584, 1758, 1912, 2031, 2033, 2034, 2035, 2036, 2060, 2072, 4080, 4187, 45016, 45017])
const MYSQL_PERMISSION_DENIED_ERROR_NUMBERS = new Set([1095, 1142, 1143, 1144, 1211, 1227, 1269, 1370, 1403, 1410, 1961, 1962, 1979, 2068, 3059, 4151, 4166])
const MYSQL_AUTHENTICATION_ERROR_NUMBERS = new Set([1045, 1698, 1873, 2049, 2059, 2061, 2067, 4150])
const MYSQL_AUTHORIZATION_ERROR_NUMBERS = new Set([1044, 1130])
const MYSQL_CONNECTION_ERROR_NUMBERS = new Set([1042, 1043, 1047, 1053, 1080, 1081, 1129, 1152, 1154, 1155, 1156, 1157, 1158, 1160, 1184, 1189, 1190, 1218, 1927, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2009, 2012, 2013, 2016, 2017, 2018, 2024, 2025, 2026, 2027, 2038, 2039, 2040, 2041, 2042, 2043, 2044, 2045, 2046, 2047, 2055, 2064, 2066, 2070, 2075, 3032])
const MYSQL_CONNECTION_TIMEOUT_ERROR_NUMBERS = new Set([1159, 1161])
const MYSQL_RESOURCE_MEMORY_ERROR_NUMBERS = new Set([5, 34, 1037, 1038, 1041, 1119, 1135, 1206, 1257, 2008, 3015, 3044])
const MYSQL_RESOURCE_DISK_ERROR_NUMBERS = new Set([20, 35, 1114, 1197, 3019, 4139])
const MYSQL_RESOURCE_CONNECTION_ERROR_NUMBERS = new Set([1040, 1203])
const MYSQL_RESOURCE_LIMIT_ERROR_NUMBERS = new Set([23, 1104, 1116, 1117, 1118, 1197, 1206, 1226, 1258, 1437, 1461, 1920, 2020, 4003, 4026, 4040, 4043, 4075])
const MYSQL_IO_READ_ERROR_NUMBERS = new Set([2, 9, 12, 24, 1024, 1018])
const MYSQL_IO_WRITE_ERROR_NUMBERS = new Set([1, 3, 21, 25, 1004, 1006, 1026])
const MYSQL_IO_CLOSE_ERROR_NUMBERS = new Set([4])
const MYSQL_IO_DELETE_ERROR_NUMBERS = new Set([6])
const MYSQL_IO_LOCK_ERROR_NUMBERS = new Set([10, 1015])
const MYSQL_IO_UNLOCK_ERROR_NUMBERS = new Set([11])
const MYSQL_IO_FILE_STAT_ERROR_NUMBERS = new Set([13, 1013])
const MYSQL_IO_FILE_NOT_FOUND_ERROR_NUMBERS = new Set([29, 1017])
const MYSQL_IO_ACCESS_ERROR_NUMBERS = new Set([31, 32])
const MYSQL_IO_FSYNC_ERROR_NUMBERS = new Set([27])
const MYSQL_IO_SEEK_ERROR_NUMBERS = new Set([33])
const MYSQL_IO_PATH_ERROR_NUMBERS = new Set([7, 14, 15, 16, 17, 26, 1010, 1025, 1085, 1086, 2063, 2069])
const MYSQL_CONFIGURATION_ERROR_NUMBERS = new Set([22, 47, 48, 49, 51, 52, 53, 54, 59, 60, 63, 64, 65, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 84, 1193, 1238, 1273, 1284, 1286, 1911, 2019, 2028, 2074, 3003, 3009, 3027, 4065, 4133, 4167, 4182, 4185, 4201])
const MYSQL_DATABASE_CORRUPTED_ERROR_NUMBERS = new Set([1033, 1034, 1035, 1194, 1195, 1244, 1256, 1259, 1712, 3000, 4064])
const MYSQL_READ_ONLY_ERROR_NUMBERS = new Set([1036, 1099, 1207, 1223, 1792])
const MYSQL_FEATURE_NOT_SUPPORTED_ERROR_NUMBERS = new Set([1112, 1115, 1118, 1148, 1163, 1164, 1178, 1235, 1312, 1314, 1335, 1336, 1415, 1460, 1845, 1846, 1907, 1910, 1925, 1970, 1971, 2054, 2065, 3005, 3012, 3031, 3060, 4000, 4022, 4032, 4033, 4047, 4053, 4057, 4061, 4062, 4063, 4069, 4077, 4111, 4120, 4132, 4137, 4138, 4165, 4184, 4194, 4195, 4223, 4225])
const MYSQL_INVALID_DEFINITION_ERROR_NUMBERS = new Set([1005, 1063, 1067, 1068, 1069, 1070, 1071, 1073, 1074, 1075, 1089, 1101, 1113, 1120, 1121, 1166, 1167, 1170, 1171, 1173, 1239, 1252, 1280, 1281, 1320, 1322, 1323, 1327, 1337, 1338, 1407, 1425, 1426, 1427, 1439, 1453, 1458, 1901, 1903, 1904, 1905, 1967, 3007, 3014, 3018, 4005, 4006, 4008, 4009, 4011, 4012, 4013, 4014, 4015, 4016, 4017, 4018, 4019, 4020, 4021, 4023, 4024, 4030, 4058, 4097, 4108, 4110, 4113, 4116, 4119, 4121, 4122, 4123, 4126, 4128, 4130, 4131, 4152, 4154, 4155, 4157, 4169, 4170, 4171, 4174, 4180, 4191, 4198, 4199, 4200])
const MYSQL_INVALID_REFERENCE_ERROR_NUMBERS = new Set([1093, 1240, 1247, 1250, 1980, 4007, 4029, 4100, 4129, 4156, 4221])
const MYSQL_INVALID_GROUPING_ERROR_NUMBERS = new Set([1055, 1056, 1057, 1111, 1140, 1463, 1981, 3028, 3029, 4074])
const MYSQL_INVALID_IDENTIFIER_ERROR_NUMBERS = new Set([1059, 1102, 1103, 1166, 1280, 1281, 1308, 1309, 1310, 1458, 3057, 4081, 4083])
const MYSQL_INVALID_STATEMENT_CONTEXT_ERROR_NUMBERS = new Set([1090, 1096, 1175, 1192, 1204, 1221, 1225, 1228, 1229, 1233, 1234, 1243, 1313, 1324, 1923, 1930, 1933, 1954, 3004, 3016, 4001, 4105, 4106, 4116, 4119, 4121, 4122, 4140, 4141, 4142, 4143, 4144, 4158, 4172, 4177, 4180, 4196, 4224])
const MYSQL_TRANSACTION_ACTIVE_ERROR_NUMBERS = new Set([1179, 1192, 1568, 1929, 1953, 4059])
const MYSQL_TRANSACTION_ROLLBACK_ERROR_NUMBERS = new Set([1180, 1181, 1196, 1402, 1964, 3101, 4060])
const MYSQL_TRANSACTION_DEADLOCK_ERROR_NUMBERS = new Set([1213, 1614])
const MYSQL_TRANSACTION_TIMEOUT_ERROR_NUMBERS = new Set([1205, 1613, 3058])
const MYSQL_CURSOR_INVALID_STATE_ERROR_NUMBERS = new Set([1325, 1326])
const MYSQL_API_MISUSE_ERROR_NUMBERS = new Set([2014, 2029, 2030, 2048, 2050, 2051, 2052, 2053, 2056, 2057, 2058, 2062, 2071, 2073])
const MARIADB_INVALID_VALUE_ERROR_NUMBERS = new Set([1918, 3033, 3034, 3037, 3038, 3039, 3040, 3041, 3042, 3045, 3047, 4054, 4055, 4066, 4070, 4078, 4079, 4101, 4102, 4104, 4127, 4153, 4163, 4164, 4193])
const MARIADB_INVALID_FORMAT_ERROR_NUMBERS = new Set([1919, 1921, 1958, 3020, 3055, 4098, 4204, 4205])
const MARIADB_INVALID_ENCODING_ERROR_NUMBERS = new Set([1922, 1977])
const MARIADB_SEQUENCE_LIMIT_ERROR_NUMBERS = new Set([4084])
const MARIADB_ROLE_NOT_FOUND_ERROR_NUMBERS = new Set([1976])
const MARIADB_SEQUENCE_NOT_FOUND_ERROR_NUMBERS = new Set([4091])
const MARIADB_TRIGGER_NOT_FOUND_ERROR_NUMBERS = new Set([3011, 4031])
const MARIADB_OBJECT_ALREADY_EXISTS_ERROR_NUMBERS = new Set([1934, 1968, 1973, 1975])
const MARIADB_DUPLICATE_IDENTIFIER_ERROR_NUMBERS = new Set([4004, 4010, 4134])
const MARIADB_CARDINALITY_ERROR_NUMBERS = new Set([4002, 4099, 4197, 4202])
const MARIADB_STATEMENT_TIMEOUT_ERROR_NUMBERS = new Set([1931, 1969, 3024, 4192])
const MARIADB_EXTERNAL_DATA_SOURCE_ERROR_NUMBERS = new Set([1935, 1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1945, 1946, 1947, 1948, 1949, 1950, 1951, 1952, 1955, 1956, 1963, 1966, 3001, 3002, 3006, 3017, 3021, 3022, 3023, 3030, 4052, 4056, 4067, 4068, 4072, 4073, 4088, 4168, 4175, 4188, 4189, 4226])
const MARIADB_ROUTINE_ERROR_NUMBERS = new Set([3052, 3053, 4027, 4028, 4183])
const MARIADB_SEQUENCE_CORRUPTED_ERROR_NUMBERS = new Set([4085, 4086])
const MARIADB_WRONG_OBJECT_TYPE_ERROR_NUMBERS = new Set([1965, 4089, 4090, 4124])
const MARIADB_OBJECT_INVALID_STATE_ERROR_NUMBERS = new Set([1924, 4087, 4135, 4145, 4146, 4147, 4148, 4149])
const MARIADB_TRANSACTION_OUTCOME_UNKNOWN_ERROR_NUMBERS = new Set([4173])

export function getMySqlMariaDbEngineErrorReason(error: MySqlMariaDbEngineError): TsSqlErrorReason {
    const code = error.code || ''
    const sqlState = error.sqlState || ''
    const message = error.message || ''
    const databaseErrorCode = error.databaseErrorCode ?? getMySqlMariaDbDatabaseErrorCode(error)
    const databaseErrorMessage = message || undefined
    const errorNumber = getMySqlMariaDbErrorNumber(error.errno, code)

    return getMySqlMariaDbErrorReasonFromNumber(errorNumber, code, databaseErrorCode, databaseErrorMessage, message)
        || getMySqlMariaDbErrorReasonFromSqlState(sqlState, databaseErrorCode, databaseErrorMessage, message)
        || getMySqlMariaDbErrorReasonFromSymbol(code, databaseErrorCode, databaseErrorMessage, message)
        || getMySqlMariaDbErrorReasonFromMessage(message, databaseErrorCode, databaseErrorMessage)
        || getMySqlMariaDbKnownErrorFallbackReason(errorNumber, code, databaseErrorCode, databaseErrorMessage)
        || { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

function getMySqlMariaDbErrorReasonFromNumber(
    errorNumber: number | undefined,
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    if (typeof errorNumber !== 'number') {
        return undefined
    }

    const upperCode = code.toUpperCase()
    const mariaDbSymbolReason = getMariaDbSpecificSymbolReasonFromNumber(upperCode, databaseErrorCode, databaseErrorMessage, message)
    if (mariaDbSymbolReason) {
        return mariaDbSymbolReason
    }

    if (MYSQL_DUPLICATE_CONSTRAINT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    if (MYSQL_NOT_NULL_CONSTRAINT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'not null', columnName: extractQuotedName(message), tableName: extractMessageTableName(message) }
    }
    if (MYSQL_FOREIGN_KEY_CONSTRAINT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (MYSQL_CHECK_CONSTRAINT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (errorNumber === 1215) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid definition' }
    }

    if (MYSQL_INVALID_VALUE_TOO_LONG_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'too long', columnName: extractQuotedName(message) }
    }
    if (MYSQL_INVALID_VALUE_OUT_OF_RANGE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
    }
    if (MYSQL_INVALID_JSON_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid json', columnName: extractQuotedName(message) }
    }
    if (MARIADB_INVALID_ENCODING_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid encoding', columnName: extractQuotedName(message) }
    }
    if (MARIADB_INVALID_FORMAT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid format', columnName: extractQuotedName(message) }
    }
    if (MARIADB_INVALID_VALUE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value', columnName: extractQuotedName(message) }
    }
    if (MARIADB_SEQUENCE_LIMIT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'sequence limit' }
    }
    if (errorNumber === 1138 || errorNumber === 1263) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'null not allowed', columnName: extractQuotedName(message) }
    }
    if (errorNumber === 1292 || errorNumber === 1366 || errorNumber === 1367 || errorNumber === 1411 || errorNumber === 1416 || errorNumber === 2032) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value', columnName: extractQuotedName(message) }
    }
    if (errorNumber === 1139) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid regular expression' }
    }

    if (MYSQL_DATABASE_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (MYSQL_TABLE_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (MYSQL_COLUMN_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (MYSQL_ROUTINE_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (MYSQL_INDEX_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    if (MARIADB_ROLE_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'role', objectName: extractQuotedName(message) }
    }
    if (MARIADB_SEQUENCE_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'sequence', objectName: extractQuotedName(message) }
    }
    if (MARIADB_TRIGGER_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'trigger', objectName: extractQuotedName(message) }
    }
    if (errorNumber === 28) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'collation', objectName: extractQuotedName(message) }
    }
    if (errorNumber === 3548 || errorNumber === 3902) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }

    if (MYSQL_DATABASE_ALREADY_EXISTS_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (MYSQL_TABLE_ALREADY_EXISTS_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (MYSQL_COLUMN_ALREADY_EXISTS_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (MYSQL_ROUTINE_ALREADY_EXISTS_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (MYSQL_INDEX_ALREADY_EXISTS_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    if (MARIADB_OBJECT_ALREADY_EXISTS_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }
    if (errorNumber === 3712) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }

    if (MYSQL_AMBIGUOUS_IDENTIFIER_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: errorNumber === 1066 ? 'duplicate' : 'ambiguous' }
    }
    if (MARIADB_DUPLICATE_IDENTIFIER_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: 'duplicate' }
    }
    if (MYSQL_SYNTAX_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (errorNumber === 1365) {
        return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }
    }
    if (errorNumber === 1172 || errorNumber === 1222 || errorNumber === 1241 || errorNumber === 1242 || errorNumber === 1058 || errorNumber === 1136 || MARIADB_CARDINALITY_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (MYSQL_INVALID_PARAMETER_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getInvalidParameterDetailsFromMessage(message) }
    }
    if (MARIADB_ROUTINE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (MYSQL_PERMISSION_DENIED_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
    }
    if (MYSQL_AUTHENTICATION_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (MYSQL_AUTHORIZATION_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (errorNumber === 2022 || errorNumber === 2023 || MARIADB_EXTERNAL_DATA_SOURCE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (MARIADB_STATEMENT_TIMEOUT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'statement' }
    }
    if (MYSQL_CONNECTION_TIMEOUT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (MYSQL_CONNECTION_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: getConnectionErrorTypeFromNumber(errorNumber) }
    }
    if (MYSQL_RESOURCE_CONNECTION_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'connections' }
    }
    if (MYSQL_RESOURCE_MEMORY_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
    }
    if (MYSQL_RESOURCE_DISK_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
    }
    if (MYSQL_RESOURCE_LIMIT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
    }
    if (MYSQL_IO_READ_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'read' }
    }
    if (MYSQL_IO_WRITE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'write' }
    }
    if (MYSQL_IO_CLOSE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'close' }
    }
    if (MYSQL_IO_DELETE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'delete' }
    }
    if (MYSQL_IO_LOCK_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'lock' }
    }
    if (MYSQL_IO_UNLOCK_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unlock' }
    }
    if (MYSQL_IO_FILE_STAT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'file stat' }
    }
    if (MYSQL_IO_FILE_NOT_FOUND_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'file not found' }
    }
    if (MYSQL_IO_ACCESS_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'access' }
    }
    if (MYSQL_IO_FSYNC_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'fsync' }
    }
    if (MYSQL_IO_SEEK_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'seek' }
    }
    if (MYSQL_IO_PATH_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'path' }
    }
    if (MYSQL_CONFIGURATION_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorCode, databaseErrorMessage, configurationErrorType: 'runtime parameter' }
    }
    if (MYSQL_DATABASE_CORRUPTED_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_DATABASE_CORRUPTED', databaseErrorCode, databaseErrorMessage, corruptionType: getCorruptionTypeFromNumber(errorNumber) }
    }
    if (MARIADB_SEQUENCE_CORRUPTED_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_DATABASE_CORRUPTED', databaseErrorCode, databaseErrorMessage, corruptionType: 'sequence' }
    }
    if (MYSQL_READ_ONLY_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (MYSQL_FEATURE_NOT_SUPPORTED_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }
    if (MYSQL_INVALID_DEFINITION_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid definition' }
    }
    if (MYSQL_INVALID_REFERENCE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid reference' }
    }
    if (MYSQL_INVALID_GROUPING_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid grouping' }
    }
    if (MYSQL_INVALID_IDENTIFIER_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid identifier' }
    }
    if (MYSQL_INVALID_STATEMENT_CONTEXT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid statement context' }
    }
    if (MYSQL_TRANSACTION_DEADLOCK_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
    }
    if (MYSQL_TRANSACTION_TIMEOUT_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
    }
    if (MYSQL_TRANSACTION_ACTIVE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'active transaction' }
    }
    if (MYSQL_TRANSACTION_ROLLBACK_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
    }
    if (MARIADB_TRANSACTION_OUTCOME_UNKNOWN_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'outcome unknown' }
    }
    if (MYSQL_CURSOR_INVALID_STATE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: 'cursor', objectStateErrorType: 'invalid state' }
    }
    if (MARIADB_WRONG_OBJECT_TYPE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: getWrongObjectTypeFromNumber(errorNumber), objectName: extractQuotedName(message), objectStateErrorType: 'wrong object type' }
    }
    if (MARIADB_OBJECT_INVALID_STATE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message), objectStateErrorType: 'invalid state' }
    }
    if (MYSQL_API_MISUSE_ERROR_NUMBERS.has(errorNumber)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }
    if (errorNumber === 1317) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'cancelled' }
    }
    if (errorNumber === 3716) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectStateErrorType: 'dependent objects still exist' }
    }

    return undefined
}

function getMariaDbSpecificSymbolReasonFromNumber(
    upperCode: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    switch (upperCode) {
        case 'ER_NOT_AGGREGATE_FUNCTION':
        case 'ER_INVALID_AGGREGATE_FUNCTION':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid statement context' }
        case 'ER_VERS_NOT_VERSIONED':
            return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: 'table', objectName: extractQuotedName(message), objectStateErrorType: 'wrong object type' }
        case 'ER_MISSING':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'missing' }
        case 'ER_VERS_PERIOD_COLUMNS':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid definition' }
    }

    return undefined
}

function getMySqlMariaDbErrorReasonFromSqlState(
    sqlState: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    if (!sqlState || sqlState === 'HY000') {
        return undefined
    }

    switch (sqlState) {
        case '01000':
        case '01S00':
        case '01S01':
        case '02000':
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
        case '0A000':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
        case '0K000':
        case '0Z002':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid statement context' }
        case '20000':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'case not found' }
        case '22001':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'too long', columnName: extractQuotedName(message) }
        case '22003':
        case '22008':
        case '2201E':
        case '22S02':
        case '22S03':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
        case '22004':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'null not allowed', columnName: extractQuotedName(message) }
        case '22007':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid format' }
        case '22012':
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }
        case '22018':
        case '22032':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid json', columnName: extractQuotedName(message) }
        case '22023':
        case '22034':
        case '22035':
        case '2203F':
        case '22S00':
        case '22S01':
        case '22S04':
        case '22S05':
        case 'SR000':
        case 'SR002':
        case 'SR003':
        case 'SR006':
        case 'SU001':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value' }
        case '23000':
            return getConstraintReasonFromMessage(message, databaseErrorCode, databaseErrorMessage)
        case '24000':
            return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: 'cursor', objectStateErrorType: 'invalid state' }
        case '25000':
        case '25001':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'active transaction' }
        case '25006':
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
        case '2F003':
        case '2F005':
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
        case '35000':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid index' }
        case '3D000':
        case '42Y07':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
        case '40000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
        case '40001':
            return message.toLowerCase().includes('deadlock')
                ? { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
                : { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'serialization failure' }
        case '42000':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
        case '42S01':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
        case '42S02':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
        case '42S12':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
        case '42S21':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
        case '42S22':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
        case '70100':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'cancelled' }
        case 'HY001':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
        case 'SR001':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
        case 'SR004':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
        case 'SR005':
            return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectStateErrorType: 'dependent objects still exist' }
        case 'XA100':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
        case 'XA102':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
        case 'XA106':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'transaction' }
        case 'XAE03':
        case 'XAE07':
        case 'XAE09':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
        case 'XAE04':
        case 'XAE05':
        case 'XAE08':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid value' }
    }

    if (sqlState.startsWith('08')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (sqlState.startsWith('21')) {
        return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (sqlState.startsWith('22')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value' }
    }
    if (sqlState.startsWith('23')) {
        return getConstraintReasonFromMessage(message, databaseErrorCode, databaseErrorMessage)
    }
    if (sqlState.startsWith('28')) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (sqlState.startsWith('42')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function getMySqlMariaDbErrorReasonFromSymbol(
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    if (!code) {
        return undefined
    }

    const upperCode = code.toUpperCase()
    if (!upperCode.startsWith('ER_')) {
        return undefined
    }

    if (upperCode.includes('DUP') || upperCode.includes('UNIQUE')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    if (upperCode.includes('FOREIGN') || upperCode.includes('REFERENCED')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (upperCode.includes('CHECK_CONSTRAINT') || upperCode.includes('CONSTRAINT_FAILED')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (upperCode.includes('SEQUENCE_RUN_OUT')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'sequence limit' }
    }
    if (upperCode.includes('NOT_SEQUENCE') || upperCode.includes('IT_IS_A_VIEW')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectStateErrorType: 'wrong object type', objectName: extractQuotedName(message) }
    }
    if (upperCode.includes('NO_SUCH') || upperCode.includes('UNKNOWN') || upperCode.includes('NOT_FOUND') || upperCode.includes('DOES_NOT_EXIST') || upperCode.includes('DROP_EXISTS')) {
        return getObjectNotFoundFromSymbol(upperCode, databaseErrorCode, databaseErrorMessage, message)
    }
    if (upperCode.includes('ALREADY_EXISTS') || upperCode.includes('CREATE_EXISTS') || upperCode.includes('TABLE_EXISTS')) {
        return getObjectAlreadyExistsFromSymbol(upperCode, databaseErrorCode, databaseErrorMessage, message)
    }
    if (upperCode.includes('ACCESS_DENIED') || upperCode.includes('AUTH')) {
        return upperCode.includes('AUTH') ? { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage } : { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.includes('TIMEOUT') || upperCode.includes('INTERRUPTED') || upperCode.includes('CANCELED')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: upperCode.includes('LOCK') ? 'lock' : 'connection' }
    }
    if (upperCode.includes('READ_ONLY') || upperCode.includes('READONLY')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.includes('OUT_OF_MEMORY') || upperCode.includes('OUTOFMEMORY')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
    }
    if (upperCode.includes('DISK_FULL') || upperCode.includes('FILE_FULL')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
    }
    if (upperCode.includes('CONNECTION') || upperCode.includes('SOCKET') || upperCode.includes('HANDSHAKE') || upperCode.includes('SERVER_LOST') || upperCode.includes('SERVER_GONE')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (upperCode.includes('SYNTAX') || upperCode.includes('PARSE')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.includes('NOT_SUPPORTED') || upperCode.includes('NOT_IMPLEMENTED')) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function getMySqlMariaDbErrorReasonFromMessage(
    message: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason | undefined {
    const lower = message.toLowerCase()
    if (!lower) {
        return undefined
    }

    if (lower.includes('duplicate entry') || lower.includes('duplicate key') || lower.includes('unique constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    if (lower.includes('foreign key constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (lower.includes('cannot be null') || lower.includes('not null')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'not null', columnName: extractQuotedName(message), tableName: extractMessageTableName(message) }
    }
    if (lower.includes('check constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (lower.includes('unknown database') || lower.includes('no database selected')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (lower.includes("table") && (lower.includes("doesn't exist") || lower.includes('unknown table'))) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (lower.includes('unknown column')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (lower.includes('already exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }
    if (lower.includes('ambiguous')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: 'ambiguous' }
    }
    if (lower.includes('syntax')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('division by 0') || lower.includes('division by zero')) {
        return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('out of range')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
    }
    if (lower.includes('data too long') || lower.includes('too long')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'too long', columnName: extractQuotedName(message) }
    }
    if (lower.includes('invalid json')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid json', columnName: extractQuotedName(message) }
    }
    if (lower.includes('access denied')) {
        return lower.includes('using password')
            ? { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
            : { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('deadlock')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
    }
    if (lower.includes('lock wait timeout')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
    }
    if (lower.includes('query execution was interrupted')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'cancelled' }
    }
    if (lower.includes('read only') || lower.includes('read-only')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('out of memory')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
    }
    if (lower.includes('disk is full') || lower.includes('table') && lower.includes(' is full')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
    }
    if (lower.includes('too many connections')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'connections' }
    }
    if (lower.includes('lost connection') || lower.includes('server has gone away') || lower.includes("can't connect") || lower.includes('bad handshake')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (lower.includes('not supported') || lower.includes('not implemented')) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function getMySqlMariaDbKnownErrorFallbackReason(
    errorNumber: number | undefined,
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason | undefined {
    const upperCode = code.toUpperCase()

    if (upperCode === 'CR_UNKNOWN_ERROR' || errorNumber === 2000) {
        return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.startsWith('CR_') || isInRange(errorNumber, 2000, 2999)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }
    if (upperCode.startsWith('EE_') || isInRange(errorNumber, 1, 999)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (upperCode.startsWith('ER_') || upperCode.startsWith('MY-') || isInRange(errorNumber, 1000, 5999)) {
        if (upperCode.includes('WARN') || upperCode.includes('NOTE') || upperCode.includes('INFO')) {
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
        }
        if (upperCode.includes('REPLICA') || upperCode.includes('SOURCE') || upperCode.includes('SLAVE') || upperCode.includes('MASTER') || upperCode.includes('GTID') || upperCode.includes('RPL') || upperCode.includes('BINLOG') || upperCode.includes('GROUP_REPLICATION')) {
            return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', databaseErrorCode, databaseErrorMessage }
        }
        if (upperCode.includes('LOCK')) {
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
        }
        if (upperCode.includes('FILE') || upperCode.includes('DIR') || hasSymbolWord(upperCode, 'READ') || hasSymbolWord(upperCode, 'WRITE') || hasSymbolWord(upperCode, 'OPEN')) {
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unknown' }
        }
        if (upperCode.includes('WRONG') || upperCode.includes('BAD') || upperCode.includes('INVALID') || upperCode.includes('ILLEGAL') || upperCode.includes('CANT') || upperCode.includes('MISSING')) {
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
        }
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }

    return undefined
}

export function isMySqlMariaDbEngineError(error: unknown): error is MySqlMariaDbEngineError & Error {
    if (!(error instanceof Error)) {
        return false
    }
    const engineError = error as MySqlMariaDbEngineError
    return typeof engineError.errno === 'number'
        || typeof engineError.sqlState === 'string'
        || isMySqlMariaDbEngineErrorCode(engineError.code)
}

export function isMySqlMariaDbEngineErrorCode(code: unknown): code is string {
    if (typeof code !== 'string') {
        return false
    }
    const normalizedCode = code.toUpperCase()
    return normalizedCode.startsWith('ER_')
        || normalizedCode.startsWith('CR_')
        || normalizedCode.startsWith('EE_')
        || /^MY-0*\d+$/.test(normalizedCode)
        || /^\d+$/.test(normalizedCode)
        || MYSQL_MARIADB_ERROR_CODE_NUMBERS.has(normalizedCode)
}

function getMySqlMariaDbErrorNumber(errno: number | undefined, code: string): number | undefined {
    if (typeof errno === 'number') {
        return errno
    }
    if (!code) {
        return undefined
    }
    const normalizedCode = code.toUpperCase()
    const mappedNumber = MYSQL_MARIADB_ERROR_CODE_NUMBERS.get(normalizedCode)
    if (mappedNumber !== undefined) {
        return mappedNumber
    }
    const myErrorNumber = /^MY-0*(\d+)$/.exec(normalizedCode)
    if (myErrorNumber) {
        return Number(myErrorNumber[1])
    }
    if (/^\d+$/.test(normalizedCode)) {
        return Number(normalizedCode)
    }
    return undefined
}

function isInRange(value: number | undefined, min: number, max: number): boolean {
    return typeof value === 'number' && value >= min && value <= max
}

function hasSymbolWord(code: string, word: string): boolean {
    return code === word || code.includes('_' + word + '_') || code.endsWith('_' + word) || code.startsWith(word + '_')
}

function getConnectionErrorTypeFromNumber(errorNumber: number): 'connection lost' | 'temporarily unavailable' | 'invalid connection configuration' {
    switch (errorNumber) {
        case 1042:
        case 2005:
        case 2019:
        case 2026:
        case 2059:
        case 2064:
        case 2066:
        case 2070:
        case 2074:
        case 2075:
            return 'invalid connection configuration'
        case 1040:
        case 1129:
        case 3032:
            return 'temporarily unavailable'
        default:
            return 'connection lost'
    }
}

function getCorruptionTypeFromNumber(errorNumber: number): 'database file' | 'index' | 'sequence' | 'virtual table' | 'filesystem' | 'checksum' {
    switch (errorNumber) {
        case 1034:
        case 1035:
        case 1712:
            return 'index'
        case 1033:
        case 1194:
        case 1195:
        case 1244:
            return 'database file'
        default:
            return 'checksum'
    }
}

function getWrongObjectTypeFromNumber(errorNumber: number): 'table or view' | 'sequence' {
    switch (errorNumber) {
        case 4089:
        case 4090:
            return 'sequence'
        default:
            return 'table or view'
    }
}

function getInvalidParameterDetailsFromMessage(message: string): {
    parameterErrorType?: 'missing' | 'too many' | 'wrong count' | 'invalid name' | 'invalid index' | 'invalid type' | 'invalid value' | 'invalid binding' | 'not bindable' | 'already bound'
    expectedParameterCount?: number
    actualParameterCount?: number
} {
    const lower = message.toLowerCase()
    const countMatch = /expected\s+(\d+),\s+got\s+(\d+)/i.exec(message)
    if (countMatch) {
        return { parameterErrorType: 'wrong count', expectedParameterCount: Number(countMatch[1]), actualParameterCount: Number(countMatch[2]) }
    }
    if (lower.includes('parameter count') || lower.includes('number of arguments') || lower.includes('wrong no of args')) {
        return { parameterErrorType: 'wrong count' }
    }
    if (lower.includes('not bound') || lower.includes('no data supplied')) {
        return { parameterErrorType: 'missing' }
    }
    if (lower.includes('invalid parameter number') || lower.includes('condition number')) {
        return { parameterErrorType: 'invalid index' }
    }
    if (lower.includes('unsupported buffer type') || lower.includes('incorrect argument type')) {
        return { parameterErrorType: 'invalid type' }
    }
    if (lower.includes('duplicate parameter') || lower.includes('used twice')) {
        return { parameterErrorType: 'already bound' }
    }
    return { parameterErrorType: 'invalid value' }
}

function getConstraintReasonFromMessage(
    message: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason {
    const lower = message.toLowerCase()
    if (lower.includes('foreign key')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (lower.includes('cannot be null') || lower.includes('not null')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'not null', columnName: extractQuotedName(message), tableName: extractMessageTableName(message) }
    }
    if (lower.includes('check constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (lower.includes('ambiguous')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: 'ambiguous' }
    }
    if (lower.includes('duplicate') || lower.includes('unique')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
}

function getObjectNotFoundFromSymbol(
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason {
    if (code.includes('DB') || code.includes('DATABASE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (code.includes('TABLE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (code.includes('ROLE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'role', objectName: extractQuotedName(message) }
    }
    if (code.includes('SEQUENCE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'sequence', objectName: extractQuotedName(message) }
    }
    if (code.includes('TRG') || code.includes('TRIGGER')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'trigger', objectName: extractQuotedName(message) }
    }
    if (code.includes('FIELD') || code.includes('COLUMN')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (code.includes('PROC') || code.includes('ROUTINE') || code.includes('SP_') || code.includes('FUNCTION') || code.includes('UDF')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (code.includes('KEY') || code.includes('INDEX')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
}

function getObjectAlreadyExistsFromSymbol(
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason {
    if (code.includes('DB') || code.includes('DATABASE')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (code.includes('TABLE')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (code.includes('SEQUENCE')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'sequence', objectName: extractQuotedName(message) }
    }
    if (code.includes('TRG') || code.includes('TRIGGER')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'trigger', objectName: extractQuotedName(message) }
    }
    if (code.includes('FIELD') || code.includes('COLUMN')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (code.includes('PROC') || code.includes('ROUTINE') || code.includes('SP_') || code.includes('FUNCTION') || code.includes('UDF')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (code.includes('KEY') || code.includes('INDEX')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
}

function getMySqlMariaDbDatabaseErrorCode(error: MySqlMariaDbEngineError): TsSqlDatabaseErrorCode | undefined {
    return error.errno ?? (error.code || undefined) ?? (error.sqlState || undefined)
}

function extractQuotedName(message: string): string | undefined {
    const backtick = /`([^`]+)`/.exec(message)
    if (backtick) {
        return backtick[1]
    }
    const singleQuoted = /(^|[^A-Za-z])'([^']+)'(?![A-Za-z])/.exec(message)
    if (singleQuoted) {
        return singleQuoted[2]
    }
    const doubleQuoted = /"([^"]+)"/.exec(message)
    if (doubleQuoted) {
        return doubleQuoted[1]
    }
    return undefined
}

function extractKeyName(message: string): string | undefined {
    const match = /for key ['`"]([^'"`]+)['`"]/.exec(message)
    if (match) {
        return match[1]
    }
    const constraintMatch = /constraint [`'"]([^`'"]+)[`'"]/i.exec(message)
    if (constraintMatch) {
        return constraintMatch[1]
    }
    return extractQuotedName(message)
}

function extractMessageTableName(message: string): string | undefined {
    const backtickQualified = /`[^`]+`\.`([^`]+)`/.exec(message)
    if (backtickQualified) {
        return backtickQualified[1]
    }
    const quotedTable = /table ['`"]([^'"`]+)['`"]/i.exec(message)
    if (quotedTable) {
        return quotedTable[1]
    }
    return undefined
}

function extractConstraintTableName(message: string): string | undefined {
    return extractMessageTableName(message)
}

function extractCheckTableName(message: string): string | undefined {
    const match = /failed for [`'"][^`'"]+[`'"]\.[`'"]([^`'"]+)[`'"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return extractMessageTableName(message)
}

function extractForeignKeyColumnName(message: string): string | undefined {
    const match = /foreign key\s*\([`'"]([^`'"]+)[`'"]\)/i.exec(message)
    if (match) {
        return match[1]
    }
    return undefined
}
