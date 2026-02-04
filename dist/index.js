#!/usr/bin/env node
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/

;// external "zod"
const external_zod_namespaceObject = require("zod");
;// ./node_modules/@modelcontextprotocol/sdk/dist/esm/types.js

const LATEST_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOL_VERSIONS = [
    LATEST_PROTOCOL_VERSION,
    "2025-03-26",
    "2024-11-05",
    "2024-10-07",
];
/* JSON-RPC types */
const JSONRPC_VERSION = "2.0";
/**
 * A progress token, used to associate progress notifications with the original request.
 */
const ProgressTokenSchema = external_zod_namespaceObject.z.union([external_zod_namespaceObject.z.string(), external_zod_namespaceObject.z.number().int()]);
/**
 * An opaque token used to represent a cursor for pagination.
 */
const CursorSchema = external_zod_namespaceObject.z.string();
const RequestMetaSchema = external_zod_namespaceObject.z
    .object({
    /**
     * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
     */
    progressToken: external_zod_namespaceObject.z.optional(ProgressTokenSchema),
})
    .passthrough();
const BaseRequestParamsSchema = external_zod_namespaceObject.z
    .object({
    _meta: external_zod_namespaceObject.z.optional(RequestMetaSchema),
})
    .passthrough();
const RequestSchema = external_zod_namespaceObject.z.object({
    method: external_zod_namespaceObject.z.string(),
    params: external_zod_namespaceObject.z.optional(BaseRequestParamsSchema),
});
const BaseNotificationParamsSchema = external_zod_namespaceObject.z
    .object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
const NotificationSchema = external_zod_namespaceObject.z.object({
    method: external_zod_namespaceObject.z.string(),
    params: external_zod_namespaceObject.z.optional(BaseNotificationParamsSchema),
});
const ResultSchema = external_zod_namespaceObject.z
    .object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
/**
 * A uniquely identifying ID for a request in JSON-RPC.
 */
const RequestIdSchema = external_zod_namespaceObject.z.union([external_zod_namespaceObject.z.string(), external_zod_namespaceObject.z.number().int()]);
/**
 * A request that expects a response.
 */
const JSONRPCRequestSchema = external_zod_namespaceObject.z
    .object({
    jsonrpc: external_zod_namespaceObject.z.literal(JSONRPC_VERSION),
    id: RequestIdSchema,
})
    .merge(RequestSchema)
    .strict();
const isJSONRPCRequest = (value) => JSONRPCRequestSchema.safeParse(value).success;
/**
 * A notification which does not expect a response.
 */
const JSONRPCNotificationSchema = external_zod_namespaceObject.z
    .object({
    jsonrpc: external_zod_namespaceObject.z.literal(JSONRPC_VERSION),
})
    .merge(NotificationSchema)
    .strict();
const isJSONRPCNotification = (value) => JSONRPCNotificationSchema.safeParse(value).success;
/**
 * A successful (non-error) response to a request.
 */
const JSONRPCResponseSchema = external_zod_namespaceObject.z
    .object({
    jsonrpc: external_zod_namespaceObject.z.literal(JSONRPC_VERSION),
    id: RequestIdSchema,
    result: ResultSchema,
})
    .strict();
const isJSONRPCResponse = (value) => JSONRPCResponseSchema.safeParse(value).success;
/**
 * Error codes defined by the JSON-RPC specification.
 */
var ErrorCode;
(function (ErrorCode) {
    // SDK error codes
    ErrorCode[ErrorCode["ConnectionClosed"] = -32000] = "ConnectionClosed";
    ErrorCode[ErrorCode["RequestTimeout"] = -32001] = "RequestTimeout";
    // Standard JSON-RPC error codes
    ErrorCode[ErrorCode["ParseError"] = -32700] = "ParseError";
    ErrorCode[ErrorCode["InvalidRequest"] = -32600] = "InvalidRequest";
    ErrorCode[ErrorCode["MethodNotFound"] = -32601] = "MethodNotFound";
    ErrorCode[ErrorCode["InvalidParams"] = -32602] = "InvalidParams";
    ErrorCode[ErrorCode["InternalError"] = -32603] = "InternalError";
})(ErrorCode || (ErrorCode = {}));
/**
 * A response to a request that indicates an error occurred.
 */
const JSONRPCErrorSchema = external_zod_namespaceObject.z
    .object({
    jsonrpc: external_zod_namespaceObject.z.literal(JSONRPC_VERSION),
    id: RequestIdSchema,
    error: external_zod_namespaceObject.z.object({
        /**
         * The error type that occurred.
         */
        code: external_zod_namespaceObject.z.number().int(),
        /**
         * A short description of the error. The message SHOULD be limited to a concise single sentence.
         */
        message: external_zod_namespaceObject.z.string(),
        /**
         * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
         */
        data: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.unknown()),
    }),
})
    .strict();
const isJSONRPCError = (value) => JSONRPCErrorSchema.safeParse(value).success;
const JSONRPCMessageSchema = external_zod_namespaceObject.z.union([
    JSONRPCRequestSchema,
    JSONRPCNotificationSchema,
    JSONRPCResponseSchema,
    JSONRPCErrorSchema,
]);
/* Empty result */
/**
 * A response that indicates success but carries no data.
 */
const EmptyResultSchema = ResultSchema.strict();
/* Cancellation */
/**
 * This notification can be sent by either side to indicate that it is cancelling a previously-issued request.
 *
 * The request SHOULD still be in-flight, but due to communication latency, it is always possible that this notification MAY arrive after the request has already finished.
 *
 * This notification indicates that the result will be unused, so any associated processing SHOULD cease.
 *
 * A client MUST NOT attempt to cancel its `initialize` request.
 */
const CancelledNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/cancelled"),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The ID of the request to cancel.
         *
         * This MUST correspond to the ID of a request previously issued in the same direction.
         */
        requestId: RequestIdSchema,
        /**
         * An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
         */
        reason: external_zod_namespaceObject.z.string().optional(),
    }),
});
/* Base Metadata */
/**
 * Base metadata interface for common properties across resources, tools, prompts, and implementations.
 */
const BaseMetadataSchema = external_zod_namespaceObject.z
    .object({
    /** Intended for programmatic or logical use, but used as a display name in past specs or fallback */
    name: external_zod_namespaceObject.z.string(),
    /**
    * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
    * even by those unfamiliar with domain-specific terminology.
    *
    * If not provided, the name should be used for display (except for Tool,
    * where `annotations.title` should be given precedence over using `name`,
    * if present).
    */
    title: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
})
    .passthrough();
/* Initialization */
/**
 * Describes the name and version of an MCP implementation.
 */
const ImplementationSchema = BaseMetadataSchema.extend({
    version: external_zod_namespaceObject.z.string(),
});
/**
 * Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
 */
const ClientCapabilitiesSchema = external_zod_namespaceObject.z
    .object({
    /**
     * Experimental, non-standard capabilities that the client supports.
     */
    experimental: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
    /**
     * Present if the client supports sampling from an LLM.
     */
    sampling: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
    /**
     * Present if the client supports eliciting user input.
     */
    elicitation: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
    /**
     * Present if the client supports listing roots.
     */
    roots: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z
        .object({
        /**
         * Whether the client supports issuing notifications for changes to the roots list.
         */
        listChanged: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    })
        .passthrough()),
})
    .passthrough();
/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 */
const InitializeRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("initialize"),
    params: BaseRequestParamsSchema.extend({
        /**
         * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
         */
        protocolVersion: external_zod_namespaceObject.z.string(),
        capabilities: ClientCapabilitiesSchema,
        clientInfo: ImplementationSchema,
    }),
});
const isInitializeRequest = (value) => InitializeRequestSchema.safeParse(value).success;
/**
 * Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
 */
const ServerCapabilitiesSchema = external_zod_namespaceObject.z
    .object({
    /**
     * Experimental, non-standard capabilities that the server supports.
     */
    experimental: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
    /**
     * Present if the server supports sending log messages to the client.
     */
    logging: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
    /**
     * Present if the server supports sending completions to the client.
     */
    completions: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
    /**
     * Present if the server offers any prompt templates.
     */
    prompts: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z
        .object({
        /**
         * Whether this server supports issuing notifications for changes to the prompt list.
         */
        listChanged: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    })
        .passthrough()),
    /**
     * Present if the server offers any resources to read.
     */
    resources: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z
        .object({
        /**
         * Whether this server supports clients subscribing to resource updates.
         */
        subscribe: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
        /**
         * Whether this server supports issuing notifications for changes to the resource list.
         */
        listChanged: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    })
        .passthrough()),
    /**
     * Present if the server offers any tools to call.
     */
    tools: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z
        .object({
        /**
         * Whether this server supports issuing notifications for changes to the tool list.
         */
        listChanged: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    })
        .passthrough()),
})
    .passthrough();
/**
 * After receiving an initialize request from the client, the server sends this response.
 */
const InitializeResultSchema = ResultSchema.extend({
    /**
     * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
     */
    protocolVersion: external_zod_namespaceObject.z.string(),
    capabilities: ServerCapabilitiesSchema,
    serverInfo: ImplementationSchema,
    /**
     * Instructions describing how to use the server and its features.
     *
     * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
     */
    instructions: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
});
/**
 * This notification is sent from the client to the server after initialization has finished.
 */
const InitializedNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/initialized"),
});
const isInitializedNotification = (value) => InitializedNotificationSchema.safeParse(value).success;
/* Ping */
/**
 * A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.
 */
const PingRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("ping"),
});
/* Progress notifications */
const ProgressSchema = external_zod_namespaceObject.z
    .object({
    /**
     * The progress thus far. This should increase every time progress is made, even if the total is unknown.
     */
    progress: external_zod_namespaceObject.z.number(),
    /**
     * Total number of items to process (or total progress required), if known.
     */
    total: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number()),
    /**
     * An optional message describing the current progress.
     */
    message: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
})
    .passthrough();
/**
 * An out-of-band notification used to inform the receiver of a progress update for a long-running request.
 */
const ProgressNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/progress"),
    params: BaseNotificationParamsSchema.merge(ProgressSchema).extend({
        /**
         * The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
         */
        progressToken: ProgressTokenSchema,
    }),
});
/* Pagination */
const PaginatedRequestSchema = RequestSchema.extend({
    params: BaseRequestParamsSchema.extend({
        /**
         * An opaque token representing the current pagination position.
         * If provided, the server should return results starting after this cursor.
         */
        cursor: external_zod_namespaceObject.z.optional(CursorSchema),
    }).optional(),
});
const PaginatedResultSchema = ResultSchema.extend({
    /**
     * An opaque token representing the pagination position after the last returned result.
     * If present, there may be more results available.
     */
    nextCursor: external_zod_namespaceObject.z.optional(CursorSchema),
});
/* Resources */
/**
 * The contents of a specific resource or sub-resource.
 */
const ResourceContentsSchema = external_zod_namespaceObject.z
    .object({
    /**
     * The URI of this resource.
     */
    uri: external_zod_namespaceObject.z.string(),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
const TextResourceContentsSchema = ResourceContentsSchema.extend({
    /**
     * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
     */
    text: external_zod_namespaceObject.z.string(),
});
const BlobResourceContentsSchema = ResourceContentsSchema.extend({
    /**
     * A base64-encoded string representing the binary data of the item.
     */
    blob: external_zod_namespaceObject.z.string().base64(),
});
/**
 * A known resource that the server is capable of reading.
 */
const ResourceSchema = BaseMetadataSchema.extend({
    /**
     * The URI of this resource.
     */
    uri: external_zod_namespaceObject.z.string(),
    /**
     * A description of what this resource represents.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
});
/**
 * A template description for resources available on the server.
 */
const ResourceTemplateSchema = BaseMetadataSchema.extend({
    /**
     * A URI template (according to RFC 6570) that can be used to construct resource URIs.
     */
    uriTemplate: external_zod_namespaceObject.z.string(),
    /**
     * A description of what this template is for.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
     */
    mimeType: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
});
/**
 * Sent from the client to request a list of resources the server has.
 */
const ListResourcesRequestSchema = PaginatedRequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("resources/list"),
});
/**
 * The server's response to a resources/list request from the client.
 */
const ListResourcesResultSchema = PaginatedResultSchema.extend({
    resources: external_zod_namespaceObject.z.array(ResourceSchema),
});
/**
 * Sent from the client to request a list of resource templates the server has.
 */
const ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("resources/templates/list"),
});
/**
 * The server's response to a resources/templates/list request from the client.
 */
const ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({
    resourceTemplates: external_zod_namespaceObject.z.array(ResourceTemplateSchema),
});
/**
 * Sent from the client to the server, to read a specific resource URI.
 */
const ReadResourceRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("resources/read"),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: external_zod_namespaceObject.z.string(),
    }),
});
/**
 * The server's response to a resources/read request from the client.
 */
const ReadResourceResultSchema = ResultSchema.extend({
    contents: external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.union([TextResourceContentsSchema, BlobResourceContentsSchema])),
});
/**
 * An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.
 */
const ResourceListChangedNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/resources/list_changed"),
});
/**
 * Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.
 */
const SubscribeRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("resources/subscribe"),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: external_zod_namespaceObject.z.string(),
    }),
});
/**
 * Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.
 */
const UnsubscribeRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("resources/unsubscribe"),
    params: BaseRequestParamsSchema.extend({
        /**
         * The URI of the resource to unsubscribe from.
         */
        uri: external_zod_namespaceObject.z.string(),
    }),
});
/**
 * A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.
 */
const ResourceUpdatedNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/resources/updated"),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
         */
        uri: external_zod_namespaceObject.z.string(),
    }),
});
/* Prompts */
/**
 * Describes an argument that a prompt can accept.
 */
const PromptArgumentSchema = external_zod_namespaceObject.z
    .object({
    /**
     * The name of the argument.
     */
    name: external_zod_namespaceObject.z.string(),
    /**
     * A human-readable description of the argument.
     */
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * Whether this argument must be provided.
     */
    required: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
})
    .passthrough();
/**
 * A prompt or prompt template that the server offers.
 */
const PromptSchema = BaseMetadataSchema.extend({
    /**
     * An optional description of what this prompt provides
     */
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * A list of arguments to use for templating the prompt.
     */
    arguments: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.array(PromptArgumentSchema)),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
});
/**
 * Sent from the client to request a list of prompts and prompt templates the server has.
 */
const ListPromptsRequestSchema = PaginatedRequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("prompts/list"),
});
/**
 * The server's response to a prompts/list request from the client.
 */
const ListPromptsResultSchema = PaginatedResultSchema.extend({
    prompts: external_zod_namespaceObject.z.array(PromptSchema),
});
/**
 * Used by the client to get a prompt provided by the server.
 */
const GetPromptRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("prompts/get"),
    params: BaseRequestParamsSchema.extend({
        /**
         * The name of the prompt or prompt template.
         */
        name: external_zod_namespaceObject.z.string(),
        /**
         * Arguments to use for templating the prompt.
         */
        arguments: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.record(external_zod_namespaceObject.z.string())),
    }),
});
/**
 * Text provided to or from an LLM.
 */
const TextContentSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("text"),
    /**
     * The text content of the message.
     */
    text: external_zod_namespaceObject.z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
/**
 * An image provided to or from an LLM.
 */
const ImageContentSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("image"),
    /**
     * The base64-encoded image data.
     */
    data: external_zod_namespaceObject.z.string().base64(),
    /**
     * The MIME type of the image. Different providers may support different image types.
     */
    mimeType: external_zod_namespaceObject.z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
/**
 * An Audio provided to or from an LLM.
 */
const AudioContentSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("audio"),
    /**
     * The base64-encoded audio data.
     */
    data: external_zod_namespaceObject.z.string().base64(),
    /**
     * The MIME type of the audio. Different providers may support different audio types.
     */
    mimeType: external_zod_namespaceObject.z.string(),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
/**
 * The contents of a resource, embedded into a prompt or tool call result.
 */
const EmbeddedResourceSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("resource"),
    resource: external_zod_namespaceObject.z.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 *
 * Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.
 */
const ResourceLinkSchema = ResourceSchema.extend({
    type: external_zod_namespaceObject.z.literal("resource_link"),
});
/**
 * A content block that can be used in prompts and tool results.
 */
