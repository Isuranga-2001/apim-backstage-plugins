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
      definitions?: {
        /**
         * @visibility frontend
         */
        maxSizeKb?: number;
      };
    };
    /**
     * Frontend-visible Policy Hub configuration. The Policies tab's policy
     * editor calls the Policy Hub directly from the browser, so its base URL
     * must be readable client-side. Falls back to the platform's public
     * Policy Hub instance when unset.
     */
    policyHub?: {
      /**
       * @visibility frontend
       */
      baseUrl?: string;
    };
    /**
     * Frontend-visible API Portal base URL. The Overview tab's "Publish to
     * API Portal" dialog and "Open API Portal" link display and navigate to
     * this URL directly from the browser.
     */
    apiPortal?: {
      /**
       * @visibility frontend
       */
      baseUrl?: string;
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
