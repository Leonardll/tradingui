class BinanceError extends Error {
    public code: number
    public message: string

    constructor(code: number, message: string) {
        super(message)
        this.code = code
        this.message = message
    }

    static fromCode(code: number): BinanceError {
        const errorMessages: { [key: string]: string } = {
            "-1000": "UNKNOWN: An unknown error occurred while processing the request.",
            "-1001":
                "DISCONNECTED: Internal error; unable to process your request. Please try again.",
            "-1002": "UNAUTHORIZED: You are not authorized to execute this request.",
            "-1003": "TOO_MANY_REQUESTS: Too many requests queued.",
            "-1004":
                "UNEXPECTED_RESP: An unexpected response was received from the message bus. Execution status unknown.",
            "-1005":
                "TIMEOUT: Timeout waiting for response from backend server. Send status unknown; execution status unknown.",
            "-1006": "UNKNOWN_ORDER_COMPOSITION: Unknown order sent.",
            "-1007": "TOO_MANY_ORDERS: Too many new orders.",
            "-1008": "SERVICE_SHUTTING_DOWN: This service is no longer available.",
            "-1009": "UNSUPPORTED_OPERATION: This operation is not supported.",
            "-1010": "INVALID_TIMESTAMP: Timestamp for this request is outside of the recvWindow.",
            "-1011": "INVALID_SIGNATURE: Signature for this request is not valid.",
            "-1012": "ILLEGAL_CHARS: Illegal characters found in a parameter.",
            "-1013": "INSUFFICIENT_BALANCE: Not enough balance to execute this request.",
            "-1014": "UNKNOWN_ORDER: Order does not exist.",
            "-1015": "UNKNOWN_TRADING_PAIR: Unsupported trading pair for this request.",
            "-1016": "INVALID_ORDER: Unsupported order type for this request.",
            "-1017": "INVALID_AMOUNT: Unsupported amount.",
            "-1018": "INVALID_PRICE: Unsupported price.",
            "-1019": "UNKNOWN_ERROR: An unknown error occurred while processing the request.",
            "-1020":
                "INVALID_PARAMETER: A mandatory parameter was not sent, was empty/null, or malformed.",
            "-1021": "NULL_PARAMETER: A parameter was sent that was null.",
            "-1022": "ALREADY_EXISTS: An attempt to insert an item that already exists was made.",
            "-1023": "INVALID_DATA: An invalid data value was sent and could not be processed.",
            "-1024": "NOT_FOUND: Requested resource was not found.",
            // ... (add all other error codes and messages here)
            "-1100": "ILLEGAL_CHARS: Illegal characters found in a parameter.",
            "-1101": "TOO_MANY_PARAMETERS: Too many parameters sent for this endpoint.",
            "-1102":
                "MANDATORY_PARAM_EMPTY_OR_MALFORMED: A mandatory parameter was not sent, was empty/null, or malformed.",
            "-1103": "UNKNOWN_PARAM: An unknown parameter was sent.",
            "-1104": "UNREAD_PARAMETERS: Not all sent parameters were read.",
            "-1105": "PARAM_EMPTY: A parameter was empty.",
            "-1106": "PARAM_NOT_REQUIRED: A parameter was sent when not required.",
            "-1112": "NO_DEPTH: No orders on book for symbol.",
            "-1114": "INVALID_LISTEN_KEY: This listenKey does not exist.",
            "-1115": "MORE_THAN_XX_HOURS: Lookup interval is too big.",
            "-1116": "OPTIONAL_PARAMS_BAD_COMBO: Combination of optional parameters invalid.",
            "-1117":
                "INVALID_PARAMETER: A mandatory parameter was not sent, was empty/null, or malformed.",
            "-1118": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
            "-1119": "DUPLICATE_API_KEY_DESC: Duplicate API key description.",
            "-1120": "INSUFFICIENT_BALANCE: Insufficient balance.",
            "-1121": "CANCEL_ALL_FAIL: Some error in canceling all open orders.",
            "-1125": "TIF_NOT_REQUIRED: TimeInForce parameter sent when not required.",
            "-1127": "INVALID_TIF: Invalid timeInForce.",
            "-1128": "INVALID_ORDER_TYPE: Invalid orderType.",
            "-1130": "INVALID_SIDE: Invalid side.",
            "-1131": "EMPTY_NEW_CL_ORD_ID: New client order ID was empty.",
            "-1132": "EMPTY_ORG_CL_ORD_ID: Original client order ID was empty.",
            "-1133": "BAD_INTERVAL: Invalid interval.",
            "-1134": "BAD_SYMBOL: Invalid symbol.",
            "-1135": "INVALID_LISTEN_KEY: This listenKey does not exist.",
            "-1136": "MORE_THAN_XX_HOURS: Lookup interval is too big.",
            "-1137": "OPTIONAL_PARAMS_BAD_COMBO: Combination of optional parameters invalid.",
            "-1138":
                "INVALID_PARAMETER: A mandatory parameter was not sent, was empty/null, or malformed.",
            "-1139": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
            "-1140": "NEW_ORDER_REJECTED: New order was rejected.",
            "-1141": "CANCEL_REJECTED: Cancel order was rejected.",
            "-1142": "CANCEL_ALL_FAIL: Some error in canceling all open orders.",
            "-1143": "NO_SUCH_ORDER: Specified order does not exist.",
            "-1144": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
            "-1145": "Invalid cancelRestrictions",
            "-1146": "DUPLICATE_API_KEY_DESC: Duplicate API key description.",
            "-1147": "INSUFFICIENT_BALANCE: Insufficient balance.",
            "-1148": "CANCEL_ALL_FAIL: Some error in canceling all open orders.",
            "-1149": "NO_SUCH_ORDER: Specified order does not exist.",
            "-1150": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
            "-1151": "EMPTY_ORG_CL_ORD_ID: Original client order ID was empty.",

            // Add more error codes as needed
            "-2008": "NO_DEPTH: No orders on book for symbol.",
            "-2010": "INVALID_LISTEN_KEY: This listenKey does not exist.",
            "-2011": "Order was not canceled due to cancel restrictions.",
            "-2012": "INVALID_INTERVAL: Invalid interval.",
            "-2013": "INVALID_DEPTH: Invalid depth.",
            "-2014": "INVALID_LIMIT: Invalid limit.",
            "-2015": "INVALID_START_TIME: Invalid start time.",
        }

        return new BinanceError(code, errorMessages[code.toString()] || "Unknown Error")
    }
}
export class HandleApiErrors {
    static BinanceError = BinanceError
}
