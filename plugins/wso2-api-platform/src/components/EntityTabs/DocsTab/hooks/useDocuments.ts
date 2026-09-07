/*
 * Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Entity, getCompoundEntityRef } from '@backstage/catalog-model';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import {
  Wso2ApiDocument,
  Wso2ApiDocumentCapabilities,
  wso2ApiPlatformApiRef,
} from '../../../../api';
import { ApiDocumentSourceMode } from './useApiDocumentSource';

const WSO2_API_DOCS_ANNOTATION = 'wso2.com/api-documents';
const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

const NO_WRITE_CAPABILITIES: Wso2ApiDocumentCapabilities = {
  read: true,
  create: false,
  updateMetadata: false,
  updateContent: false,
  delete: false,
};

export const useWso2Documents = (options: {
  entity: Entity;
  propDocuments?: Wso2ApiDocument[];
  mode: ApiDocumentSourceMode;
}) => {
  const { entity, propDocuments, mode } = options;
  const config = useApi(configApiRef);
  const { fetch } = useApi(fetchApiRef);
  const wso2Api = useApi(wso2ApiPlatformApiRef);

  const [previewDoc, setPreviewDoc] = useState<Wso2ApiDocument | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
  const backendUrl = config.getString('backend.baseUrl');
  const entityRef = useMemo(() => getCompoundEntityRef(entity), [entity]);

  // mode: 'annotation' — existing on-prem path, unchanged.
  const annotationDocuments = useMemo(() => {
    let docs: Wso2ApiDocument[] = [];
    if (propDocuments && propDocuments.length > 0) {
      docs = propDocuments;
    } else {
      try {
        const wso2DocsJson =
          entity.metadata.annotations?.[WSO2_API_DOCS_ANNOTATION] || '[]';
        docs = JSON.parse(wso2DocsJson);
      } catch {
        // Ignore malformed document annotations and render the empty state.
      }
    }
    return docs.map((doc: any) => ({
      ...doc,
      id: doc.id || doc.documentId,
    }));
  }, [entity, propDocuments]);

  // mode: 'store' — plugin-owned document store for self-hosted/OpenChoreo.
  const [storeDocuments, setStoreDocuments] = useState<Wso2ApiDocument[]>([]);
  const [storeCapabilities, setStoreCapabilities] =
    useState<Wso2ApiDocumentCapabilities>(NO_WRITE_CAPABILITIES);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<Error | undefined>(undefined);

  const fetchStoreDocuments = useCallback(async () => {
    setStoreLoading(true);
    setStoreError(undefined);
    try {
      const response = await wso2Api.listDocuments(entityRef);
      setStoreDocuments(response.list);
      setStoreCapabilities(response.capabilities);
    } catch (e) {
      setStoreError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setStoreLoading(false);
    }
  }, [wso2Api, entityRef]);

  useEffect(() => {
    if (mode === 'store') {
      fetchStoreDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, entityRef.kind, entityRef.namespace, entityRef.name]);

  const documents = mode === 'store' ? storeDocuments : annotationDocuments;
  const capabilities =
    mode === 'store' ? storeCapabilities : NO_WRITE_CAPABILITIES;

  const getContentUrl = useCallback(
    async (docId: string) => {
      if (mode === 'store') {
        return wso2Api.getDocumentContentUrl(entityRef, docId);
      }
      return `${backendUrl}/api/wso2-api-platform/apis/${apiId}/documents/${docId}/content`;
    },
    [mode, wso2Api, entityRef, backendUrl, apiId],
  );

  const handleDownload = async (rowData: Wso2ApiDocument) => {
    const docId = rowData.id || rowData.documentId;
    const { name, sourceType, sourceUrl } = rowData;

    if (sourceType === 'URL') {
      window.open(sourceUrl || '#', '_blank', 'noopener,noreferrer');
      return;
    }

    if (!docId) {
      return;
    }

    try {
      const url = await getContentUrl(docId);
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      let filename = name;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches !== null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      // Download failures are ignored; the preview path reports its own error.
    }
  };

  const handlePreview = async (rowData: Wso2ApiDocument) => {
    const { sourceType } = rowData;
    const docId = rowData.id || rowData.documentId;

    if (sourceType === 'URL') {
      window.open(rowData.sourceUrl || '#', '_blank', 'noopener,noreferrer');
      return;
    }

    if (sourceType !== 'MARKDOWN' && sourceType !== 'INLINE') {
      handleDownload(rowData);
      return;
    }

    if (!docId) {
      setPreviewContent('Failed to load content: Missing document ID.');
      return;
    }

    setPreviewDoc(rowData);
    setLoadingPreview(true);
    setPreviewContent(null);

    try {
      const url = await getContentUrl(docId);
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok)
        throw new Error(`Failed to load: ${response.statusText}`);
      const content = await response.text();
      setPreviewContent(content);
    } catch (e) {
      setPreviewContent('Failed to load content.');
    } finally {
      setLoadingPreview(false);
    }
  };

  return {
    documents,
    capabilities,
    loading: mode === 'store' ? storeLoading : false,
    error: mode === 'store' ? storeError : undefined,
    refresh: mode === 'store' ? fetchStoreDocuments : () => {},
    previewDoc,
    previewContent,
    loadingPreview,
    setPreviewDoc,
    handleDownload,
    handlePreview,
  };
};