const ContentBlockSchema = external_zod_namespaceObject.z.union([
    TextContentSchema,
    ImageContentSchema,
    AudioContentSchema,
    ResourceLinkSchema,
    EmbeddedResourceSchema,
]);
/**
 * Describes a message returned as part of a prompt.
 */
const PromptMessageSchema = external_zod_namespaceObject.z
    .object({
    role: external_zod_namespaceObject.z.enum(["user", "assistant"]),
    content: ContentBlockSchema,
})
    .passthrough();
/**
 * The server's response to a prompts/get request from the client.
 */
const GetPromptResultSchema = ResultSchema.extend({
    /**
     * An optional description for the prompt.
     */
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    messages: external_zod_namespaceObject.z.array(PromptMessageSchema),
});
/**
 * An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
const PromptListChangedNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/prompts/list_changed"),
});
/* Tools */
/**
 * Additional properties describing a Tool to clients.
 *
 * NOTE: all properties in ToolAnnotations are **hints**.
 * They are not guaranteed to provide a faithful description of
 * tool behavior (including descriptive properties like `title`).
 *
 * Clients should never make tool use decisions based on ToolAnnotations
 * received from untrusted servers.
 */
const ToolAnnotationsSchema = external_zod_namespaceObject.z
    .object({
    /**
     * A human-readable title for the tool.
     */
    title: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * If true, the tool does not modify its environment.
     *
     * Default: false
     */
    readOnlyHint: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    /**
     * If true, the tool may perform destructive updates to its environment.
     * If false, the tool performs only additive updates.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: true
     */
    destructiveHint: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    /**
     * If true, calling the tool repeatedly with the same arguments
     * will have no additional effect on the its environment.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: false
     */
    idempotentHint: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    /**
     * If true, this tool may interact with an "open world" of external
     * entities. If false, the tool's domain of interaction is closed.
     * For example, the world of a web search tool is open, whereas that
     * of a memory tool is not.
     *
     * Default: true
     */
    openWorldHint: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
})
    .passthrough();
/**
 * Definition for a tool the client can call.
 */
const ToolSchema = BaseMetadataSchema.extend({
    /**
     * A human-readable description of the tool.
     */
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * A JSON Schema object defining the expected parameters for the tool.
     */
    inputSchema: external_zod_namespaceObject.z
        .object({
        type: external_zod_namespaceObject.z.literal("object"),
        properties: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
        required: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.string())),
    })
        .passthrough(),
    /**
     * An optional JSON Schema object defining the structure of the tool's output returned in
     * the structuredContent field of a CallToolResult.
     */
    outputSchema: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({
        type: external_zod_namespaceObject.z.literal("object"),
        properties: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
        required: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.string())),
    })
        .passthrough()),
    /**
     * Optional additional tool information.
     */
    annotations: external_zod_namespaceObject.z.optional(ToolAnnotationsSchema),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
});
/**
 * Sent from the client to request a list of tools the server has.
 */
const ListToolsRequestSchema = PaginatedRequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("tools/list"),
});
/**
 * The server's response to a tools/list request from the client.
 */
const ListToolsResultSchema = PaginatedResultSchema.extend({
    tools: external_zod_namespaceObject.z.array(ToolSchema),
});
/**
 * The server's response to a tool call.
 */
const CallToolResultSchema = ResultSchema.extend({
    /**
     * A list of content objects that represent the result of the tool call.
     *
     * If the Tool does not define an outputSchema, this field MUST be present in the result.
     * For backwards compatibility, this field is always present, but it may be empty.
     */
    content: external_zod_namespaceObject.z.array(ContentBlockSchema).default([]),
    /**
     * An object containing structured tool output.
     *
     * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
     */
    structuredContent: external_zod_namespaceObject.z.object({}).passthrough().optional(),
    /**
     * Whether the tool call ended in an error.
     *
     * If not set, this is assumed to be false (the call was successful).
     *
     * Any errors that originate from the tool SHOULD be reported inside the result
     * object, with `isError` set to true, _not_ as an MCP protocol-level error
     * response. Otherwise, the LLM would not be able to see that an error occurred
     * and self-correct.
     *
     * However, any errors in _finding_ the tool, an error indicating that the
     * server does not support tool calls, or any other exceptional conditions,
     * should be reported as an MCP error response.
     */
    isError: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
});
/**
 * CallToolResultSchema extended with backwards compatibility to protocol version 2024-10-07.
 */
const CompatibilityCallToolResultSchema = CallToolResultSchema.or(ResultSchema.extend({
    toolResult: external_zod_namespaceObject.z.unknown(),
}));
/**
 * Used by the client to invoke a tool provided by the server.
 */
const CallToolRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("tools/call"),
    params: BaseRequestParamsSchema.extend({
        name: external_zod_namespaceObject.z.string(),
        arguments: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.record(external_zod_namespaceObject.z.unknown())),
    }),
});
/**
 * An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
const ToolListChangedNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/tools/list_changed"),
});
/* Logging */
/**
 * The severity of a log message.
 */
const LoggingLevelSchema = external_zod_namespaceObject.z.enum([
    "debug",
    "info",
    "notice",
    "warning",
    "error",
    "critical",
    "alert",
    "emergency",
]);
/**
 * A request from the client to the server, to enable or adjust logging.
 */
const SetLevelRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("logging/setLevel"),
    params: BaseRequestParamsSchema.extend({
        /**
         * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
         */
        level: LoggingLevelSchema,
    }),
});
/**
 * Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.
 */
const LoggingMessageNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/message"),
    params: BaseNotificationParamsSchema.extend({
        /**
         * The severity of this log message.
         */
        level: LoggingLevelSchema,
        /**
         * An optional name of the logger issuing this message.
         */
        logger: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
        /**
         * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
         */
        data: external_zod_namespaceObject.z.unknown(),
    }),
});
/* Sampling */
/**
 * Hints to use for model selection.
 */
const ModelHintSchema = external_zod_namespaceObject.z
    .object({
    /**
     * A hint for a model name.
     */
    name: external_zod_namespaceObject.z.string().optional(),
})
    .passthrough();
/**
 * The server's preferences for model selection, requested of the client during sampling.
 */
const ModelPreferencesSchema = external_zod_namespaceObject.z
    .object({
    /**
     * Optional hints to use for model selection.
     */
    hints: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.array(ModelHintSchema)),
    /**
     * How much to prioritize cost when selecting a model.
     */
    costPriority: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number().min(0).max(1)),
    /**
     * How much to prioritize sampling speed (latency) when selecting a model.
     */
    speedPriority: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number().min(0).max(1)),
    /**
     * How much to prioritize intelligence and capabilities when selecting a model.
     */
    intelligencePriority: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number().min(0).max(1)),
})
    .passthrough();
/**
 * Describes a message issued to or received from an LLM API.
 */
const SamplingMessageSchema = external_zod_namespaceObject.z
    .object({
    role: external_zod_namespaceObject.z.enum(["user", "assistant"]),
    content: external_zod_namespaceObject.z.union([TextContentSchema, ImageContentSchema, AudioContentSchema]),
})
    .passthrough();
/**
 * A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.
 */
const CreateMessageRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("sampling/createMessage"),
    params: BaseRequestParamsSchema.extend({
        messages: external_zod_namespaceObject.z.array(SamplingMessageSchema),
        /**
         * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
         */
        systemPrompt: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
        /**
         * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
         */
        includeContext: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.enum(["none", "thisServer", "allServers"])),
        temperature: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number()),
        /**
         * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
         */
        maxTokens: external_zod_namespaceObject.z.number().int(),
        stopSequences: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.string())),
        /**
         * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
         */
        metadata: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
        /**
         * The server's preferences for which model to select.
         */
        modelPreferences: external_zod_namespaceObject.z.optional(ModelPreferencesSchema),
    }),
});
/**
 * The client's response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.
 */
const CreateMessageResultSchema = ResultSchema.extend({
    /**
     * The name of the model that generated the message.
     */
    model: external_zod_namespaceObject.z.string(),
    /**
     * The reason why sampling stopped.
     */
    stopReason: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.enum(["endTurn", "stopSequence", "maxTokens"]).or(external_zod_namespaceObject.z.string())),
    role: external_zod_namespaceObject.z.enum(["user", "assistant"]),
    content: external_zod_namespaceObject.z.discriminatedUnion("type", [
        TextContentSchema,
        ImageContentSchema,
        AudioContentSchema
    ]),
});
/* Elicitation */
/**
 * Primitive schema definition for boolean fields.
 */
const BooleanSchemaSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("boolean"),
    title: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    default: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
})
    .passthrough();
/**
 * Primitive schema definition for string fields.
 */
const StringSchemaSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("string"),
    title: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    minLength: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number()),
    maxLength: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number()),
    format: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.enum(["email", "uri", "date", "date-time"])),
})
    .passthrough();
/**
 * Primitive schema definition for number fields.
 */
const NumberSchemaSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.enum(["number", "integer"]),
    title: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    minimum: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number()),
    maximum: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number()),
})
    .passthrough();
/**
 * Primitive schema definition for enum fields.
 */
const EnumSchemaSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("string"),
    title: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    description: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    enum: external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.string()),
    enumNames: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.string())),
})
    .passthrough();
/**
 * Union of all primitive schema definitions.
 */
const PrimitiveSchemaDefinitionSchema = external_zod_namespaceObject.z.union([
    BooleanSchemaSchema,
    StringSchemaSchema,
    NumberSchemaSchema,
    EnumSchemaSchema,
]);
/**
 * A request from the server to elicit user input via the client.
 * The client should present the message and form fields to the user.
 */
const ElicitRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("elicitation/create"),
    params: BaseRequestParamsSchema.extend({
        /**
         * The message to present to the user.
         */
        message: external_zod_namespaceObject.z.string(),
        /**
         * The schema for the requested user input.
         */
        requestedSchema: external_zod_namespaceObject.z
            .object({
            type: external_zod_namespaceObject.z.literal("object"),
            properties: external_zod_namespaceObject.z.record(external_zod_namespaceObject.z.string(), PrimitiveSchemaDefinitionSchema),
            required: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.string())),
        })
            .passthrough(),
    }),
});
/**
 * The client's response to an elicitation/create request from the server.
 */
const ElicitResultSchema = ResultSchema.extend({
    /**
     * The user's response action.
     */
    action: external_zod_namespaceObject.z.enum(["accept", "decline", "cancel"]),
    /**
     * The collected user input content (only present if action is "accept").
     */
    content: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.record(external_zod_namespaceObject.z.string(), external_zod_namespaceObject.z.unknown())),
});
/* Autocomplete */
/**
 * A reference to a resource or resource template definition.
 */
const ResourceTemplateReferenceSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("ref/resource"),
    /**
     * The URI or URI template of the resource.
     */
    uri: external_zod_namespaceObject.z.string(),
})
    .passthrough();
/**
 * @deprecated Use ResourceTemplateReferenceSchema instead
 */
const ResourceReferenceSchema = (/* unused pure expression or super */ null && (ResourceTemplateReferenceSchema));
/**
 * Identifies a prompt.
 */
const PromptReferenceSchema = external_zod_namespaceObject.z
    .object({
    type: external_zod_namespaceObject.z.literal("ref/prompt"),
    /**
     * The name of the prompt or prompt template
     */
    name: external_zod_namespaceObject.z.string(),
})
    .passthrough();
/**
 * A request from the client to the server, to ask for completion options.
 */
const CompleteRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("completion/complete"),
    params: BaseRequestParamsSchema.extend({
        ref: external_zod_namespaceObject.z.union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
        /**
         * The argument's information
         */
        argument: external_zod_namespaceObject.z
            .object({
            /**
             * The name of the argument
             */
            name: external_zod_namespaceObject.z.string(),
            /**
             * The value of the argument to use for completion matching.
             */
            value: external_zod_namespaceObject.z.string(),
        })
            .passthrough(),
        context: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({
            /**
             * Previously-resolved variables in a URI template or prompt.
             */
            arguments: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.record(external_zod_namespaceObject.z.string(), external_zod_namespaceObject.z.string())),
        })),
    }),
});
/**
 * The server's response to a completion/complete request
 */
const CompleteResultSchema = ResultSchema.extend({
    completion: external_zod_namespaceObject.z
        .object({
        /**
         * An array of completion values. Must not exceed 100 items.
         */
        values: external_zod_namespaceObject.z.array(external_zod_namespaceObject.z.string()).max(100),
        /**
         * The total number of completion options available. This can exceed the number of values actually sent in the response.
         */
        total: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.number().int()),
        /**
         * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
         */
        hasMore: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.boolean()),
    })
        .passthrough(),
});
/* Roots */
/**
 * Represents a root directory or file that the server can operate on.
 */
const RootSchema = external_zod_namespaceObject.z
    .object({
    /**
     * The URI identifying the root. This *must* start with file:// for now.
     */
    uri: external_zod_namespaceObject.z.string().startsWith("file://"),
    /**
     * An optional name for the root.
     */
    name: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.string()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: external_zod_namespaceObject.z.optional(external_zod_namespaceObject.z.object({}).passthrough()),
})
    .passthrough();
/**
 * Sent from the server to request a list of root URIs from the client.
 */
const ListRootsRequestSchema = RequestSchema.extend({
    method: external_zod_namespaceObject.z.literal("roots/list"),
});
/**
 * The client's response to a roots/list request from the server.
 */
const ListRootsResultSchema = ResultSchema.extend({
    roots: external_zod_namespaceObject.z.array(RootSchema),
});
/**
 * A notification from the client to the server, informing it that the list of roots has changed.
 */
const RootsListChangedNotificationSchema = NotificationSchema.extend({
    method: external_zod_namespaceObject.z.literal("notifications/roots/list_changed"),
});
/* Client messages */
const ClientRequestSchema = external_zod_namespaceObject.z.union([
    PingRequestSchema,
    InitializeRequestSchema,
    CompleteRequestSchema,
    SetLevelRequestSchema,
    GetPromptRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ReadResourceRequestSchema,
    SubscribeRequestSchema,
    UnsubscribeRequestSchema,
    CallToolRequestSchema,
    ListToolsRequestSchema,
]);
const ClientNotificationSchema = external_zod_namespaceObject.z.union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    InitializedNotificationSchema,
    RootsListChangedNotificationSchema,
]);
const ClientResultSchema = external_zod_namespaceObject.z.union([
    EmptyResultSchema,
    CreateMessageResultSchema,
    ElicitResultSchema,
    ListRootsResultSchema,
]);
/* Server messages */
const ServerRequestSchema = external_zod_namespaceObject.z.union([
    PingRequestSchema,
    CreateMessageRequestSchema,
    ElicitRequestSchema,
    ListRootsRequestSchema,
]);
const ServerNotificationSchema = external_zod_namespaceObject.z.union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    LoggingMessageNotificationSchema,
    ResourceUpdatedNotificationSchema,
    ResourceListChangedNotificationSchema,
    ToolListChangedNotificationSchema,
    PromptListChangedNotificationSchema,
]);
const ServerResultSchema = external_zod_namespaceObject.z.union([
    EmptyResultSchema,
    InitializeResultSchema,
    CompleteResultSchema,
    GetPromptResultSchema,
    ListPromptsResultSchema,
    ListResourcesResultSchema,
    ListResourceTemplatesResultSchema,
    ReadResourceResultSchema,
    CallToolResultSchema,
    ListToolsResultSchema,
]);
class McpError extends Error {
    constructor(code, message, data) {
        super(`MCP error ${code}: ${message}`);
        this.code = code;
        this.data = data;
        this.name = "McpError";
    }
}
//# sourceMappingURL=types.js.map
;// ./node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js

/**
 * The default request timeout, in miliseconds.
 */
const DEFAULT_REQUEST_TIMEOUT_MSEC = 60000;
/**
 * Implements MCP protocol framing on top of a pluggable transport, including
 * features like request/response linking, notifications, and progress.
 */
