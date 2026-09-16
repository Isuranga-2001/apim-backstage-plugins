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

import { useEffect, useMemo, useState } from 'react';
import * as yaml from 'js-yaml';
// @ts-ignore
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import Box from '@material-ui/core/Box';
import Alert from '@material-ui/lab/Alert';

/** Keeps SwaggerUI (an expensive re-render) from re-parsing on every keystroke. */
const PREVIEW_DEBOUNCE_MS = 300;

function parseSpec(content: string): { spec?: object; error?: string } {
  if (!content?.trim()) {
    return { error: 'The definition is empty.' };
  }
  let parsed: unknown;
  try {
    // yaml.load parses both YAML and JSON.
    parsed = yaml.load(content);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid YAML/JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'The definition does not parse to an object.' };
  }
  const spec = parsed as Record<string, unknown>;
  if (!spec.openapi && !spec.swagger) {
    return {
      error:
        "Missing a top-level 'openapi' or 'swagger' version field — not a valid API definition yet.",
    };
  }
  return { spec };
}

/**
 * Live preview of an in-progress OpenAPI/Swagger edit, using the same
 * `swagger-ui-react` component the Try It Out tab renders. The last
 * successfully parsed spec stays visible so the preview doesn't blank out on
 * every keystroke; a syntax/shape error is instead surfaced as a banner
 * overlaid on top of it.
 */
export const SwaggerDefinitionPreview = (props: {
  content: string;
  height: number;
  /** Called with `true` whenever the current content fails to parse/render. */
  onValidityChange?: (hasError: boolean) => void;
}) => {
  const { content, height, onValidityChange } = props;

  const [debouncedContent, setDebouncedContent] = useState(content);
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedContent(content),
      PREVIEW_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [content]);

  const { spec, error } = useMemo(
    () => parseSpec(debouncedContent),
    [debouncedContent],
  );

  const [lastValidSpec, setLastValidSpec] = useState<object | undefined>(spec);
  useEffect(() => {
    if (spec) {
      setLastValidSpec(spec);
    }
  }, [spec]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onValidityChange?.(!!error), [error]);

  return (
    <Box
      position="relative"
      height={height}
      overflow="auto"
      bgcolor="#fff"
      borderRadius={6}
      border="1px solid #d0d0d0"
    >
      {error && (
        <Box
          position="sticky"
          top={0}
          zIndex={1}
          p={1}
          data-testid="swagger-preview-error"
        >
          <Alert severity="error" variant="filled">
            {error}
          </Alert>
        </Box>
      )}
      {lastValidSpec && (
        // supportedSubmitMethods={[]} is swagger-ui-react's documented way to
        // drop "Try it out" for every operation, since this preview is a
        // read-only rendering of an in-progress edit, not a live console.
        <SwaggerUI spec={lastValidSpec} supportedSubmitMethods={[]} />
      )}
    </Box>
  );
};
