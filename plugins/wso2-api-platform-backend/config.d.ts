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
    /**
     * Configuration for the plugin-owned document store used by APIs
     * discovered from self-hosted gateways and OpenChoreo.
     */
    storage?: {
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
    };
  };
  /**
   * Configuration for self-hosted WSO2 API Platform Gateways.
   * @visibility frontend
   */
  wso2ApiPlatformGateway?: {
    /**
     * Enables WSO2 API Platform Gateway discovery.
     * Defaults to false.
     * @visibility frontend
     */
    enabled?: boolean;
    gateways?: Array<{
      name: string;
      urls: string[];
      /** @visibility frontend */
      discoveryUrl?: string;
      /** @visibility secret */
      discoveryUsername?: string;
      /** @visibility secret */
      discoveryPassword?: string;
      environmentType?: string;
      description?: string;
      organizationId?: string;
      /** @visibility frontend */
      integration?: 'self-hosted' | 'openchoreo';
    }>;
  };
}