class Protocol {
    constructor(_options) {
        this._options = _options;
        this._requestMessageId = 0;
        this._requestHandlers = new Map();
        this._requestHandlerAbortControllers = new Map();
        this._notificationHandlers = new Map();
        this._responseHandlers = new Map();
        this._progressHandlers = new Map();
        this._timeoutInfo = new Map();
        this._pendingDebouncedNotifications = new Set();
        this.setNotificationHandler(CancelledNotificationSchema, (notification) => {
            const controller = this._requestHandlerAbortControllers.get(notification.params.requestId);
            controller === null || controller === void 0 ? void 0 : controller.abort(notification.params.reason);
        });
        this.setNotificationHandler(ProgressNotificationSchema, (notification) => {
            this._onprogress(notification);
        });
        this.setRequestHandler(PingRequestSchema, 
        // Automatic pong by default.
        (_request) => ({}));
    }
    _setupTimeout(messageId, timeout, maxTotalTimeout, onTimeout, resetTimeoutOnProgress = false) {
        this._timeoutInfo.set(messageId, {
            timeoutId: setTimeout(onTimeout, timeout),
            startTime: Date.now(),
            timeout,
            maxTotalTimeout,
            resetTimeoutOnProgress,
            onTimeout
        });
    }
    _resetTimeout(messageId) {
        const info = this._timeoutInfo.get(messageId);
        if (!info)
            return false;
        const totalElapsed = Date.now() - info.startTime;
        if (info.maxTotalTimeout && totalElapsed >= info.maxTotalTimeout) {
            this._timeoutInfo.delete(messageId);
            throw new McpError(ErrorCode.RequestTimeout, "Maximum total timeout exceeded", { maxTotalTimeout: info.maxTotalTimeout, totalElapsed });
        }
        clearTimeout(info.timeoutId);
        info.timeoutId = setTimeout(info.onTimeout, info.timeout);
        return true;
    }
    _cleanupTimeout(messageId) {
        const info = this._timeoutInfo.get(messageId);
        if (info) {
            clearTimeout(info.timeoutId);
            this._timeoutInfo.delete(messageId);
        }
    }
    /**
     * Attaches to the given transport, starts it, and starts listening for messages.
     *
     * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
     */
    async connect(transport) {
        var _a, _b, _c;
        this._transport = transport;
        const _onclose = (_a = this.transport) === null || _a === void 0 ? void 0 : _a.onclose;
        this._transport.onclose = () => {
            _onclose === null || _onclose === void 0 ? void 0 : _onclose();
            this._onclose();
        };
        const _onerror = (_b = this.transport) === null || _b === void 0 ? void 0 : _b.onerror;
        this._transport.onerror = (error) => {
            _onerror === null || _onerror === void 0 ? void 0 : _onerror(error);
            this._onerror(error);
        };
        const _onmessage = (_c = this._transport) === null || _c === void 0 ? void 0 : _c.onmessage;
        this._transport.onmessage = (message, extra) => {
            _onmessage === null || _onmessage === void 0 ? void 0 : _onmessage(message, extra);
            if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
                this._onresponse(message);
            }
            else if (isJSONRPCRequest(message)) {
                this._onrequest(message, extra);
            }
            else if (isJSONRPCNotification(message)) {
                this._onnotification(message);
            }
            else {
                this._onerror(new Error(`Unknown message type: ${JSON.stringify(message)}`));
            }
        };
        await this._transport.start();
    }
    _onclose() {
        var _a;
        const responseHandlers = this._responseHandlers;
        this._responseHandlers = new Map();
        this._progressHandlers.clear();
        this._pendingDebouncedNotifications.clear();
        this._transport = undefined;
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
        const error = new McpError(ErrorCode.ConnectionClosed, "Connection closed");
        for (const handler of responseHandlers.values()) {
            handler(error);
        }
    }
    _onerror(error) {
        var _a;
        (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
    }
    _onnotification(notification) {
        var _a;
        const handler = (_a = this._notificationHandlers.get(notification.method)) !== null && _a !== void 0 ? _a : this.fallbackNotificationHandler;
        // Ignore notifications not being subscribed to.
        if (handler === undefined) {
            return;
        }
        // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
        Promise.resolve()
            .then(() => handler(notification))
            .catch((error) => this._onerror(new Error(`Uncaught error in notification handler: ${error}`)));
    }
    _onrequest(request, extra) {
        var _a, _b, _c, _d;
        const handler = (_a = this._requestHandlers.get(request.method)) !== null && _a !== void 0 ? _a : this.fallbackRequestHandler;
        if (handler === undefined) {
            (_b = this._transport) === null || _b === void 0 ? void 0 : _b.send({
                jsonrpc: "2.0",
                id: request.id,
                error: {
                    code: ErrorCode.MethodNotFound,
                    message: "Method not found",
                },
            }).catch((error) => this._onerror(new Error(`Failed to send an error response: ${error}`)));
            return;
        }
        const abortController = new AbortController();
        this._requestHandlerAbortControllers.set(request.id, abortController);
        const fullExtra = {
            signal: abortController.signal,
            sessionId: (_c = this._transport) === null || _c === void 0 ? void 0 : _c.sessionId,
            _meta: (_d = request.params) === null || _d === void 0 ? void 0 : _d._meta,
            sendNotification: (notification) => this.notification(notification, { relatedRequestId: request.id }),
            sendRequest: (r, resultSchema, options) => this.request(r, resultSchema, { ...options, relatedRequestId: request.id }),
            authInfo: extra === null || extra === void 0 ? void 0 : extra.authInfo,
            requestId: request.id,
            requestInfo: extra === null || extra === void 0 ? void 0 : extra.requestInfo
        };
        // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
        Promise.resolve()
            .then(() => handler(request, fullExtra))
            .then((result) => {
            var _a;
            if (abortController.signal.aborted) {
                return;
            }
            return (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                result,
                jsonrpc: "2.0",
                id: request.id,
            });
        }, (error) => {
            var _a, _b;
            if (abortController.signal.aborted) {
                return;
            }
            return (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                jsonrpc: "2.0",
                id: request.id,
                error: {
                    code: Number.isSafeInteger(error["code"])
                        ? error["code"]
                        : ErrorCode.InternalError,
                    message: (_b = error.message) !== null && _b !== void 0 ? _b : "Internal error",
                },
            });
        })
            .catch((error) => this._onerror(new Error(`Failed to send response: ${error}`)))
            .finally(() => {
            this._requestHandlerAbortControllers.delete(request.id);
        });
    }
    _onprogress(notification) {
        const { progressToken, ...params } = notification.params;
        const messageId = Number(progressToken);
        const handler = this._progressHandlers.get(messageId);
        if (!handler) {
            this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(notification)}`));
            return;
        }
        const responseHandler = this._responseHandlers.get(messageId);
        const timeoutInfo = this._timeoutInfo.get(messageId);
        if (timeoutInfo && responseHandler && timeoutInfo.resetTimeoutOnProgress) {
            try {
                this._resetTimeout(messageId);
            }
            catch (error) {
                responseHandler(error);
                return;
            }
        }
        handler(params);
    }
    _onresponse(response) {
        const messageId = Number(response.id);
        const handler = this._responseHandlers.get(messageId);
        if (handler === undefined) {
            this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(response)}`));
            return;
        }
        this._responseHandlers.delete(messageId);
        this._progressHandlers.delete(messageId);
        this._cleanupTimeout(messageId);
        if (isJSONRPCResponse(response)) {
            handler(response);
        }
        else {
            const error = new McpError(response.error.code, response.error.message, response.error.data);
            handler(error);
        }
    }
    get transport() {
        return this._transport;
    }
    /**
     * Closes the connection.
     */
    async close() {
        var _a;
        await ((_a = this._transport) === null || _a === void 0 ? void 0 : _a.close());
    }
    /**
     * Sends a request and wait for a response.
     *
     * Do not use this method to emit notifications! Use notification() instead.
     */
    request(request, resultSchema, options) {
        const { relatedRequestId, resumptionToken, onresumptiontoken } = options !== null && options !== void 0 ? options : {};
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d, _e, _f;
            if (!this._transport) {
                reject(new Error("Not connected"));
                return;
            }
            if (((_a = this._options) === null || _a === void 0 ? void 0 : _a.enforceStrictCapabilities) === true) {
                this.assertCapabilityForMethod(request.method);
            }
            (_b = options === null || options === void 0 ? void 0 : options.signal) === null || _b === void 0 ? void 0 : _b.throwIfAborted();
            const messageId = this._requestMessageId++;
            const jsonrpcRequest = {
                ...request,
                jsonrpc: "2.0",
                id: messageId,
            };
            if (options === null || options === void 0 ? void 0 : options.onprogress) {
                this._progressHandlers.set(messageId, options.onprogress);
                jsonrpcRequest.params = {
                    ...request.params,
                    _meta: {
                        ...(((_c = request.params) === null || _c === void 0 ? void 0 : _c._meta) || {}),
                        progressToken: messageId
                    },
                };
            }
            const cancel = (reason) => {
                var _a;
                this._responseHandlers.delete(messageId);
                this._progressHandlers.delete(messageId);
                this._cleanupTimeout(messageId);
                (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                    jsonrpc: "2.0",
                    method: "notifications/cancelled",
                    params: {
                        requestId: messageId,
                        reason: String(reason),
                    },
                }, { relatedRequestId, resumptionToken, onresumptiontoken }).catch((error) => this._onerror(new Error(`Failed to send cancellation: ${error}`)));
                reject(reason);
            };
            this._responseHandlers.set(messageId, (response) => {
                var _a;
                if ((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                    return;
                }
                if (response instanceof Error) {
                    return reject(response);
                }
                try {
                    const result = resultSchema.parse(response.result);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
            (_d = options === null || options === void 0 ? void 0 : options.signal) === null || _d === void 0 ? void 0 : _d.addEventListener("abort", () => {
                var _a;
                cancel((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.reason);
            });
            const timeout = (_e = options === null || options === void 0 ? void 0 : options.timeout) !== null && _e !== void 0 ? _e : DEFAULT_REQUEST_TIMEOUT_MSEC;
            const timeoutHandler = () => cancel(new McpError(ErrorCode.RequestTimeout, "Request timed out", { timeout }));
            this._setupTimeout(messageId, timeout, options === null || options === void 0 ? void 0 : options.maxTotalTimeout, timeoutHandler, (_f = options === null || options === void 0 ? void 0 : options.resetTimeoutOnProgress) !== null && _f !== void 0 ? _f : false);
            this._transport.send(jsonrpcRequest, { relatedRequestId, resumptionToken, onresumptiontoken }).catch((error) => {
                this._cleanupTimeout(messageId);
                reject(error);
            });
        });
    }
    /**
     * Emits a notification, which is a one-way message that does not expect a response.
     */
    async notification(notification, options) {
        var _a, _b;
        if (!this._transport) {
            throw new Error("Not connected");
        }
        this.assertNotificationCapability(notification.method);
        const debouncedMethods = (_b = (_a = this._options) === null || _a === void 0 ? void 0 : _a.debouncedNotificationMethods) !== null && _b !== void 0 ? _b : [];
        // A notification can only be debounced if it's in the list AND it's "simple"
        // (i.e., has no parameters and no related request ID that could be lost).
        const canDebounce = debouncedMethods.includes(notification.method)
            && !notification.params
            && !(options === null || options === void 0 ? void 0 : options.relatedRequestId);
        if (canDebounce) {
            // If a notification of this type is already scheduled, do nothing.
            if (this._pendingDebouncedNotifications.has(notification.method)) {
                return;
            }
            // Mark this notification type as pending.
            this._pendingDebouncedNotifications.add(notification.method);
            // Schedule the actual send to happen in the next microtask.
            // This allows all synchronous calls in the current event loop tick to be coalesced.
            Promise.resolve().then(() => {
                var _a;
                // Un-mark the notification so the next one can be scheduled.
                this._pendingDebouncedNotifications.delete(notification.method);
                // SAFETY CHECK: If the connection was closed while this was pending, abort.
                if (!this._transport) {
                    return;
                }
                const jsonrpcNotification = {
                    ...notification,
                    jsonrpc: "2.0",
                };
                // Send the notification, but don't await it here to avoid blocking.
                // Handle potential errors with a .catch().
                (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send(jsonrpcNotification, options).catch(error => this._onerror(error));
            });
            // Return immediately.
            return;
        }
        const jsonrpcNotification = {
            ...notification,
            jsonrpc: "2.0",
        };
        await this._transport.send(jsonrpcNotification, options);
    }
    /**
     * Registers a handler to invoke when this protocol object receives a request with the given method.
     *
     * Note that this will replace any previous request handler for the same method.
     */
    setRequestHandler(requestSchema, handler) {
        const method = requestSchema.shape.method.value;
        this.assertRequestHandlerCapability(method);
        this._requestHandlers.set(method, (request, extra) => {
            return Promise.resolve(handler(requestSchema.parse(request), extra));
        });
    }
    /**
     * Removes the request handler for the given method.
     */
    removeRequestHandler(method) {
        this._requestHandlers.delete(method);
    }
    /**
     * Asserts that a request handler has not already been set for the given method, in preparation for a new one being automatically installed.
     */
    assertCanSetRequestHandler(method) {
        if (this._requestHandlers.has(method)) {
            throw new Error(`A request handler for ${method} already exists, which would be overridden`);
        }
    }
    /**
     * Registers a handler to invoke when this protocol object receives a notification with the given method.
     *
     * Note that this will replace any previous notification handler for the same method.
     */
    setNotificationHandler(notificationSchema, handler) {
        this._notificationHandlers.set(notificationSchema.shape.method.value, (notification) => Promise.resolve(handler(notificationSchema.parse(notification))));
    }
    /**
     * Removes the notification handler for the given method.
     */
    removeNotificationHandler(method) {
        this._notificationHandlers.delete(method);
    }
}
function mergeCapabilities(base, additional) {
    return Object.entries(additional).reduce((acc, [key, value]) => {
        if (value && typeof value === "object") {
            acc[key] = acc[key] ? { ...acc[key], ...value } : value;
        }
        else {
            acc[key] = value;
        }
        return acc;
    }, { ...base });
}
//# sourceMappingURL=protocol.js.map
;// external "ajv"
const external_ajv_namespaceObject = require("ajv");
;// ./node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js



/**
 * An MCP server on top of a pluggable transport.
 *
 * This server will automatically respond to the initialization flow as initiated from the client.
 *
 * To use with custom types, extend the base Request/Notification/Result types and pass them as type parameters:
 *
 * ```typescript
 * // Custom schemas
 * const CustomRequestSchema = RequestSchema.extend({...})
 * const CustomNotificationSchema = NotificationSchema.extend({...})
 * const CustomResultSchema = ResultSchema.extend({...})
 *
 * // Type aliases
 * type CustomRequest = z.infer<typeof CustomRequestSchema>
 * type CustomNotification = z.infer<typeof CustomNotificationSchema>
 * type CustomResult = z.infer<typeof CustomResultSchema>
 *
 * // Create typed server
 * const server = new Server<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomServer",
 *   version: "1.0.0"
 * })
 * ```
 */
class Server extends Protocol {
    /**
     * Initializes this server with the given name and version information.
     */
    constructor(_serverInfo, options) {
        var _a;
        super(options);
        this._serverInfo = _serverInfo;
        this._capabilities = (_a = options === null || options === void 0 ? void 0 : options.capabilities) !== null && _a !== void 0 ? _a : {};
        this._instructions = options === null || options === void 0 ? void 0 : options.instructions;
        this.setRequestHandler(InitializeRequestSchema, (request) => this._oninitialize(request));
        this.setNotificationHandler(InitializedNotificationSchema, () => { var _a; return (_a = this.oninitialized) === null || _a === void 0 ? void 0 : _a.call(this); });
    }
    /**
     * Registers new capabilities. This can only be called before connecting to a transport.
     *
     * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
     */
    registerCapabilities(capabilities) {
        if (this.transport) {
            throw new Error("Cannot register capabilities after connecting to transport");
        }
        this._capabilities = mergeCapabilities(this._capabilities, capabilities);
    }
    assertCapabilityForMethod(method) {
        var _a, _b, _c;
        switch (method) {
            case "sampling/createMessage":
                if (!((_a = this._clientCapabilities) === null || _a === void 0 ? void 0 : _a.sampling)) {
                    throw new Error(`Client does not support sampling (required for ${method})`);
                }
                break;
            case "elicitation/create":
                if (!((_b = this._clientCapabilities) === null || _b === void 0 ? void 0 : _b.elicitation)) {
                    throw new Error(`Client does not support elicitation (required for ${method})`);
                }
                break;
            case "roots/list":
                if (!((_c = this._clientCapabilities) === null || _c === void 0 ? void 0 : _c.roots)) {
                    throw new Error(`Client does not support listing roots (required for ${method})`);
                }
                break;
            case "ping":
                // No specific capability required for ping
                break;
        }
    }
    assertNotificationCapability(method) {
        switch (method) {
            case "notifications/message":
                if (!this._capabilities.logging) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;
            case "notifications/resources/updated":
            case "notifications/resources/list_changed":
                if (!this._capabilities.resources) {
                    throw new Error(`Server does not support notifying about resources (required for ${method})`);
                }
                break;
            case "notifications/tools/list_changed":
                if (!this._capabilities.tools) {
                    throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
                }
                break;
            case "notifications/prompts/list_changed":
                if (!this._capabilities.prompts) {
                    throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
                }
                break;
            case "notifications/cancelled":
                // Cancellation notifications are always allowed
                break;
            case "notifications/progress":
                // Progress notifications are always allowed
                break;
        }
    }
    assertRequestHandlerCapability(method) {
        switch (method) {
            case "sampling/createMessage":
                if (!this._capabilities.sampling) {
                    throw new Error(`Server does not support sampling (required for ${method})`);
                }
                break;
            case "logging/setLevel":
                if (!this._capabilities.logging) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;
            case "prompts/get":
            case "prompts/list":
                if (!this._capabilities.prompts) {
                    throw new Error(`Server does not support prompts (required for ${method})`);
                }
                break;
            case "resources/list":
            case "resources/templates/list":
            case "resources/read":
                if (!this._capabilities.resources) {
                    throw new Error(`Server does not support resources (required for ${method})`);
                }
                break;
            case "tools/call":
            case "tools/list":
                if (!this._capabilities.tools) {
                    throw new Error(`Server does not support tools (required for ${method})`);
                }
                break;
            case "ping":
            case "initialize":
                // No specific capability required for these methods
                break;
        }
    }
    async _oninitialize(request) {
        const requestedVersion = request.params.protocolVersion;
        this._clientCapabilities = request.params.capabilities;
        this._clientVersion = request.params.clientInfo;
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
            ? requestedVersion
            : LATEST_PROTOCOL_VERSION;
        return {
            protocolVersion,
            capabilities: this.getCapabilities(),
            serverInfo: this._serverInfo,
            ...(this._instructions && { instructions: this._instructions }),
        };
    }
    /**
     * After initialization has completed, this will be populated with the client's reported capabilities.
     */
    getClientCapabilities() {
        return this._clientCapabilities;
    }
    /**
     * After initialization has completed, this will be populated with information about the client's name and version.
     */
    getClientVersion() {
        return this._clientVersion;
    }
    getCapabilities() {
        return this._capabilities;
    }
    async ping() {
        return this.request({ method: "ping" }, EmptyResultSchema);
    }
    async createMessage(params, options) {
        return this.request({ method: "sampling/createMessage", params }, CreateMessageResultSchema, options);
    }
    async elicitInput(params, options) {
        const result = await this.request({ method: "elicitation/create", params }, ElicitResultSchema, options);
        // Validate the response content against the requested schema if action is "accept"
        if (result.action === "accept" && result.content) {
            try {
                const ajv = new external_ajv_namespaceObject();
                const validate = ajv.compile(params.requestedSchema);
                const isValid = validate(result.content);
                if (!isValid) {
                    throw new McpError(ErrorCode.InvalidParams, `Elicitation response content does not match requested schema: ${ajv.errorsText(validate.errors)}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Error validating elicitation response: ${error}`);
            }
        }
        return result;
    }
    async listRoots(params, options) {
        return this.request({ method: "roots/list", params }, ListRootsResultSchema, options);
    }
    async sendLoggingMessage(params) {
        return this.notification({ method: "notifications/message", params });
    }
    async sendResourceUpdated(params) {
        return this.notification({
            method: "notifications/resources/updated",
            params,
        });
    }
    async sendResourceListChanged() {
        return this.notification({
            method: "notifications/resources/list_changed",
        });
    }
    async sendToolListChanged() {
        return this.notification({ method: "notifications/tools/list_changed" });
    }
    async sendPromptListChanged() {
        return this.notification({ method: "notifications/prompts/list_changed" });
    }
}
//# sourceMappingURL=index.js.map
;// external "node:process"
const external_node_process_namespaceObject = require("node:process");
;// ./node_modules/@modelcontextprotocol/sdk/dist/esm/shared/stdio.js

/**
 * Buffers a continuous stdio stream into discrete JSON-RPC messages.
 */
class ReadBuffer {
    append(chunk) {
        this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
    }
    readMessage() {
        if (!this._buffer) {
            return null;
        }
        const index = this._buffer.indexOf("\n");
        if (index === -1) {
            return null;
        }
        const line = this._buffer.toString("utf8", 0, index).replace(/\r$/, '');
        this._buffer = this._buffer.subarray(index + 1);
        return deserializeMessage(line);
    }
    clear() {
        this._buffer = undefined;
    }
}
function deserializeMessage(line) {
    return JSONRPCMessageSchema.parse(JSON.parse(line));
}
function serializeMessage(message) {
    return JSON.stringify(message) + "\n";
}
//# sourceMappingURL=stdio.js.map
;// ./node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js


/**
 * Server transport for stdio: this communicates with a MCP client by reading from the current process' stdin and writing to stdout.
 *
 * This transport is only available in Node.js environments.
 */
class StdioServerTransport {
    constructor(_stdin = external_node_process_namespaceObject.stdin, _stdout = external_node_process_namespaceObject.stdout) {
        this._stdin = _stdin;
        this._stdout = _stdout;
        this._readBuffer = new ReadBuffer();
        this._started = false;
        // Arrow functions to bind `this` properly, while maintaining function identity.
        this._ondata = (chunk) => {
            this._readBuffer.append(chunk);
            this.processReadBuffer();
        };
        this._onerror = (error) => {
            var _a;
            (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
        };
    }
    /**
     * Starts listening for messages on stdin.
     */
    async start() {
        if (this._started) {
            throw new Error("StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");
        }
        this._started = true;
        this._stdin.on("data", this._ondata);
        this._stdin.on("error", this._onerror);
    }
    processReadBuffer() {
        var _a, _b;
        while (true) {
            try {
                const message = this._readBuffer.readMessage();
                if (message === null) {
                    break;
                }
                (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, message);
            }
            catch (error) {
                (_b = this.onerror) === null || _b === void 0 ? void 0 : _b.call(this, error);
            }
        }
    }
    async close() {
        var _a;
        // Remove our event listeners first
        this._stdin.off("data", this._ondata);
        this._stdin.off("error", this._onerror);
        // Check if we were the only data listener
        const remainingDataListeners = this._stdin.listenerCount('data');
        if (remainingDataListeners === 0) {
            // Only pause stdin if we were the only listener
            // This prevents interfering with other parts of the application that might be using stdin
            this._stdin.pause();
        }
        // Clear the buffer and notify closure
        this._readBuffer.clear();
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    send(message) {
        return new Promise((resolve) => {
            const json = serializeMessage(message);
            if (this._stdout.write(json)) {
                resolve();
            }
            else {
                this._stdout.once("drain", resolve);
            }
        });
    }
}
//# sourceMappingURL=stdio.js.map
;// external "zod-to-json-schema"
const external_zod_to_json_schema_namespaceObject = require("zod-to-json-schema");
;// ./src/schemas.ts

// Command arguments schema for better type safety and documentation
const CommandArgsSchema = external_zod_namespaceObject.z
    .object({
    selector: external_zod_namespaceObject.z
        .string()
        .optional()
        .describe('CSS selector for targeting elements (required for click_by_selector, click_button)'),
    text: external_zod_namespaceObject.z
        .string()
        .optional()
        .describe('Text content for searching or keyboard input (required for click_by_text, send_keyboard_shortcut)'),
    value: external_zod_namespaceObject.z
        .string()
        .optional()
        .describe('Value to input into form fields (required for fill_input)'),
    placeholder: external_zod_namespaceObject.z
        .string()
        .optional()
        .describe('Placeholder text to identify input fields (alternative to selector for fill_input)'),
    message: external_zod_namespaceObject.z.string().optional().describe('Message or content for specific commands'),
    code: external_zod_namespaceObject.z.string().optional().describe('JavaScript code to execute (for eval command)'),
})
    .describe('Command-specific arguments. Structure depends on the command being executed.');
// Schema definitions for tool inputs
const SendCommandToElectronSchema = external_zod_namespaceObject.z.object({
    command: external_zod_namespaceObject.z.string().describe('Command to send to the Electron process'),
    args: CommandArgsSchema.optional().describe('Arguments for the command - must be an object with appropriate properties based on the command type'),
    targetId: external_zod_namespaceObject.z
        .string()
        .optional()
        .describe('CDP target ID to send the command to a specific window (exact match)'),
    windowTitle: external_zod_namespaceObject.z
        .string()
        .optional()
        .describe('Window title to target (case-insensitive partial match). Use list_electron_windows to see available windows.'),
});
const TakeScreenshotSchema = external_zod_namespaceObject.z.object({
    outputPath: external_zod_namespaceObject.z
        .string()
        .optional()
        .describe('Path to save the screenshot (optional, defaults to temp directory)'),
    windowTitle: external_zod_namespaceObject.z.string().optional().describe('Specific window title to screenshot (optional)'),
});
const ReadElectronLogsSchema = external_zod_namespaceObject.z.object({
    logType: external_zod_namespaceObject.z
        .enum(['console', 'main', 'renderer', 'all'])
        .optional()
        .describe('Type of logs to read'),
    lines: external_zod_namespaceObject.z.number().optional().describe('Number of recent lines to read (default: 100)'),
    follow: external_zod_namespaceObject.z.boolean().optional().describe('Whether to follow/tail the logs'),
});
const GetElectronWindowInfoSchema = external_zod_namespaceObject.z.object({
    includeChildren: external_zod_namespaceObject.z.boolean().optional().describe('Include child windows information'),
});
const ListElectronWindowsSchema = external_zod_namespaceObject.z.object({
    includeDevTools: external_zod_namespaceObject.z
        .boolean()
        .optional()
        .describe('Include DevTools windows in the list (default: false)'),
});

;// ./src/tools.ts


// Tool name enumeration
var ToolName;
(function (ToolName) {
    ToolName["SEND_COMMAND_TO_ELECTRON"] = "send_command_to_electron";
    ToolName["TAKE_SCREENSHOT"] = "take_screenshot";
    ToolName["READ_ELECTRON_LOGS"] = "read_electron_logs";
    ToolName["GET_ELECTRON_WINDOW_INFO"] = "get_electron_window_info";
    ToolName["LIST_ELECTRON_WINDOWS"] = "list_electron_windows";
})(ToolName || (ToolName = {}));
// Define tools available to the MCP server
const tools = [
    {
        name: ToolName.GET_ELECTRON_WINDOW_INFO,
        description: 'Get information about running Electron applications and their windows. Automatically detects any Electron app with remote debugging enabled (port 9222).',
        inputSchema: (0,external_zod_to_json_schema_namespaceObject.zodToJsonSchema)(GetElectronWindowInfoSchema),
    },
    {
        name: ToolName.TAKE_SCREENSHOT,
        description: 'Take a screenshot of any running Electron application window. Returns base64 image data for AI analysis. No files created unless outputPath is specified.',
        inputSchema: (0,external_zod_to_json_schema_namespaceObject.zodToJsonSchema)(TakeScreenshotSchema),
    },
    {
        name: ToolName.SEND_COMMAND_TO_ELECTRON,
        description: `Send JavaScript commands to any running Electron application via Chrome DevTools Protocol. 

Enhanced UI interaction commands:
- 'find_elements': Analyze all interactive elements (buttons, inputs, selects) with their properties
- 'click_by_text': Click elements by their visible text, aria-label, or title
- 'click_by_selector': Securely click elements by CSS selector
- 'fill_input': Fill input fields by selector, placeholder text, or associated label
- 'select_option': Select dropdown options by value or text
- 'send_keyboard_shortcut': Send keyboard shortcuts like 'Ctrl+N', 'Meta+N', 'Enter', 'Escape'
- 'navigate_to_hash': Safely navigate to hash routes (e.g., '#create', '#settings')
- 'get_page_structure': Get organized overview of page elements (buttons, inputs, selects, links)
- 'debug_elements': Get debugging info about buttons and form elements on the page
- 'verify_form_state': Check current form state and validation status
- 'get_title', 'get_url', 'get_body_text': Basic page information
- 'eval': Execute custom JavaScript code with enhanced error reporting

IMPORTANT: Arguments must be passed as an object with the correct properties:

Examples:
- click_by_selector: {"selector": "button.submit-btn"}
- click_by_text: {"text": "Submit"}
- fill_input: {"placeholder": "Enter name", "value": "John Doe"}
- fill_input: {"selector": "#email", "value": "user@example.com"}
- send_keyboard_shortcut: {"text": "Enter"}
- eval: {"code": "document.title"}

Use 'get_page_structure' or 'debug_elements' first to understand available elements, then use specific interaction commands.

Multi-window support:
- targetId: Specify a CDP target ID to send commands to a specific window (exact match)
- windowTitle: Specify a window title to target (case-insensitive partial match)
- If neither is specified, commands are sent to the first available main window (backward compatible)
- Use 'list_electron_windows' to see available windows and their IDs`,
        inputSchema: (0,external_zod_to_json_schema_namespaceObject.zodToJsonSchema)(SendCommandToElectronSchema),
    },
    {
        name: ToolName.LIST_ELECTRON_WINDOWS,
        description: "List all available Electron window targets across all detected applications. Returns window IDs, titles, URLs, and ports. Use the returned IDs with send_command_to_electron's targetId parameter to target specific windows.",
        inputSchema: (0,external_zod_to_json_schema_namespaceObject.zodToJsonSchema)(ListElectronWindowsSchema),
    },
    {
        name: ToolName.READ_ELECTRON_LOGS,
        description: 'Read console logs and output from running Electron applications. Useful for debugging and monitoring app behavior.',
        inputSchema: (0,external_zod_to_json_schema_namespaceObject.zodToJsonSchema)(ReadElectronLogsSchema),
    },
];

;// external "ws"
const external_ws_namespaceObject = require("ws");
var external_ws_default = /*#__PURE__*/__webpack_require__.n(external_ws_namespaceObject);
;// external "child_process"
const external_child_process_namespaceObject = require("child_process");
;// external "util"
const external_util_namespaceObject = require("util");
;// ./src/utils/logger.ts
/* eslint-disable no-console */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
class Logger {
    static instance;
    level;
    constructor(level = LogLevel.INFO) {
        this.level = level;
    }
    static getInstance() {
        if (!Logger.instance) {
            // Check environment variable for log level
            const envLevel = process.env.MCP_LOG_LEVEL?.toUpperCase();
            let level = LogLevel.WARN;
            switch (envLevel) {
                case 'ERROR':
                    level = LogLevel.ERROR;
                    break;
                case 'WARN':
                    level = LogLevel.WARN;
                    break;
                case 'INFO':
                    level = LogLevel.INFO;
                    break;
                case 'DEBUG':
                    level = LogLevel.DEBUG;
                    break;
            }
            Logger.instance = new Logger(level);
        }
        return Logger.instance;
    }
    setLevel(level) {
        this.level = level;
    }
    error(message, ...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(`[MCP] ERROR: ${message}`, ...args);
        }
    }
    warn(message, ...args) {
        if (this.level >= LogLevel.WARN) {
            console.error(`[MCP] WARN: ${message}`, ...args);
        }
    }
    info(message, ...args) {
        if (this.level >= LogLevel.INFO) {
            console.error(`[MCP] INFO: ${message}`, ...args);
        }
    }
    debug(message, ...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.error(`[MCP] DEBUG: ${message}`, ...args);
        }
    }
    // Helper method to check if a certain level is enabled
    isEnabled(level) {
        return this.level >= level;
    }
}
// Export singleton instance
const logger = Logger.getInstance();

;// ./src/utils/electron-discovery.ts



/**
 * Scan for running Electron applications with DevTools enabled
 */
async function scanForElectronApps() {
    logger.debug('Scanning for running Electron applications...');
    // Extended port range to include test apps and common custom ports
    const commonPorts = [
        9222,
        9223,
        9224,
        9225, // Default ports
        9200,
        9201,
        9202,
        9203,
        9204,
        9205, // Security test range
        9300,
        9301,
        9302,
        9303,
        9304,
        9305, // Integration test range
        9400,
        9401,
        9402,
        9403,
        9404,
        9405, // Additional range
    ];
    const foundApps = [];
    for (const port of commonPorts) {
        try {
            const response = await fetch(`http://localhost:${port}/json`, {
                signal: AbortSignal.timeout(1000),
            });
            if (response.ok) {
                const targets = await response.json();
                const pageTargets = targets.filter((target) => target.type === 'page');
                if (pageTargets.length > 0) {
                    foundApps.push({
                        port,
                        targets: pageTargets,
                    });
                    logger.debug(`Found Electron app on port ${port} with ${pageTargets.length} windows`);
                }
            }
        }
        catch {
            // Continue to next port
        }
    }
    return foundApps;
}
/**
 * Get detailed process information for running Electron applications
 */
async function getElectronProcessInfo() {
    const execAsync = (0,external_util_namespaceObject.promisify)(external_child_process_namespaceObject.exec);
    try {
        const { stdout } = await execAsync("ps aux | grep -i electron | grep -v grep | grep -v 'Visual Studio Code'");
        const electronProcesses = stdout
            .trim()
            .split('\n')
            .filter((line) => line.includes('electron'))
            .map((line) => {
            const parts = line.trim().split(/\s+/);
            return {
                pid: parts[1],
                cpu: parts[2],
                memory: parts[3],
                command: parts.slice(10).join(' '),
            };
        });
        return { electronProcesses };
    }
    catch (error) {
        logger.debug('Could not get process info:', error);
        return {};
    }
}
/**
 * Find the main target from a list of targets
 */
function findMainTarget(targets) {
    return (targets.find((target) => target.type === 'page' && !target.title.includes('DevTools')) ||
        targets.find((target) => target.type === 'page'));
}
/**
 * List all available Electron window targets across all detected apps.
 * @param includeDevTools - Whether to include DevTools windows (default: false)
 * @returns Array of window targets with id, title, url, port, and type
 */
async function listElectronWindows(includeDevTools = false) {
    const foundApps = await scanForElectronApps();
    const windows = [];
    for (const app of foundApps) {
        for (const target of app.targets) {
            // Filter out DevTools windows unless explicitly requested
            if (!includeDevTools && target.url && target.url.startsWith('devtools://')) {
                continue;
            }
            windows.push({
                id: target.id,
                title: target.title || '',
                url: target.url || '',
                port: app.port,
                type: target.type || 'page',
            });
        }
    }
    return windows;
}
/**
 * Get window information from any running Electron app
 */
async function getElectronWindowInfo(includeChildren = false) {
    try {
        const foundApps = await scanForElectronApps();
        if (foundApps.length === 0) {
            return {
                platform: process.platform,
                windows: [],
                totalTargets: 0,
                electronTargets: 0,
                message: 'No Electron applications found with remote debugging enabled',
                automationReady: false,
            };
        }
        // Use the first found app
        const app = foundApps[0];
        const windows = app.targets.map((target) => ({
            id: target.id,
            title: target.title,
            url: target.url,
            type: target.type,
            description: target.description || '',
            webSocketDebuggerUrl: target.webSocketDebuggerUrl,
        }));
        // Get additional process information
        const processInfo = await getElectronProcessInfo();
        return {
            platform: process.platform,
            devToolsPort: app.port,
            windows: includeChildren
                ? windows
                : windows.filter((w) => !w.title.includes('DevTools')),
            totalTargets: windows.length,
            electronTargets: windows.length,
            processInfo,
            message: `Found running Electron application with ${windows.length} windows on port ${app.port}`,
            automationReady: true,
        };
    }
    catch (error) {
        logger.error('Failed to scan for applications:', error);
        return {
            platform: process.platform,
            windows: [],
            totalTargets: 0,
            electronTargets: 0,
            message: `Failed to scan for Electron applications: ${error instanceof Error ? error.message : String(error)}`,
            automationReady: false,
        };
    }
}

;// ./src/utils/electron-connection.ts



/**
 * Find and connect to a running Electron application.
 * @param options - Optional targeting options to select a specific window
 * @returns The DevTools target matching the given options
 * @example
 * findElectronTarget() // first available main window
 * findElectronTarget({ targetId: 'ABC123' }) // exact ID match
 * findElectronTarget({ windowTitle: 'Settings' }) // partial title match
 */
async function findElectronTarget(options) {
    logger.debug('Looking for running Electron applications...');
    const foundApps = await scanForElectronApps();
    if (foundApps.length === 0) {
        throw new Error('No running Electron application found with remote debugging enabled. Start your app with: electron . --remote-debugging-port=9222');
    }
    // If targetId is specified, search all apps for exact ID match
    if (options?.targetId) {
        for (const app of foundApps) {
            const match = app.targets.find((t) => t.id === options.targetId);
            if (match) {
                logger.debug(`Found target by ID "${options.targetId}" on port ${app.port}`);
                return {
                    id: match.id,
                    title: match.title,
                    url: match.url,
                    webSocketDebuggerUrl: match.webSocketDebuggerUrl,
                    type: match.type,
                };
            }
        }
        throw new Error(`No window found with targetId "${options.targetId}". Use list_electron_windows to see available targets.`);
    }
    // If windowTitle is specified, search all apps for case-insensitive partial match
    if (options?.windowTitle) {
        const searchTitle = options.windowTitle.toLowerCase();
        for (const app of foundApps) {
            const match = app.targets.find((t) => t.title && t.title.toLowerCase().includes(searchTitle));
            if (match) {
                logger.debug(`Found target by title "${options.windowTitle}" on port ${app.port}`);
                return {
                    id: match.id,
                    title: match.title,
                    url: match.url,
                    webSocketDebuggerUrl: match.webSocketDebuggerUrl,
                    type: match.type,
                };
            }
        }
        throw new Error(`No window found with title matching "${options.windowTitle}". Use list_electron_windows to see available targets.`);
    }
    // Default: use first app's main target (backward compatible)
    const app = foundApps[0];
    const mainTarget = findMainTarget(app.targets);
    if (!mainTarget) {
        throw new Error('No suitable target found in Electron application');
    }
    logger.debug(`Found Electron app on port ${app.port}: ${mainTarget.title}`);
    return {
        id: mainTarget.id,
        title: mainTarget.title,
        url: mainTarget.url,
        webSocketDebuggerUrl: mainTarget.webSocketDebuggerUrl,
        type: mainTarget.type,
    };
}
/**
 * Execute JavaScript code in an Electron application via Chrome DevTools Protocol
 */
async function executeInElectron(javascriptCode, target) {
    const targetInfo = target || (await findElectronTarget());
    if (!targetInfo.webSocketDebuggerUrl) {
        throw new Error('No WebSocket debugger URL available');
    }
    return new Promise((resolve, reject) => {
        const ws = new (external_ws_default())(targetInfo.webSocketDebuggerUrl);
        const messageId = Math.floor(Math.random() * 1000000);
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Command execution timeout (10s)'));
        }, 10000);
        ws.on('open', () => {
            logger.debug(`Connected to ${targetInfo.title} via WebSocket`);
            // Enable Runtime domain first
            ws.send(JSON.stringify({
                id: 1,
                method: 'Runtime.enable',
            }));
            // Send Runtime.evaluate command
            const message = {
                id: messageId,
                method: 'Runtime.evaluate',
                params: {
                    expression: javascriptCode,
                    returnByValue: true,
                    awaitPromise: false,
                },
            };
            logger.debug(`Executing JavaScript code...`);
            ws.send(JSON.stringify(message));
        });
        ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                // Filter out noisy CDP events to reduce log spam
                const FILTERED_CDP_METHODS = [
                    'Runtime.executionContextCreated',
                    'Runtime.consoleAPICalled',
                    'Console.messageAdded',
                    'Page.frameNavigated',
                    'Page.loadEventFired',
                ];
                // Only log CDP events if debug level is enabled and they're not filtered
                if (logger.isEnabled(3) &&
                    (!response.method || !FILTERED_CDP_METHODS.includes(response.method))) {
                    logger.debug(`CDP Response for message ${messageId}:`, JSON.stringify(response, null, 2));
                }
                if (response.id === messageId) {
                    clearTimeout(timeout);
                    ws.close();
                    if (response.error) {
                        logger.error(`DevTools Protocol error:`, response.error);
                        reject(new Error(`DevTools Protocol error: ${response.error.message}`));
                    }
                    else if (response.result) {
                        const result = response.result.result;
                        logger.debug(`Execution result type: ${result?.type}, value:`, result?.value);
                        if (result.type === 'string') {
                            resolve(`✅ Command executed: ${result.value}`);
                        }
                        else if (result.type === 'number') {
                            resolve(`✅ Result: ${result.value}`);
                        }
                        else if (result.type === 'boolean') {
                            resolve(`✅ Result: ${result.value}`);
                        }
                        else if (result.type === 'undefined') {
                            resolve(`✅ Command executed successfully`);
                        }
                        else if (result.type === 'object') {
                            if (result.value === null) {
                                resolve(`✅ Result: null`);
                            }
                            else if (result.value === undefined) {
                                resolve(`✅ Result: undefined`);
                            }
                            else {
                                try {
                                    resolve(`✅ Result: ${JSON.stringify(result.value, null, 2)}`);
                                }
                                catch {
                                    resolve(`✅ Result: [Object - could not serialize: ${result.className || result.objectId || 'unknown'}]`);
                                }
                            }
                        }
                        else {
                            resolve(`✅ Result type ${result.type}: ${result.description || 'no description'}`);
                        }
                    }
                    else {
                        logger.debug(`No result in response:`, response);
                        resolve(`✅ Command sent successfully`);
                    }
                }
            }
            catch (error) {
                // Only treat parsing errors as warnings, not errors
                logger.warn(`Failed to parse CDP response:`, error);
            }
        });
        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`WebSocket error: ${error.message}`));
        });
    });
}
/**
 * Connect to Electron app for real-time log monitoring
 */
