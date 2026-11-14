/**
 * The SQL Server error numbers of a feature the server doesn't support, mapped to `SQL_FEATURE_NOT_SUPPORTED`. Each set
 * of this module holds the error numbers of one group, and `getSqlServerEngineErrorReason` gives the reason of the
 * group to a number it doesn't handle one by one.
 */
export const SQL_SERVER_FEATURE_NOT_SUPPORTED_ERROR_NUMBERS = new Set([
    324, 369, 534, 1096,
    12300, 12301, 12302, 12303, 12304, 12305, 12306, 12308, 12309,
    40051, 40052, 40054, 40058, 40073, 42303, 43203, 45014, 45038, 45043,
    40504, 40508, 40510, 40511, 40512, 40513, 40514, 40515, 40516, 40517, 40518, 40520, 40521, 40522, 40523, 40524, 40525, 40526, 40527,
    40528, 40529, 40536, 40555, 40559, 40575, 40576, 40577, 40578, 40579, 40580, 40584, 40586, 40587, 40597, 40598, 40599, 40606,
    40607, 4122,
])

/** The error numbers of a missing parameter, mapped to `SQL_INVALID_PARAMETER` of type `missing`. */
export const SQL_SERVER_MISSING_PARAMETER_ERROR_NUMBERS = new Set([201, 216, 313, 8178])
/** The error numbers of too many parameters, mapped to `SQL_INVALID_PARAMETER` of type `too many`. */
export const SQL_SERVER_TOO_MANY_PARAMETERS_ERROR_NUMBERS = new Set([8144, 8146])
/** The error numbers of a wrong number of parameters, mapped to `SQL_INVALID_PARAMETER` of type `wrong count`. */
export const SQL_SERVER_WRONG_PARAMETER_COUNT_ERROR_NUMBERS = new Set([8008])
/** The error numbers of an invalid parameter name, mapped to `SQL_INVALID_PARAMETER` of type `invalid name`. */
export const SQL_SERVER_INVALID_PARAMETER_NAME_ERROR_NUMBERS = new Set([8005, 349])
/** The error numbers of an invalid parameter value, mapped to `SQL_INVALID_PARAMETER` of type `invalid value`. */
export const SQL_SERVER_INVALID_PARAMETER_VALUE_ERROR_NUMBERS = new Set([214, 225])
/**
 * The error numbers of a null parameter where a null isn't allowed, mapped to `SQL_INVALID_VALUE` of type
 * `null not allowed`.
 */
export const SQL_SERVER_PARAMETER_NULL_NOT_ALLOWED_ERROR_NUMBERS = new Set([8022, 8042, 13638])
/**
 * The error numbers of a parameter whose value is invalid for its data type, mapped to `SQL_INVALID_VALUE` of type
 * `invalid value`.
 */
export const SQL_SERVER_PARAMETER_INVALID_VALUE_ERROR_NUMBERS = new Set([8023, 8043])
/**
 * The error numbers of a parameter whose value is too long for its data type, mapped to `SQL_INVALID_VALUE` of type
 * `too long`.
 */
