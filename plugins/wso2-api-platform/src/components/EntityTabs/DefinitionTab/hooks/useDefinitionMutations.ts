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
import { wso2ApiPlatformApiRef } from '../../../../api';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useDefinitionMutations = (entity: Entity) => {
  const wso2Api = useApi(wso2ApiPlatformApiRef);
  const entityRef = useMemo(() => getCompoundEntityRef(entity), [entity]);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));

  const upsertDefinition = async (fileName: string, content: string) => {
    setSubmitting(true);
    try {
      const result = await wso2Api.upsertDefinition(entityRef, {
        fileName,
        content,
      });
      setSnackbar({
        open: true,
        message: `Definition "${fileName}" saved.`,
        severity: 'success',
      });
      return result;
    } catch (e) {
      setSnackbar({ open: true, message: messageOf(e), severity: 'error' });
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, snackbar, closeSnackbar, upsertDefinition };
};