async function connectForLogs(target, onLog) {
    const targetInfo = target || (await findElectronTarget());
    if (!targetInfo.webSocketDebuggerUrl) {
        throw new Error('No WebSocket debugger URL available for log connection');
    }
    return new Promise((resolve, reject) => {
        const ws = new (external_ws_default())(targetInfo.webSocketDebuggerUrl);
        ws.on('open', () => {
            logger.debug(`Connected for log monitoring to: ${targetInfo.title}`);
            // Enable Runtime and Console domains
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
            ws.send(JSON.stringify({ id: 2, method: 'Console.enable' }));
            resolve(ws);
        });
        ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.method === 'Console.messageAdded') {
                    const msg = response.params.message;
                    const timestamp = new Date().toISOString();
                    const logEntry = `[${timestamp}] ${msg.level.toUpperCase()}: ${msg.text}`;
                    onLog?.(logEntry);
                }
                else if (response.method === 'Runtime.consoleAPICalled') {
                    const call = response.params;
                    const timestamp = new Date().toISOString();
                    const args = call.args?.map((arg) => arg.value || arg.description).join(' ') || '';
                    const logEntry = `[${timestamp}] ${call.type.toUpperCase()}: ${args}`;
                    onLog?.(logEntry);
                }
            }
            catch (error) {
                logger.warn(`Failed to parse log message:`, error);
            }
        });
        ws.on('error', (error) => {
            reject(new Error(`WebSocket error: ${error.message}`));
        });
    });
}

