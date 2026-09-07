export interface Config {
  catalog?: {
    providers?: {
      wso2ApiPlatform?: {
        schedule?: {
          frequency?: {
            /**
             * @visibility frontend
             */
            minutes?: number;
          };
        };
      };
    };
  };
  wso2ApiPlatform?: {
    /**
     * @visibility frontend
     */
    enabled?: boolean;
    /**
     * @visibility frontend
     */
    catalogSyncTimeoutSeconds?: number;
    /**
     * Frontend-visible subset of the document store configuration, so the
     * Add Document dialog can validate client-side before a byte uploads.
     * @visibility frontend
     */
    storage?: {
      /**
       * @visibility frontend
       */
      enabled?: boolean;
      documents?: {
        /**
         * @visibility frontend
         */
        maxFileSizeMb?: number;
        /**
         * @visibility frontend
         */
        maxInlineSizeKb?: number;
        /**
         * @visibility frontend
         */
        allowedExtensions?: string[];
      };
    };
  };
  wso2ApiPlatformGateway?: {
    /**
     * Enables WSO2 API Platform Gateway discovery.
     * @visibility frontend
     */
    enabled?: boolean;
  };
}
