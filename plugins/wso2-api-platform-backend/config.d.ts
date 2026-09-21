export interface Config {
  wso2ApiPlatform?: {
    /**
     * Enables WSO2 API Manager integration.
     * Defaults to false.
     * @visibility frontend
     */
    enabled?: boolean;
    /**
     * Required when enabled is true.
     */
    baseUrl?: string;
    /**
     * Required when enabled is true.
     */
    publisherBasePath?: string;
    /**
     * Required when enabled is true.
     */
    developerBasePath?: string;
    serviceCatalogBasePath?: string;
    tls?: {
      rejectUnauthorized?: boolean;
    };
    /**
     * Required when enabled is true.
     */
    auth?: {
      tokenUrl?: string;
      /** @visibility secret */
      clientId?: string;
      /** @visibility secret */
      clientSecret?: string;
      /** @visibility secret */
      username?: string;
      /** @visibility secret */
      password?: string;
      additionalScopes?: string[];
    };
    /**
     * The timeout in seconds for the catalog synchronization polling.
     * @visibility frontend
     */
    catalogSyncTimeoutSeconds?: number;
  };
  /**
   * Configuration for the plugin-owned storage used by APIs
   * discovered from self-hosted gateways and OpenChoreo gateways.
   */
  wso2ApiPlatformStorage?: {
    /**
     * Master switch for document storage. When false, document routes
     * return 501 and the frontend Docs tab falls back to its
     * "unavailable" empty state.
     * Defaults to true.
     * @visibility frontend
     */
    enabled?: boolean;
    documents?: {
      /**
       * Maximum size, in megabytes, for FILE document uploads.
       * Defaults to 10.
       * @visibility frontend
       */
      maxFileSizeMb?: number;
      /**
       * Maximum size, in kilobytes, for INLINE/MARKDOWN document bodies.
       * Defaults to 512.
       * @visibility frontend
       */
      maxInlineSizeKb?: number;
      /**
       * Allowed file extensions for FILE uploads (no leading dot). An
       * empty array disables extension checking.
       * @visibility frontend
       */
      allowedExtensions?: string[];
      /**
       * Optional stricter MIME-type allow-list. An empty array derives
       * allowed types from allowedExtensions instead.
       */
      allowedMimeTypes?: string[];
    };
    binary?: {
      /**
       * Where FILE document bytes are stored. Only 'database' is
       * implemented today; 's3' and 'filesystem' are reserved.
       */
      backend?: 'database' | 's3' | 'filesystem';
    };
    definitions?: {
      /**
       * Maximum size, in kilobytes, for an uploaded API definition.
       * Defaults to 1024.
       * @visibility frontend
       */
      maxSizeKb?: number;
    };
    policies?: {
      /**
       * Maximum size, in kilobytes, for a policy artifact payload.
       * Defaults to 256.
       * @visibility frontend
       */
      maxSizeKb?: number;
    };
  };
  /** WSO2 API Portal publishing settings. */
  wso2ApiPlatformApiPortal?: {
    /** Defaults to false. @visibility frontend */
    enabled?: boolean;
    /** API Portal URL. @visibility frontend */
    baseUrl?: string;
    /** Defaults to '/api-portal/api/v0.9'. */
    basePath?: string;
    auth?: {
      /** Defaults to 'platform-login'. */
      mode?: 'platform-login' | 'idp';
    };
    defaults?: {
      /** API status. */
      status?: 'PUBLISHED' | 'DEPRECATED';
      /**
       * IDs of custom org subscription plans (beyond Bronze/Silver/Gold/
       * Unlimited), offered for per-API selection. Must already exist in
       * the org; each API's own selection is used at publish time.
       */
      subscriptionPlans?: string[];
      /** Agent visibility. */
      agentVisibility?: 'VISIBLE' | 'HIDDEN';
    };
    /** Request timeout in seconds. */
    requestTimeoutSeconds?: number;
    tls?: {
      rejectUnauthorized?: boolean;
    };
  };
  /**
   * Configuration for the WSO2 API Platform Gateways.
   * @visibility frontend
   */
  wso2ApiPlatformGateway?: {
    /**
     * Enables WSO2 API Platform Gateway integration. Defaults to false.
     * @visibility frontend
     */
    enabled?: boolean;
    /**
     * Master switch for pushing Definition/Policy edits to the gateway.
     * Defaults to false.
     *
     * IGNORED for this release: this feature is hard-locked to `false` in
     * code (`GATEWAY_WRITE_OPERATIONS_LOCKED` in the backend's
     * `service/config.ts`, mirrored in the frontend's
     * `utils/gatewayWriteAccess.ts`), because it has no per-API/per-team
     * authorization model yet — enabling it would let any authenticated
     * Backstage user with valid gateway credentials change any API on the
     * gateway. Setting this to `true` here currently has no effect. It is
     * expected to be re-enabled, with that authorization gap addressed, in
     * a future release.
     * @visibility frontend
     */
    enableWriteOperations?: boolean;
    gateways?: Array<{
      name: string;
      runtimeUrls: string[];
      /** @visibility frontend */
      managementApiUrl?: string;
      /** @visibility secret */
      managementApiUsername?: string;
      /** @visibility secret */
      managementApiPassword?: string;
      environmentType?: string;
      description?: string;
      organizationId?: string;
    }>;
  };
}