;// ./src/utils/electron-commands.ts
/**
 * Enhanced Electron interaction commands for React-based applications
 * Addresses common issues with form interactions, event handling, and state management
 */
/**
 * Securely escape text input for JavaScript code generation
 */
function escapeJavaScriptString(input) {
    // Use JSON.stringify for proper escaping of quotes, newlines, and special characters
    return JSON.stringify(input);
}
/**
 * Validate text input for potential security issues
 */
function validateTextInput(text) {
    const warnings = [];
    let sanitized = text;
    // Check for suspicious patterns
    if (text.includes('javascript:'))
        warnings.push('Contains javascript: protocol');
    if (text.includes('<script'))
        warnings.push('Contains script tags');
    if (text.match(/['"]\s*;\s*/))
        warnings.push('Contains potential code injection');
    if (text.length > 1000)
        warnings.push('Input text is unusually long');
    // Basic sanitization - remove potentially dangerous content
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.substring(0, 1000); // Limit length
    return {
        isValid: warnings.length === 0,
        sanitized,
        warnings,
    };
}
/**
 * Generate the enhanced find_elements command with deep DOM analysis
 */
function generateFindElementsCommand() {
    return `
    (function() {
      // Deep DOM analysis functions
      function analyzeElement(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().substring(0, 100),
          id: el.id || '',
          className: el.className || '',
          name: el.name || '',
          placeholder: el.placeholder || '',
          type: el.type || '',
          value: el.value || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaRole: el.getAttribute('role') || '',
          title: el.title || '',
          href: el.href || '',
          src: el.src || '',
          alt: el.alt || '',
          position: { 
            x: Math.round(rect.left), 
            y: Math.round(rect.top), 
            width: Math.round(rect.width), 
            height: Math.round(rect.height) 
          },
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity > 0,
          isInteractive: isInteractiveElement(el),
          zIndex: parseInt(style.zIndex) || 0,
          backgroundColor: style.backgroundColor,
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          cursor: style.cursor,
          context: getElementContext(el),
          selector: generateSelector(el),
          xpath: generateXPath(el)
        };
      }
      
      function isInteractiveElement(el) {
        const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
        const interactiveTypes = ['button', 'submit', 'reset', 'checkbox', 'radio'];
        const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'option'];
        
        return interactiveTags.includes(el.tagName) ||
               interactiveTypes.includes(el.type) ||
               interactiveRoles.includes(el.getAttribute('role')) ||
               el.hasAttribute('onclick') ||
               el.hasAttribute('onsubmit') ||
               el.getAttribute('contenteditable') === 'true' ||
               getComputedStyle(el).cursor === 'pointer';
      }
      
      function getElementContext(el) {
        const context = [];
        
        // Get form context
        const form = el.closest('form');
        if (form) {
          const formTitle = form.querySelector('h1, h2, h3, h4, h5, h6, .title');
          if (formTitle) context.push('Form: ' + formTitle.textContent.trim().substring(0, 50));
        }
        
        // Get parent container context
        const container = el.closest('section, article, div[class*="container"], div[class*="card"], div[class*="panel"]');
        if (container && container !== form) {
          const heading = container.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading');
          if (heading) context.push('Container: ' + heading.textContent.trim().substring(0, 50));
        }
        
        // Get nearby labels
        const label = findElementLabel(el);
        if (label) context.push('Label: ' + label.substring(0, 50));
        
        return context.join(' | ');
      }
      
      function findElementLabel(el) {
        // For inputs, find associated label
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          if (el.id) {
            const label = document.querySelector(\`label[for="\${el.id}"]\`);
            if (label) return label.textContent.trim();
          }
          
          // Check if nested in label
          const parentLabel = el.closest('label');
          if (parentLabel) return parentLabel.textContent.trim();
          
          // Check aria-labelledby
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            if (labelEl) return labelEl.textContent.trim();
          }
        }
        
        return '';
      }
      
      function generateSelector(el) {
        // Generate a robust CSS selector
        if (el.id) return '#' + el.id;
        
        let selector = el.tagName.toLowerCase();
        
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c && !c.match(/^(ng-|v-|_)/));
          if (classes.length > 0) {
            selector += '.' + classes.slice(0, 3).join('.');
          }
        }
        
        // Add attribute selectors for better specificity
        if (el.name) selector += \`[name="\${el.name}"]\`;
        if (el.type && el.tagName === 'INPUT') selector += \`[type="\${el.type}"]\`;
        if (el.placeholder) selector += \`[placeholder*="\${el.placeholder.substring(0, 20)}"]\`;
        
        return selector;
      }
      
      function generateXPath(el) {
        if (el.id) return \`//*[@id="\${el.id}"]\`;
        
        let path = '';
        let current = el;
        
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          
          if (current.id) {
            path = \`//*[@id="\${current.id}"]\` + path;
            break;
          }
          
          const siblings = Array.from(current.parentNode?.children || []).filter(
            sibling => sibling.tagName === current.tagName
          );
          
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += \`[\${index}]\`;
          }
          
          path = '/' + selector + path;
          current = current.parentElement;
        }
        
        return path || '//body' + path;
      }
      
      // Categorize elements by type
      const analysis = {
        clickable: [],
        inputs: [],
        links: [],
        images: [],
        text: [],
        containers: [],
        metadata: {
          totalElements: 0,
          visibleElements: 0,
          interactiveElements: 0,
          pageTitle: document.title,
          pageUrl: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };
      
      // Analyze all elements
      const allElements = document.querySelectorAll('*');
      analysis.metadata.totalElements = allElements.length;
      
      for (let el of allElements) {
        const elementAnalysis = analyzeElement(el);
        
        if (!elementAnalysis.isVisible) continue;
        analysis.metadata.visibleElements++;
        
        if (elementAnalysis.isInteractive) {
          analysis.metadata.interactiveElements++;
          
          // Categorize clickable elements
          if (['button', 'a', 'input'].includes(elementAnalysis.tag) || 
              ['button', 'submit'].includes(elementAnalysis.type) ||
              elementAnalysis.ariaRole === 'button') {
            analysis.clickable.push(elementAnalysis);
          }
        }
        
        // Categorize inputs
        if (['input', 'textarea', 'select'].includes(elementAnalysis.tag)) {
          analysis.inputs.push(elementAnalysis);
        }
        
        // Categorize links
        if (elementAnalysis.tag === 'a' && elementAnalysis.href) {
          analysis.links.push(elementAnalysis);
        }
        
        // Categorize images
        if (elementAnalysis.tag === 'img') {
          analysis.images.push(elementAnalysis);
        }
        
        // Categorize text elements with significant content
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(elementAnalysis.tag) &&
            elementAnalysis.text.length > 10 && elementAnalysis.text.length < 200) {
          analysis.text.push(elementAnalysis);
        }
        
        // Categorize important containers
        if (['form', 'section', 'article', 'main', 'nav', 'header', 'footer'].includes(elementAnalysis.tag) ||
            elementAnalysis.className.match(/(container|wrapper|card|panel|modal|dialog)/i)) {
          analysis.containers.push(elementAnalysis);
        }
      }
      
      // Limit results to prevent overwhelming output
      const maxResults = 20;
      Object.keys(analysis).forEach(key => {
        if (Array.isArray(analysis[key]) && analysis[key].length > maxResults) {
          analysis[key] = analysis[key].slice(0, maxResults);
        }
      });
      
      return JSON.stringify(analysis, null, 2);
    })()
  `;
}
/**
 * Generate the enhanced click_by_text command with improved element scoring
 */
function generateClickByTextCommand(text) {
    // Validate and sanitize input text
    const validation = validateTextInput(text);
    if (!validation.isValid) {
        return `(function() { return "Security validation failed: ${validation.warnings.join(', ')}"; })()`;
    }
    // Escape the text to prevent JavaScript injection
    const escapedText = escapeJavaScriptString(validation.sanitized);
    return `
    (function() {
      const targetText = ${escapedText};  // Safe: JSON.stringify escapes quotes and special chars
      
      // Deep DOM analysis function
      function analyzeElement(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        
        return {
          element: el,
          text: (el.textContent || '').trim(),
          ariaLabel: el.getAttribute('aria-label') || '',
          title: el.title || '',
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          isInteractive: el.tagName.match(/^(BUTTON|A|INPUT)$/) || el.hasAttribute('onclick') || el.getAttribute('role') === 'button' || style.cursor === 'pointer',
          rect: rect,
          zIndex: parseInt(style.zIndex) || 0,
          opacity: parseFloat(style.opacity) || 1
        };
      }
      
      // Score element relevance
      function scoreElement(analysis, target) {
        let score = 0;
        const text = analysis.text.toLowerCase();
        const label = analysis.ariaLabel.toLowerCase();
        const title = analysis.title.toLowerCase();
        const targetLower = target.toLowerCase();
        
        // Exact match gets highest score
        if (text === targetLower || label === targetLower || title === targetLower) score += 100;
        
        // Starts with target
        if (text.startsWith(targetLower) || label.startsWith(targetLower)) score += 50;
        
        // Contains target
        if (text.includes(targetLower) || label.includes(targetLower) || title.includes(targetLower)) score += 25;
        
        // Fuzzy matching for close matches
        const similarity = Math.max(
          calculateSimilarity(text, targetLower),
          calculateSimilarity(label, targetLower),
          calculateSimilarity(title, targetLower)
        );
        score += similarity * 20;
        
        // Bonus for interactive elements
        if (analysis.isInteractive) score += 10;
        
        // Bonus for visibility
        if (analysis.isVisible) score += 15;
        
        // Bonus for larger elements (more likely to be main buttons)
        if (analysis.rect.width > 100 && analysis.rect.height > 30) score += 5;
        
        // Bonus for higher z-index (on top)
        score += Math.min(analysis.zIndex, 5);
        
        return score;
      }
      
      // Simple string similarity function
      function calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const maxLen = Math.max(len1, len2);
        if (maxLen === 0) return 0;
        
        let matches = 0;
        const minLen = Math.min(len1, len2);
        for (let i = 0; i < minLen; i++) {
          if (str1[i] === str2[i]) matches++;
        }
        return matches / maxLen;
      }
      
      // Find all potentially clickable elements
      const allElements = document.querySelectorAll('*');
      const candidates = [];
      
      for (let el of allElements) {
        const analysis = analyzeElement(el);
        
        if (analysis.isVisible && (analysis.isInteractive || analysis.text || analysis.ariaLabel)) {
          const score = scoreElement(analysis, targetText);
          if (score > 5) { // Only consider elements with some relevance
            candidates.push({ ...analysis, score });
          }
        }
      }
      
      if (candidates.length === 0) {
        return \`No clickable elements found containing text: "\${targetText}"\`;
      }
      
      // Sort by score and get the best match
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      
      // Additional validation before clicking
      if (best.score < 15) {
        return \`Found potential matches but confidence too low (score: \${best.score}). Best match was: "\${best.text || best.ariaLabel}" - try being more specific.\`;
      }
      
      // Enhanced clicking for React components with duplicate prevention
      function clickElement(element) {
        // Enhanced duplicate prevention
        const elementId = element.id || element.className || element.textContent?.slice(0, 20) || 'element';
        const clickKey = 'mcp_click_text_' + btoa(elementId).slice(0, 10);
        
        // Check if this element was recently clicked
        if (window[clickKey] && Date.now() - window[clickKey] < 2000) {
          throw new Error('Element click prevented - too soon after previous click');
        }
        
        // Mark this element as clicked
        window[clickKey] = Date.now();
        
        // Prevent multiple rapid events
        const originalPointerEvents = element.style.pointerEvents;
        element.style.pointerEvents = 'none';
        
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Focus the element if focusable
        try {
          if (element.focus && typeof element.focus === 'function') {
            element.focus();
          }
        } catch (e) {
          // Focus may fail on some elements, that's ok
        }
        
        // Create and dispatch comprehensive click events for React
        const events = [
          new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
          new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        ];
        
        // Dispatch all events - don't treat preventDefault as failure
        events.forEach(event => {
          element.dispatchEvent(event);
        });
        
        // Trigger additional React events if it's a form element
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Re-enable after delay
        setTimeout(() => {
          element.style.pointerEvents = originalPointerEvents;
        }, 1000);
        
        return true;
      }
      
      try {
        const clickResult = clickElement(best.element);
        return \`Successfully clicked element (score: \${best.score}): "\${best.text || best.ariaLabel || best.title}" - searched for: "\${targetText}"\`;
      } catch (error) {
        return \`Failed to click element: \${error.message}. Element found (score: \${best.score}): "\${best.text || best.ariaLabel || best.title}"\`;
      }
    })()
  `;
}

;// ./src/utils/electron-input-commands.ts
/**
 * Enhanced input interaction commands for React-based Electron applications
 * Focuses on proper event handling and React state management
 */
/**
 * Securely escape text input for JavaScript code generation
 */
function electron_input_commands_escapeJavaScriptString(input) {
    return JSON.stringify(input);
}
/**
 * Validate input parameters for security
 */
function validateInputParams(selector, value, searchText) {
    const warnings = [];
    let sanitizedSelector = selector;
    let sanitizedValue = value;
    let sanitizedSearchText = searchText;
    // Validate selector
    if (selector.includes('javascript:'))
        warnings.push('Selector contains javascript: protocol');
    if (selector.includes('<script'))
        warnings.push('Selector contains script tags');
    if (selector.length > 500)
        warnings.push('Selector is unusually long');
    // Validate value
    if (value.includes('<script'))
        warnings.push('Value contains script tags');
    if (value.length > 10000)
        warnings.push('Value is unusually long');
    // Validate search text
    if (searchText.includes('<script'))
        warnings.push('Search text contains script tags');
    if (searchText.length > 1000)
        warnings.push('Search text is unusually long');
    // Basic sanitization
    sanitizedSelector = sanitizedSelector.replace(/javascript:/gi, '').substring(0, 500);
    sanitizedValue = sanitizedValue.replace(/<script[^>]*>.*?<\/script>/gi, '').substring(0, 10000);
    sanitizedSearchText = sanitizedSearchText
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .substring(0, 1000);
    return {
        isValid: warnings.length === 0,
        sanitized: {
            selector: sanitizedSelector,
            value: sanitizedValue,
            searchText: sanitizedSearchText,
        },
        warnings,
    };
}
/**
 * Generate the enhanced fill_input command with React-aware event handling
 */
function generateFillInputCommand(selector, value, searchText) {
    // Validate and sanitize inputs
    const validation = validateInputParams(selector, value, searchText);
    if (!validation.isValid) {
        return `(function() { return "Security validation failed: ${validation.warnings.join(', ')}"; })()`;
    }
    // Escape all inputs to prevent injection
    const escapedSelector = electron_input_commands_escapeJavaScriptString(validation.sanitized.selector);
    const escapedValue = electron_input_commands_escapeJavaScriptString(validation.sanitized.value);
    const escapedSearchText = electron_input_commands_escapeJavaScriptString(validation.sanitized.searchText);
    return `
    (function() {
      const selector = ${escapedSelector};
      const value = ${escapedValue};
      const searchText = ${escapedSearchText};
      
      // Deep form field analysis
      function analyzeInput(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const label = findAssociatedLabel(el);
        
        return {
          element: el,
          type: el.type || el.tagName.toLowerCase(),
          placeholder: el.placeholder || '',
          name: el.name || '',
          id: el.id || '',
          value: el.value || '',
          label: label ? label.textContent.trim() : '',
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaDescribedBy: el.getAttribute('aria-describedby') || '',
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          isEnabled: !el.disabled && !el.readOnly,
          rect: rect,
          context: getInputContext(el)
        };
      }
      
      // Find associated label for an input
      function findAssociatedLabel(input) {
        // Method 1: Label with for attribute
        if (input.id) {
          const label = document.querySelector(\`label[for="\${input.id}"]\`);
          if (label) return label;
        }
        
        // Method 2: Input nested inside label
        let parent = input.parentElement;
        while (parent && parent.tagName !== 'BODY') {
          if (parent.tagName === 'LABEL') return parent;
          parent = parent.parentElement;
        }
        
        // Method 3: aria-labelledby
        const labelledBy = input.getAttribute('aria-labelledby');
        if (labelledBy) {
          const label = document.getElementById(labelledBy);
          if (label) return label;
        }
        
        // Method 4: Look for nearby text elements
        const siblings = Array.from(input.parentElement?.children || []);
        for (let sibling of siblings) {
          if (sibling !== input && sibling.textContent?.trim()) {
            const siblingRect = sibling.getBoundingClientRect();
            const inputRect = input.getBoundingClientRect();
            
            // Check if sibling is close to input (likely a label)
            if (Math.abs(siblingRect.bottom - inputRect.top) < 50 || 
                Math.abs(siblingRect.right - inputRect.left) < 200) {
              return sibling;
            }
          }
        }
        
        return null;
      }
      
      // Get surrounding context for better understanding
      function getInputContext(input) {
        const context = [];
        
        // Get form context
        const form = input.closest('form');
        if (form) {
          const formTitle = form.querySelector('h1, h2, h3, h4, h5, h6');
          if (formTitle) context.push('Form: ' + formTitle.textContent.trim());
        }
        
        // Get fieldset context
        const fieldset = input.closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend) context.push('Fieldset: ' + legend.textContent.trim());
        }
        
        // Get section context
        const section = input.closest('section, div[class*="section"], div[class*="group"]');
        if (section) {
          const heading = section.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading');
          if (heading) context.push('Section: ' + heading.textContent.trim());
        }
        
        return context.join(', ');
      }
      
      // Score input field relevance
      function scoreInput(analysis, target) {
        let score = 0;
        const targetLower = target.toLowerCase();
        
        // Text matching
        const texts = [
          analysis.placeholder,
          analysis.label,
          analysis.ariaLabel,
          analysis.name,
          analysis.id,
          analysis.context
        ].map(t => (t || '').toLowerCase());
        
        for (let text of texts) {
          if (text === targetLower) score += 100;
          else if (text.includes(targetLower)) score += 50;
          else if (targetLower.includes(text) && text.length > 2) score += 30;
        }
        
        // Fuzzy matching
        for (let text of texts) {
          if (text.length > 2) {
            const similarity = calculateSimilarity(text, targetLower);
            score += similarity * 25;
          }
        }
        
        // Bonus for visible and enabled
        if (analysis.isVisible && analysis.isEnabled) score += 20;
        
        // Bonus for text/password/email inputs (more likely to be forms)
        if (['text', 'password', 'email', 'search', 'textarea'].includes(analysis.type)) score += 10;
        
        // Penalty for hidden/system fields
        if (analysis.type === 'hidden' || analysis.name?.includes('csrf')) score -= 50;
        
        return score;
      }
      
      function calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const maxLen = Math.max(len1, len2);
        if (maxLen === 0) return 0;
        
        let matches = 0;
        const minLen = Math.min(len1, len2);
        for (let i = 0; i < minLen; i++) {
          if (str1[i] === str2[i]) matches++;
        }
        return matches / maxLen;
      }
      
      // Enhanced input filling for React components
      function fillInputValue(element, newValue) {
        try {
          // Store original value for comparison
          const originalValue = element.value;
          
          // Scroll into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Focus the element first
          element.focus();
          
          // Wait a moment for focus
          setTimeout(() => {
            // For React components, we need to trigger the right events
            
            // Method 1: Direct value assignment with React events
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            
            // Clear existing content first
            element.select();
            
            if (element.tagName === 'INPUT' && nativeInputValueSetter) {
              nativeInputValueSetter.call(element, newValue);
            } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
              nativeTextAreaValueSetter.call(element, newValue);
            } else {
              element.value = newValue;
            }
            
            // Create and dispatch React-compatible events in proper order
            const events = [
              new Event('focus', { bubbles: true, cancelable: true }),
              new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', ctrlKey: true }), // Ctrl+A
              new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'a', ctrlKey: true }),
              new Event('input', { bubbles: true, cancelable: true }),
              new Event('change', { bubbles: true, cancelable: true }),
              new Event('blur', { bubbles: true, cancelable: true })
            ];
            
            events.forEach((event, index) => {
              setTimeout(() => {
                element.dispatchEvent(event);
              }, index * 50);
            });
            
            // Method 2: Additional React trigger for controlled components
            if (window.React || window._reactInternalInstance || element._reactInternalFiber) {
              setTimeout(() => {
                // Trigger React's internal onChange
                const reactEvent = new Event('input', { bubbles: true });
                Object.defineProperty(reactEvent, 'target', { value: element, writable: false });
                Object.defineProperty(reactEvent, 'currentTarget', { value: element, writable: false });
                element.dispatchEvent(reactEvent);
              }, 300);
            }
            
            // Method 3: Fallback for contenteditable elements
            if (element.contentEditable === 'true') {
              element.textContent = newValue;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Trigger form validation if present
            if (element.form && element.form.checkValidity) {
              setTimeout(() => {
                element.form.checkValidity();
              }, 500);
            }
            
            // Verify the value was set correctly
            setTimeout(() => {
              if (element.value === newValue) {
                console.log('Input value successfully set and verified');
              } else {
                console.warn('Input value verification failed:', element.value, 'vs', newValue);
              }
            }, 600);
            
          }, 100);
          
          return true;
        } catch (error) {
          console.error('Error in fillInputValue:', error);
          return false;
        }
      }
      
      let targetElement = null;
      
      // Method 1: Try by selector first if provided
      if (selector) {
        targetElement = document.querySelector(selector);
        if (targetElement) {
          const analysis = analyzeInput(targetElement);
          if (analysis.isVisible && analysis.isEnabled) {
            // Element found by selector, proceed to fill
          } else {
            targetElement = null; // Reset if not usable
          }
        }
      }
      
      // Method 2: Intelligent search if no selector or selector failed
      if (!targetElement && searchText) {
        const inputs = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
        const candidates = [];
        
        for (let input of inputs) {
          const analysis = analyzeInput(input);
          if (analysis.isVisible && analysis.isEnabled) {
            const score = scoreInput(analysis, searchText);
            if (score > 10) {
              candidates.push({ ...analysis, score });
            }
          }
        }
        
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          targetElement = candidates[0].element;
          
          // Log the decision for debugging
          console.log('Input selection:', {
            searched: searchText,
            found: candidates[0].label || candidates[0].placeholder || candidates[0].name,
            score: candidates[0].score,
            alternatives: candidates.slice(1, 3).map(c => ({
              label: c.label || c.placeholder || c.name,
              score: c.score
            }))
          });
        }
      }
      
      if (!targetElement) {
        return \`No suitable input found for: "\${searchText || selector}". Available inputs: \${
          Array.from(document.querySelectorAll('input, textarea')).map(inp => {
            const analysis = analyzeInput(inp);
            return analysis.label || analysis.placeholder || analysis.name || analysis.type;
          }).filter(Boolean).join(', ')
        }\`;
      }
      
      // Fill the input with enhanced interaction
      try {
        const success = fillInputValue(targetElement, value);
        
        if (success) {
          const analysis = analyzeInput(targetElement);
          return \`Successfully filled input "\${analysis.label || analysis.placeholder || analysis.name || 'unknown'}" with: "\${value}"\`;
        } else {
          return \`Failed to fill input value\`;
        }
      } catch (error) {
        return \`Failed to fill input: \${error.message}\`;
      }
    })()
  `;
}
/**
 * Generate the enhanced select_option command
 */
function generateSelectOptionCommand(selector, value, text) {
    // Validate and sanitize inputs
    const validation = validateInputParams(selector, value, text);
    if (!validation.isValid) {
        return `(function() { return "Security validation failed: ${validation.warnings.join(', ')}"; })()`;
    }
    // Escape all inputs to prevent injection
    const escapedSelector = electron_input_commands_escapeJavaScriptString(validation.sanitized.selector);
    const escapedValue = electron_input_commands_escapeJavaScriptString(validation.sanitized.value);
    const escapedText = electron_input_commands_escapeJavaScriptString(validation.sanitized.searchText);
    return `
    (function() {
      const selector = ${escapedSelector};
      const value = ${escapedValue};
      const text = ${escapedText};
      
      let select = null;
      
      // Try by selector first
      if (selector) {
        select = document.querySelector(selector);
      }
      
      // Try by label text
      if (!select && text) {
        const selects = document.querySelectorAll('select');
        for (let sel of selects) {
          const label = document.querySelector(\`label[for="\${sel.id}"]\`);
          if (label && label.textContent?.toLowerCase().includes(text.toLowerCase())) {
            select = sel;
            break;
          }
        }
      }
      
      if (select) {
        // Try to find option by value or text
        const options = select.querySelectorAll('option');
        for (let option of options) {
          if (option.value === value || option.textContent?.trim().toLowerCase().includes(value.toLowerCase())) {
            select.value = option.value;
            
            // Trigger React-compatible events
            select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            select.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            
            return \`Selected option "\${option.textContent?.trim()}" in select "\${select.name || 'unknown'}"\`;
          }
        }
        return \`Option "\${value}" not found in select\`;
      }
      
      return \`No select found with selector: "\${selector}" or text: "\${text}"\`;
    })()
  `;
}
/**
 * Generate page structure analysis command
 */
function generatePageStructureCommand() {
    return `
    (function() {
      const structure = {
        title: document.title,
        url: window.location.href,
        buttons: [],
        inputs: [],
        selects: [],
        links: [],
        framework: detectFramework()
      };
      
      function detectFramework() {
        if (window.React || document.querySelector('[data-reactroot]')) return 'React';
        if (window.Vue || document.querySelector('[data-v-]')) return 'Vue';
        if (window.angular || document.querySelector('[ng-version]')) return 'Angular';
        return 'Unknown';
      }
      
      // Get buttons with enhanced analysis
      document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          structure.buttons.push({
            text: el.textContent?.trim() || el.value || '',
            id: el.id || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            className: el.className || '',
            type: el.type || 'button',
            disabled: el.disabled,
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      // Get inputs with enhanced analysis
      document.querySelectorAll('input, textarea').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const label = document.querySelector(\`label[for="\${el.id}"]\`);
          structure.inputs.push({
            type: el.type || 'text',
            placeholder: el.placeholder || '',
            label: label?.textContent?.trim() || '',
            id: el.id || '',
            name: el.name || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            value: el.value || '',
            required: el.required,
            disabled: el.disabled,
            readOnly: el.readOnly,
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      // Get selects with enhanced analysis
      document.querySelectorAll('select').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const label = document.querySelector(\`label[for="\${el.id}"]\`);
          const options = Array.from(el.options).map(opt => ({ 
            value: opt.value, 
            text: opt.textContent?.trim(),
            selected: opt.selected 
          }));
          structure.selects.push({
            label: label?.textContent?.trim() || '',
            id: el.id || '',
            name: el.name || '',
            options: options,
            selectedValue: el.value,
            multiple: el.multiple,
            disabled: el.disabled,
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      // Get links with enhanced analysis
      document.querySelectorAll('a[href]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          structure.links.push({
            text: el.textContent?.trim() || '',
            href: el.href,
            id: el.id || '',
            target: el.target || '',
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      return JSON.stringify(structure, null, 2);
    })()
  `;
}

;// ./src/utils/electron-enhanced-commands.ts



/**
 * Enhanced command executor with improved React support.
 * @param command - The command to execute
 * @param args - Command-specific arguments
 * @param windowOptions - Optional window targeting (targetId or windowTitle)
 */
async function sendCommandToElectron(command, args, windowOptions) {
    try {
        const target = await findElectronTarget(windowOptions);
        let javascriptCode;
        switch (command.toLowerCase()) {
            case 'get_title':
                javascriptCode = 'document.title';
                break;
            case 'get_url':
                javascriptCode = 'window.location.href';
                break;
            case 'get_body_text':
                javascriptCode = 'document.body.innerText.substring(0, 500)';
                break;
            case 'click_button':
                // Validate and escape selector input
                const selector = args?.selector || 'button';
                if (selector.includes('javascript:') || selector.includes('<script')) {
                    return 'Invalid selector: contains dangerous content';
                }
                const escapedSelector = JSON.stringify(selector);
                javascriptCode = `
          const button = document.querySelector(${escapedSelector});
          if (button && !button.disabled) {
            // Enhanced duplicate prevention
            const buttonId = button.id || button.className || 'button';
            const clickKey = 'mcp_click_' + btoa(buttonId).slice(0, 10);
            
            // Check if this button was recently clicked
            if (window[clickKey] && Date.now() - window[clickKey] < 2000) {
              return 'Button click prevented - too soon after previous click';
            }
            
            // Mark this button as clicked
            window[clickKey] = Date.now();
            
            // Prevent multiple rapid events
            button.style.pointerEvents = 'none';
            
            // Trigger React events properly
            button.focus();
            
            // Use both React synthetic events and native events
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            
            button.dispatchEvent(clickEvent);
            
            // Re-enable after delay
            setTimeout(() => {
              button.style.pointerEvents = '';
            }, 1000);
            
            return 'Button clicked with enhanced protection';
          }
          return 'Button not found or disabled';
        `;
                break;
            case 'find_elements':
                javascriptCode = generateFindElementsCommand();
                break;
            case 'click_by_text':
                const clickText = args?.text || '';
                if (!clickText) {
                    return 'ERROR: Missing text. Use: {"text": "button text"}. See MCP_USAGE_GUIDE.md for examples.';
                }
                javascriptCode = generateClickByTextCommand(clickText);
                break;
            case 'click_by_selector':
                // Secure selector-based clicking
                const clickSelector = args?.selector || '';
                // Better error message for common mistake
                if (!clickSelector) {
                    return 'ERROR: Missing selector. Use: {"selector": "your-css-selector"}. See MCP_USAGE_GUIDE.md for examples.';
                }
                if (clickSelector.includes('javascript:') || clickSelector.includes('<script')) {
                    return 'Invalid selector: contains dangerous content';
                }
                const escapedClickSelector = JSON.stringify(clickSelector);
                javascriptCode = `
          (function() {
            try {
              const element = document.querySelector(${escapedClickSelector});
              if (element) {
                // Check if element is clickable
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                  return 'Element not visible';
                }
                
                // Prevent rapid clicks
                const clickKey = 'mcp_selector_click_' + btoa(${escapedClickSelector}).slice(0, 10);
                if (window[clickKey] && Date.now() - window[clickKey] < 1000) {
                  return 'Click prevented - too soon after previous click';
                }
                window[clickKey] = Date.now();
                
                // Focus and click
                element.focus();
                const event = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(event);
                
                return 'Successfully clicked element: ' + element.tagName + 
                       (element.textContent ? ' - "' + element.textContent.substring(0, 50) + '"' : '');
              }
              return 'Element not found: ' + ${escapedClickSelector};
            } catch (e) {
              return 'Error clicking element: ' + e.message;
            }
          })();
        `;
                break;
            case 'send_keyboard_shortcut':
                // Secure keyboard shortcut sending
                const key = args?.text || '';
                const validKeys = [
                    'Enter',
                    'Escape',
                    'Tab',
                    'Space',
                    'ArrowUp',
                    'ArrowDown',
                    'ArrowLeft',
                    'ArrowRight',
                ];
                // Parse shortcut like "Ctrl+N" or "Meta+N"
                const parts = key.split('+').map((p) => p.trim());
                const keyPart = parts[parts.length - 1];
                const modifiers = parts.slice(0, -1);
                // Helper function to get proper KeyboardEvent.code value
                function getKeyCode(key) {
                    // Special keys mapping
                    const specialKeys = {
                        Enter: 'Enter',
                        Escape: 'Escape',
                        Tab: 'Tab',
                        Space: 'Space',
                        ArrowUp: 'ArrowUp',
                        ArrowDown: 'ArrowDown',
                        ArrowLeft: 'ArrowLeft',
                        ArrowRight: 'ArrowRight',
                        Backspace: 'Backspace',
                        Delete: 'Delete',
                        Home: 'Home',
                        End: 'End',
                        PageUp: 'PageUp',
                        PageDown: 'PageDown',
                    };
                    if (specialKeys[key]) {
                        return specialKeys[key];
                    }
                    // Single character keys
                    if (key.length === 1) {
                        const upperKey = key.toUpperCase();
                        if (upperKey >= 'A' && upperKey <= 'Z') {
                            return `Key${upperKey}`;
                        }
                        if (upperKey >= '0' && upperKey <= '9') {
                            return `Digit${upperKey}`;
                        }
                    }
                    return `Key${key.toUpperCase()}`;
                }
                if (keyPart.length === 1 || validKeys.includes(keyPart)) {
                    const modifierProps = modifiers
                        .map((mod) => {
                        switch (mod.toLowerCase()) {
                            case 'ctrl':
                                return 'ctrlKey: true';
                            case 'shift':
                                return 'shiftKey: true';
                            case 'alt':
                                return 'altKey: true';
                            case 'meta':
                            case 'cmd':
                                return 'metaKey: true';
                            default:
                                return '';
                        }
                    })
                        .filter(Boolean)
                        .join(', ');
                    javascriptCode = `
            (function() {
              try {
                const event = new KeyboardEvent('keydown', {
                  key: '${keyPart}',
                  code: '${getKeyCode(keyPart)}',
                  ${modifierProps},
                  bubbles: true,
                  cancelable: true
                });
                document.dispatchEvent(event);
                return 'Keyboard shortcut sent: ${key}';
              } catch (e) {
                return 'Error sending shortcut: ' + e.message;
              }
            })();
          `;
                }
                else {
                    return `Invalid keyboard shortcut: ${key}`;
                }
                break;
            case 'navigate_to_hash':
                // Secure hash navigation
                const hash = args?.text || '';
                if (hash.includes('javascript:') || hash.includes('<script') || hash.includes('://')) {
                    return 'Invalid hash: contains dangerous content';
                }
                const cleanHash = hash.startsWith('#') ? hash : '#' + hash;
                javascriptCode = `
          (function() {
            try {
              // Use pushState for safer navigation
              if (window.history && window.history.pushState) {
                const newUrl = window.location.pathname + window.location.search + '${cleanHash}';
                window.history.pushState({}, '', newUrl);
                
                // Trigger hashchange event for React Router
                window.dispatchEvent(new HashChangeEvent('hashchange', {
                  newURL: window.location.href,
                  oldURL: window.location.href.replace('${cleanHash}', '')
                }));
                
                return 'Navigated to hash: ${cleanHash}';
              } else {
                // Fallback to direct assignment
                window.location.hash = '${cleanHash}';
                return 'Navigated to hash (fallback): ${cleanHash}';
              }
            } catch (e) {
              return 'Error navigating: ' + e.message;
            }
          })();
        `;
                break;
            case 'fill_input':
                const inputValue = args?.value || args?.text || '';
                if (!inputValue) {
                    return 'ERROR: Missing value. Use: {"value": "text", "selector": "..."} or {"value": "text", "placeholder": "..."}. See MCP_USAGE_GUIDE.md for examples.';
                }
                javascriptCode = generateFillInputCommand(args?.selector || '', inputValue, args?.text || args?.placeholder || '');
                break;
            case 'select_option':
                javascriptCode = generateSelectOptionCommand(args?.selector || '', args?.value || '', args?.text || '');
                break;
            case 'get_page_structure':
                javascriptCode = generatePageStructureCommand();
                break;
            case 'debug_elements':
                javascriptCode = `
          (function() {
            const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
              text: btn.textContent?.trim(),
              id: btn.id,
              className: btn.className,
              disabled: btn.disabled,
              visible: btn.getBoundingClientRect().width > 0,
              type: btn.type || 'button'
            }));
            
            const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map(inp => ({
              name: inp.name,
              placeholder: inp.placeholder,
              type: inp.type,
              id: inp.id,
              value: inp.value,
              visible: inp.getBoundingClientRect().width > 0,
              enabled: !inp.disabled
            }));
            
            return JSON.stringify({
              buttons: buttons.filter(b => b.visible).slice(0, 10),
              inputs: inputs.filter(i => i.visible).slice(0, 10),
              url: window.location.href,
              title: document.title
            }, null, 2);
          })()
        `;
                break;
            case 'verify_form_state':
                javascriptCode = `
          (function() {
            const forms = Array.from(document.querySelectorAll('form')).map(form => {
              const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map(inp => ({
                name: inp.name,
                type: inp.type,
                value: inp.value,
                placeholder: inp.placeholder,
                required: inp.required,
                valid: inp.validity?.valid
              }));
              
              return {
                id: form.id,
                action: form.action,
                method: form.method,
                inputs: inputs,
                isValid: form.checkValidity?.() || 'unknown'
              };
            });
            
            return JSON.stringify({ forms, formCount: forms.length }, null, 2);
          })()
        `;
                break;
            case 'console_log':
                javascriptCode = `console.log('MCP Command:', '${args?.message || 'Hello from MCP!'}'); 'Console message sent'`;
                break;
            case 'eval':
                const rawCode = typeof args === 'string' ? args : args?.code || command;
                // Enhanced eval with better error handling and result reporting
                const codeHash = Buffer.from(rawCode).toString('base64').slice(0, 10);
                const isStateTest = rawCode.includes('window.testState') ||
                    rawCode.includes('persistent-test-value') ||
                    rawCode.includes('window.testValue');
                javascriptCode = `
          (function() {
            try {
              // Prevent rapid execution of the same code unless it's a state test
              const codeHash = '${codeHash}';
              const isStateTest = ${isStateTest};
              const rawCode = ${JSON.stringify(rawCode)};
              
              if (!isStateTest && window._mcpExecuting && window._mcpExecuting[codeHash]) {
                return { success: false, error: 'Code already executing', result: null };
              }
              
              window._mcpExecuting = window._mcpExecuting || {};
              if (!isStateTest) {
                window._mcpExecuting[codeHash] = true;
              }
              
              let result;
              ${rawCode.trim().startsWith('() =>') || rawCode.trim().startsWith('function')
                    ? `result = (${rawCode})();`
                    : rawCode.includes('return')
                        ? `result = (function() { ${rawCode} })();`
                        : rawCode.includes(';')
                            ? `result = (function() { ${rawCode}; return "executed"; })();`
                            : `result = (function() { return (${rawCode}); })();`}
              
              setTimeout(() => {
                if (!isStateTest && window._mcpExecuting) {
                  delete window._mcpExecuting[codeHash];
                }
              }, 1000);
              
              // Enhanced result reporting
              // For simple expressions, undefined might be a valid result for some cases
              if (result === undefined && !rawCode.includes('window.') && !rawCode.includes('document.') && !rawCode.includes('||')) {
                return { success: false, error: 'Command returned undefined - element may not exist or action failed', result: null };
              }
              if (result === null) {
                return { success: false, error: 'Command returned null - element may not exist', result: null };
              }
              if (result === false && rawCode.includes('click') || rawCode.includes('querySelector')) {
                return { success: false, error: 'Command returned false - action likely failed', result: false };
              }
              
              return { success: true, error: null, result: result };
            } catch (error) {
              return { 
                success: false, 
                error: 'JavaScript error: ' + error.message,
                stack: error.stack,
                result: null 
              };
            }
          })()
        `;
                break;
            default:
                javascriptCode = command;
        }
        const rawResult = await executeInElectron(javascriptCode, target);
        // Try to parse structured response from enhanced eval
        if (command.toLowerCase() === 'eval') {
            try {
                const parsedResult = JSON.parse(rawResult);
                if (parsedResult && typeof parsedResult === 'object' && 'success' in parsedResult) {
                    if (!parsedResult.success) {
                        return `❌ Command failed: ${parsedResult.error}${parsedResult.stack ? '\nStack: ' + parsedResult.stack : ''}`;
                    }
                    return `✅ Command successful${parsedResult.result !== null ? ': ' + JSON.stringify(parsedResult.result) : ''}`;
                }
            }
            catch {
                // If it's not JSON, treat as regular result
            }
        }
        // Handle regular results
        if (rawResult === 'undefined' || rawResult === 'null' || rawResult === '') {
            return `⚠️ Command executed but returned ${rawResult || 'empty'} - this may indicate the element wasn't found or the action failed`;
        }
        return `✅ Result: ${rawResult}`;
    }
    catch (error) {
        throw new Error(`Failed to send command: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Enhanced click function with better React support
 */
async function clickByText(text) {
    return sendCommandToElectron('click_by_text', { text });
}
/**
 * Enhanced input filling with React state management
 */
async function fillInput(searchText, value, selector) {
    return sendCommandToElectron('fill_input', {
        selector,
        value,
        text: searchText,
    });
}
/**
 * Enhanced select option with proper event handling
 */
async function selectOption(value, selector, text) {
    return sendCommandToElectron('select_option', {
        selector,
        value,
        text,
    });
}
/**
 * Get comprehensive page structure analysis
 */
async function getPageStructure() {
    return sendCommandToElectron('get_page_structure');
}
/**
 * Get enhanced element analysis
 */
async function findElements() {
    return sendCommandToElectron('find_elements');
}
/**
 * Execute custom JavaScript with error handling
 */
async function executeCustomScript(code) {
    return sendCommandToElectron('eval', { code });
}
/**
 * Get debugging information about page elements
 */
async function debugElements() {
    return sendCommandToElectron('debug_elements');
}
/**
 * Verify current form state and validation
 */
async function verifyFormState() {
    return sendCommandToElectron('verify_form_state');
}
async function getTitle() {
    return sendCommandToElectron('get_title');
}
async function getUrl() {
    return sendCommandToElectron('get_url');
}
async function getBodyText() {
    return sendCommandToElectron('get_body_text');
}

;// ./src/utils/electron-logs.ts




/**
 * Read logs from running Electron applications
 */
async function readElectronLogs(logType = 'all', lines = 100, follow = false) {
    try {
        logger.info('[MCP] Looking for running Electron applications for log access...');
        try {
            const target = await findElectronTarget();
            // Connect via WebSocket to get console logs
            if (logType === 'console' || logType === 'all') {
                return await getConsoleLogsViaDevTools(target, lines, follow);
            }
        }
        catch {
            logger.info('[MCP] No DevTools connection found, checking system logs...');
        }
        // Fallback to system logs if DevTools not available
        return await getSystemElectronLogs(lines);
    }
    catch (error) {
        throw new Error(`Failed to read logs: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Get console logs via Chrome DevTools Protocol
 */
async function getConsoleLogsViaDevTools(target, lines, follow) {
    const logs = [];
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                const ws = await connectForLogs(target, (log) => {
                    logs.push(log);
                    if (logs.length >= lines && !follow) {
                        ws.close();
                        resolve(logs.slice(-lines).join('\n'));
                    }
                });
                // For non-follow mode, try to get console history first
                if (!follow) {
                    // Request console API calls from Runtime
                    ws.send(JSON.stringify({
                        id: 99,
                        method: 'Runtime.evaluate',
                        params: {
                            expression: `console.log("Reading console history for MCP test"); "History checked"`,
                            includeCommandLineAPI: true,
                        },
                    }));
                    // Wait longer for logs to be captured and history to be available
                    setTimeout(() => {
                        ws.close();
                        resolve(logs.length > 0 ? logs.slice(-lines).join('\n') : 'No console logs available');
                    }, 7000); // Increased timeout to 7 seconds
                }
            }
            catch (error) {
                reject(error);
            }
        })();
    });
}
/**
 * Get system logs for Electron processes
 */
async function getSystemElectronLogs(lines = 100) {
    logger.info('[MCP] Reading system logs for Electron processes...');
    try {
        const execAsync = (0,external_util_namespaceObject.promisify)(external_child_process_namespaceObject.exec);
        // Get running Electron processes
        const { stdout } = await execAsync('ps aux | grep -i electron | grep -v grep');
        const electronProcesses = stdout
            .trim()
            .split('\n')
            .filter((line) => line.length > 0);
        if (electronProcesses.length === 0) {
            return 'No Electron processes found running on the system.';
        }
        let logOutput = `Found ${electronProcesses.length} Electron process(es):\n\n`;
        electronProcesses.forEach((process, index) => {
            const parts = process.trim().split(/\s+/);
            const pid = parts[1];
            const command = parts.slice(10).join(' ');
            logOutput += `Process ${index + 1}:\n`;
            logOutput += `  PID: ${pid}\n`;
            logOutput += `  Command: ${command}\n\n`;
        });
        try {
            const { stdout: logContent } = await execAsync(`log show --last 1h --predicate 'process == "Electron"' --style compact | tail -${lines}`);
            if (logContent.trim()) {
                logOutput += 'Recent Electron logs from system:\n';
                logOutput += '==========================================\n';
                logOutput += logContent;
            }
            else {
                logOutput +=
                    'No recent Electron logs found in system logs. Try enabling remote debugging with --remote-debugging-port=9222 for better log access.';
            }
        }
        catch {
            logOutput +=
                'Could not access system logs. For detailed logging, start Electron app with --remote-debugging-port=9222';
        }
        return logOutput;
    }
    catch (error) {
        return `Error reading system logs: ${error instanceof Error ? error.message : String(error)}`;
    }
}

;// external "playwright"
const external_playwright_namespaceObject = require("playwright");
;// external "fs/promises"
const promises_namespaceObject = require("fs/promises");
;// ./src/screenshot.ts




/**
 * Take a screenshot of the running Electron application using Chrome DevTools Protocol
 */
async function takeScreenshot(outputPath, windowTitle) {
    logger.info('📸 Taking screenshot of Electron application', {
        outputPath,
        windowTitle,
        timestamp: new Date().toISOString(),
    });
    try {
        // Find running Electron applications
        const apps = await scanForElectronApps();
        if (apps.length === 0) {
            throw new Error('No running Electron applications found with remote debugging enabled');
        }
        // Use the first app found (or find by title if specified)
        let targetApp = apps[0];
        if (windowTitle) {
            const namedApp = apps.find((app) => app.targets.some((target) => target.title?.toLowerCase().includes(windowTitle.toLowerCase())));
            if (namedApp) {
                targetApp = namedApp;
            }
        }
        // Connect to the Electron app's debugging port
        const browser = await external_playwright_namespaceObject.chromium.connectOverCDP(`http://localhost:${targetApp.port}`);
        const contexts = browser.contexts();
        if (contexts.length === 0) {
            throw new Error('No browser contexts found - make sure Electron app is running with remote debugging enabled');
        }
        const context = contexts[0];
        const pages = context.pages();
        if (pages.length === 0) {
            throw new Error('No pages found in the browser context');
        }
        // Find the main application page (skip DevTools pages)
        let targetPage = pages[0];
        for (const page of pages) {
            const url = page.url();
            const title = await page.title().catch(() => '');
            // Skip DevTools and about:blank pages
            if (!url.includes('devtools://') &&
                !url.includes('about:blank') &&
                title &&
                !title.includes('DevTools')) {
                // If windowTitle is specified, try to match it
                if (windowTitle && title.toLowerCase().includes(windowTitle.toLowerCase())) {
                    targetPage = page;
                    break;
                }
                else if (!windowTitle) {
                    targetPage = page;
                    break;
                }
            }
        }
        logger.info(`Taking screenshot of page: ${targetPage.url()} (${await targetPage.title()})`);
        // Take screenshot as buffer (in memory)
        const screenshotBuffer = await targetPage.screenshot({
            type: 'png',
            fullPage: false,
        });
        await browser.close();
        // Convert buffer to base64 for transmission
        const base64Data = screenshotBuffer.toString('base64');
        logger.info(`Screenshot captured successfully (${screenshotBuffer.length} bytes)`);
        // If outputPath is provided, save to file
        if (outputPath) {
            await promises_namespaceObject.writeFile(outputPath, screenshotBuffer);
            return {
                filePath: outputPath,
                base64: base64Data,
                data: `Screenshot saved to: ${outputPath}`,
            };
        }
        else {
            return {
                base64: base64Data,
                data: `Screenshot captured as base64 data (${screenshotBuffer.length} bytes)`,
            };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Screenshot failed: ${errorMessage}. Make sure the Electron app is running with remote debugging enabled (--remote-debugging-port=9222)`);
    }
}

;// ./src/handlers.ts







async function handleToolCall(request) {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case ToolName.GET_ELECTRON_WINDOW_INFO: {
                const { includeChildren } = GetElectronWindowInfoSchema.parse(args);
                const result = await getElectronWindowInfo(includeChildren);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Window Information:\n\n${JSON.stringify(result, null, 2)}`,
                        },
                    ],
                    isError: false,
                };
            }
            case ToolName.TAKE_SCREENSHOT: {
                const { outputPath, windowTitle } = TakeScreenshotSchema.parse(args);
                const result = await takeScreenshot(outputPath, windowTitle);
                const content = [];
                if (result.filePath) {
                    content.push({
                        type: 'text',
                        text: `Screenshot saved to: ${result.filePath}`,
                    });
                }
                else {
                    content.push({
                        type: 'text',
                        text: 'Screenshot captured in memory (no file saved)',
                    });
                }
                // Add the image data for AI evaluation
                content.push({
                    type: 'image',
                    data: result.base64,
                    mimeType: 'image/png',
                });
                return { content, isError: false };
            }
            case ToolName.SEND_COMMAND_TO_ELECTRON: {
                const { command, args: commandArgs, targetId, windowTitle, } = SendCommandToElectronSchema.parse(args);
                // Build window target options if specified
                const windowOptions = targetId || windowTitle ? { targetId, windowTitle } : undefined;
                const result = await sendCommandToElectron(command, commandArgs, windowOptions);
                return {
                    content: [{ type: 'text', text: result }],
                    isError: false,
                };
            }
            case ToolName.READ_ELECTRON_LOGS: {
                const { logType, lines, follow } = ReadElectronLogsSchema.parse(args);
                const logs = await readElectronLogs(logType, lines);
                if (follow) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Following logs (${logType}). This is a snapshot of recent logs:\n\n${logs}`,
                            },
                        ],
                        isError: false,
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Electron logs (${logType}):\n\n${logs}`,
                        },
                    ],
                    isError: false,
                };
            }
            case ToolName.LIST_ELECTRON_WINDOWS: {
                const { includeDevTools } = ListElectronWindowsSchema.parse(args);
                const windows = await listElectronWindows(includeDevTools);
                if (windows.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'No Electron windows found. Ensure your app is running with --remote-debugging-port=9222',
                            },
                        ],
                        isError: false,
                    };
                }
                const formatted = windows
                    .map((w) => `- [${w.id}] "${w.title}" (port: ${w.port}, type: ${w.type})\n  URL: ${w.url}`)
                    .join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Available Electron windows (${windows.length}):\n\n${formatted}`,
                        },
                    ],
                    isError: false,
                };
            }
            default:
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Unknown tool: ${name}`,
                        },
                    ],
                    isError: true,
                };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`Tool execution failed: ${name}`, {
            error: errorMessage,
            stack: errorStack,
            args,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `Error executing ${name}: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }
}

;// ./src/index.ts
//#!/usr/bin/env node






// Create MCP server instance
const server = new Server({
    name: '@debugelectron/debug-electron-mcp',
    version: '1.6.8',
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Listing tools request received');
    return { tools: tools };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const start = Date.now();
    logger.info(`Tool call: ${request.params.name}`);
    logger.debug(`Tool call args:`, JSON.stringify(request.params.arguments, null, 2));
    const result = await handleToolCall(request);
    const duration = Date.now() - start;
    if (duration > 1000) {
        logger.warn(`Slow tool execution: ${request.params.name} took ${duration}ms`);
    }
    // Log result but truncate large base64 data to avoid spam
    if (logger.isEnabled(2)) {
        // Only if DEBUG level
        const logResult = { ...result };
        if (logResult.content && Array.isArray(logResult.content)) {
            logResult.content = logResult.content.map((item) => {
                if (item.type === 'text' &&
                    item.text &&
                    typeof item.text === 'string' &&
                    item.text.length > 1000) {
                    return {
                        ...item,
                        text: item.text.substring(0, 100) + '... [truncated]',
                    };
                }
                if (item.type === 'image' &&
                    item.data &&
                    typeof item.data === 'string' &&
                    item.data.length > 100) {
                    return {
                        ...item,
                        data: item.data.substring(0, 50) + '... [base64 truncated]',
                    };
                }
                return item;
            });
        }
        logger.debug(`Tool call result:`, JSON.stringify(logResult, null, 2));
    }
    return result;
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    logger.info('Electron MCP Server starting...');
    await server.connect(transport);
    logger.info('Electron MCP Server running on stdio');
    logger.info('Available tools:', tools.map((t) => t.name).join(', '));
}
main().catch((error) => {
    logger.error('Server error:', error);
    process.exit(1);
});

/******/ })()
;
//# sourceMappingURL=index.js.map