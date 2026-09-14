export interface Config {
  catalog?: {
    providers?: {
      wso2ApiPlatform?: {
        /**
         * Namespace to use for WSO2 catalog entities.
         */
        namespace?: string;
        schedule: {
          frequency:
            | {
                minutes?: number;
              }
            | string;
          timeout:
            | {
                minutes?: number;
              }
            | string;
          initialDelay?:
            | {
                seconds?: number;
              }
            | string;
        };
      };
    };
  };
  wso2ApiPlatform?: {
    /**
     * Enables WSO2 API Manager publisher and service catalog ingestion.
     * Defaults to false.
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
    serviceCatalogBasePath?: string;
    /**
     * Request timeout in seconds. Defaults to 30.
     */
    requestTimeoutSeconds?: number;
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
      requiredScopes?: string[];
    };
  };
  wso2ApiPlatformGateway?: {
    /**
     * Enables WSO2 API Platform Gateway integration.
     * Defaults to false.
     */
    enabled?: boolean;
    gateways?: Array<{
      name: string;
      runtimeUrls: string[];
      managementApiUrl?: string;
      /** @visibility secret */
      managementApiUsername?: string;
      /** @visibility secret */
      managementApiPassword?: string;
      environmentType?: string;
      organizationId?: string;
      integration?: 'self-hosted' | 'openchoreo';
    }>;
  };
}
