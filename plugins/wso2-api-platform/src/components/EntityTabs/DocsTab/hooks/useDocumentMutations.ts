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

import { useMemo, useState } from 'react';
import { Entity, getCompoundEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import {
  CreateWso2ApiDocumentRequest,
  UpdateWso2ApiDocumentMetadataRequest,
  wso2ApiPlatformApiRef,
} from '../../../../api';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useDocumentMutations = (entity: Entity) => {
  const wso2Api = useApi(wso2ApiPlatformApiRef);
  const entityRef = useMemo(() => getCompoundEntityRef(entity), [entity]);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));

  const createDocument = async (input: CreateWso2ApiDocumentRequest) => {
    setSubmitting(true);
    try {
      const doc = await wso2Api.createDocument(entityRef, input);
      setSnackbar({
        open: true,
        message: `Document "${doc.name}" created.`,
        severity: 'success',
      });
      return doc;
    } catch (e) {
      setSnackbar({ open: true, message: messageOf(e), severity: 'error' });
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const updateDocumentMetadata = async (
    documentId: string,
    patch: UpdateWso2ApiDocumentMetadataRequest,
  ) => {
    setSubmitting(true);
    try {
      const doc = await wso2Api.updateDocumentMetadata(
        entityRef,
        documentId,
        patch,
      );
      setSnackbar({
        open: true,
        message: `Document "${doc.name}" updated.`,
        severity: 'success',
      });
      return doc;
    } catch (e) {
      setSnackbar({ open: true, message: messageOf(e), severity: 'error' });
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteDocument = async (documentId: string, documentName: string) => {
    setSubmitting(true);
    try {
      await wso2Api.deleteDocument(entityRef, documentId);
      setSnackbar({
        open: true,
        message: `Document "${documentName}" deleted.`,
        severity: 'success',
      });
    } catch (e) {
      setSnackbar({ open: true, message: messageOf(e), severity: 'error' });
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    snackbar,
    closeSnackbar,
    createDocument,
    updateDocumentMetadata,
    deleteDocument,
  };
};