export const SQL_SERVER_PARAMETER_TOO_LONG_ERROR_NUMBERS = new Set([8028, 8046])
/** The error numbers mapped to `SQL_CARDINALITY_VIOLATION`. */
export const SQL_SERVER_CARDINALITY_VIOLATION_ERROR_NUMBERS = new Set([109, 110, 116, 120, 121, 205, 213])
/** The error numbers mapped to `SQL_SYNTAX_ERROR`. */
export const SQL_SERVER_SYNTAX_ERROR_NUMBERS = new Set([1018, 1034, 1035, 1731, 1732, 1733, 1734, 1736, 1740, 1741, 3019, 3220, 3225, 3749, 3766])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `type mismatch`. */
export const SQL_SERVER_TYPE_MISMATCH_STATEMENT_ERROR_NUMBERS = new Set([257, 402, 403, 450, 529, 8116, 8117, 13636])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid reference`. */
export const SQL_SERVER_INVALID_REFERENCE_STATEMENT_ERROR_NUMBERS = new Set([107, 4121])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid identifier`. */
export const SQL_SERVER_INVALID_IDENTIFIER_STATEMENT_ERROR_NUMBERS = new Set([203, 243])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid definition`. */
export const SQL_SERVER_INVALID_DEFINITION_STATEMENT_ERROR_NUMBERS = new Set([142, 423, 424, 432, 435, 1038, 4502, 4505, 4506, 12307, 41321, 41327])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid statement context`. */
export const SQL_SERVER_INVALID_STATEMENT_CONTEXT_ERROR_NUMBERS = new Set([101, 112, 154, 226, 259, 287, 321, 323, 413, 414, 544, 545, 1058, 4005, 4006, 4007, 4508])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid windowing`. */
export const SQL_SERVER_INVALID_WINDOWING_STATEMENT_ERROR_NUMBERS = new Set([4108, 4109, 4112, 4113])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid argument`. */
export const SQL_SERVER_INVALID_ARGUMENT_STATEMENT_ERROR_NUMBERS = new Set([536, 537, 577, 1023, 1228, 4114, 4116, 9820, 9828, 9987, 41303, 41394, 42304, 42305, 43201, 43202, 45020, 45021])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid grouping`. */
export const SQL_SERVER_INVALID_GROUPING_STATEMENT_ERROR_NUMBERS = new Set([144, 164, 278, 329, 8124, 8127])
/** The error numbers mapped to `SQL_INVALID_SQL_STATEMENT` of type `invalid recursion`. */
export const SQL_SERVER_INVALID_RECURSION_STATEMENT_ERROR_NUMBERS = new Set([460, 461, 462, 463, 464, 465, 466, 467])
/** The error numbers mapped to `SQL_DATABASE_CORRUPTED` of type `database file`. */
export const SQL_SERVER_DATABASE_CORRUPTED_FILE_ERROR_NUMBERS = new Set([
    211, 602, 603, 606, 608, 610, 669, 682, 683, 684, 692, 824, 829, 882, 907, 3301, 3302,
    40050, 40067, 40072, 40080, 40083,
])
/** The error numbers mapped to `SQL_DATABASE_CORRUPTED` of type `checksum`. */
export const SQL_SERVER_DATABASE_CORRUPTED_CHECKSUM_ERROR_NUMBERS = new Set([832])
/** The error numbers mapped to `SQL_INTERNAL_ERROR` of type `engine internal`. */
export const SQL_SERVER_INTERNAL_ERROR_NUMBERS = new Set([204, 407, 440, 565, 691, 885, 3624, 3696, 8601, 8624, 8630, 9821, 9822, 40640, 40662, 13628, 13629, 13630, 13631, 13633, 13634, 13635, 13637])
/** The error numbers mapped to `SQL_IO_ERROR` of type `access`. */
export const SQL_SERVER_IO_ACCESS_ERROR_NUMBERS = new Set([3017, 3061, 3201, 4861, 5120, 5123])
/** The error numbers mapped to `SQL_IO_ERROR` of type `read`. */
export const SQL_SERVER_IO_READ_ERROR_NUMBERS = new Set([3203, 4862])
/** The error numbers mapped to `SQL_IO_ERROR` of type `write`. */
export const SQL_SERVER_IO_WRITE_ERROR_NUMBERS = new Set([3202, 4870, 5149])
/** The error numbers mapped to `SQL_IO_ERROR` of type `path`. */
export const SQL_SERVER_IO_PATH_ERROR_NUMBERS = new Set([5133])
/** The error numbers mapped to `SQL_IO_ERROR` of type `unknown`. */
export const SQL_SERVER_IO_UNKNOWN_ERROR_NUMBERS = new Set([810, 823, 835, 837, 5159])
/** The error numbers mapped to `SQL_EXTERNAL_DATA_SOURCE_ERROR`. */
export const SQL_SERVER_EXTERNAL_DATA_SOURCE_ERROR_NUMBERS = new Set([7301, 7302, 7303, 7304, 7305, 7306, 7310, 7311, 7313, 7314, 7317, 7320, 7399])
/** The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` of resource `memory`. */
export const SQL_SERVER_MEMORY_RESOURCE_ERROR_NUMBERS = new Set([1437, 1471, 6532, 6533, 8356, 8359, 8651, 8657, 9824, 9827, 41331, 41379])
/** The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` of resource `disk`. */
export const SQL_SERVER_DISK_RESOURCE_ERROR_NUMBERS = new Set([3911])
/** The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` of resource `temp space`. */
export const SQL_SERVER_TEMP_SPACE_RESOURCE_ERROR_NUMBERS = new Set([1138])
/** The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` of resource `cpu`. */
export const SQL_SERVER_CPU_RESOURCE_ERROR_NUMBERS = new Set([10961])
/** The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` without a resource type. */
export const SQL_SERVER_GENERIC_RESOURCE_ERROR_NUMBERS = new Set([1204, 3627, 41340])
/**
 * The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` of resource `parameters`, with the limit read from the
 * message.
 */
export const SQL_SERVER_PARAMETERS_RESOURCE_ERROR_NUMBERS = new Set([180, 6206, 8003])
/**
 * The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` of resource `statement elements`, with the limit read from
 * the message.
 */
export const SQL_SERVER_STATEMENT_ELEMENTS_RESOURCE_ERROR_NUMBERS = new Set([106, 1056, 1702, 4408, 4414, 10738])
/**
 * The error numbers mapped to `SQL_RESOURCE_LIMIT_REACHED` of resource `statement complexity`, with the limit read from
 * the message.
 */
export const SQL_SERVER_STATEMENT_COMPLEXITY_RESOURCE_ERROR_NUMBERS = new Set([125, 191, 8621, 8623, 8631, 8632])
/** The error numbers mapped to `SQL_READ_ONLY_VIOLATION`. */
export const SQL_SERVER_READ_ONLY_ERROR_NUMBERS = new Set([
    652, 671, 975, 1466, 1924, 1926, 2554, 2596, 3415, 3416, 3740, 4344, 4978, 5048, 5055, 5063, 5244, 7690, 9775, 28014, 40188, 41361,
])
/** The error numbers mapped to `SQL_CONNECTION_ERROR` of type `connection lost`. */
export const SQL_SERVER_CONNECTION_LOST_ERROR_NUMBERS = new Set([4014, 7836])
/** The error numbers mapped to `SQL_CONNECTION_ERROR` of type `temporarily unavailable`. */
export const SQL_SERVER_TEMPORARILY_UNAVAILABLE_CONNECTION_ERROR_NUMBERS = new Set([976, 982])
/** The error numbers mapped to `SQL_CONNECTION_ERROR` of type `invalid connection configuration`. */
export const SQL_SERVER_INVALID_CONNECTION_CONFIGURATION_ERROR_NUMBERS = new Set([978, 979, 45031])
/** The error numbers mapped to `SQL_PERMISSION_DENIED`. */
export const SQL_SERVER_PERMISSION_DENIED_ERROR_NUMBERS = new Set([368, 371, 373, 41363, 41376])
/** The error numbers mapped to `SQL_AUTHORIZATION_ERROR`. */
export const SQL_SERVER_AUTHORIZATION_ERROR_NUMBERS = new Set([1202, 1230])
/** The error numbers mapped to `SQL_INVALID_VALUE` of type `invalid json`. */
export const SQL_SERVER_INVALID_JSON_ERROR_NUMBERS = new Set([13606, 13607, 13609, 13645])
/** The JSON error numbers mapped to `SQL_INVALID_VALUE` of type `too long`. */
export const SQL_SERVER_INVALID_JSON_TOO_LONG_ERROR_NUMBERS = new Set([13613, 13615, 13625, 13639, 13644, 13646, 13648, 13650])
/** The JSON error numbers mapped to `SQL_INVALID_VALUE` of type `invalid value`. */
export const SQL_SERVER_INVALID_JSON_VALUE_ERROR_NUMBERS = new Set([13612, 13622, 13659, 13670, 13671, 13692])
/** The JSON error numbers mapped to `SQL_FEATURE_NOT_SUPPORTED`. */
export const SQL_SERVER_JSON_FEATURE_NOT_SUPPORTED_ERROR_NUMBERS = new Set([13614, 13616, 13617, 13619, 13654, 13655, 13656, 13657, 13658, 13660, 13661, 13662, 13663, 13665, 13687])
/** The XML error numbers mapped to `SQL_INVALID_VALUE` of type `invalid xml`. */
export const SQL_SERVER_INVALID_XML_ERROR_NUMBERS = new Set([
    6901, 6904, 6905, 6906, 6909, 6911, 6912, 6913, 6914, 6916, 6917, 6918, 6919, 6921, 6922, 6923, 6924, 6926, 6927, 6929,
    6930, 6931, 6933, 6934, 6936, 6937, 6938, 6939, 6947,
])
/** The XML error numbers mapped to `SQL_INVALID_VALUE` of type `too long`. */
export const SQL_SERVER_INVALID_XML_TOO_LONG_ERROR_NUMBERS = new Set([6907, 6915, 6935])
