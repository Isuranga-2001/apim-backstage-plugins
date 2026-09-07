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

import Box from '@material-ui/core/Box';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import { Wso2ApiDocumentSourceType } from '../../../../../api';
import { MarkdownContentEditor } from './MarkdownContentEditor';
import { TextContentEditor } from './TextContentEditor';
import { UrlContentInput } from './UrlContentInput';
import { FileContentInput } from './FileContentInput';

export type DocumentContentValue = {
  sourceType: Wso2ApiDocumentSourceType;
  inlineContent: string;
  sourceUrl: string;
  file: File | null;
};

export const DocumentContentEditor = (options: {
  value: DocumentContentValue;
  onChange: (value: DocumentContentValue) => void;
  maxInlineSizeBytes: number;
  maxFileSizeBytes: number;
  allowedExtensions: string[];
  fileError?: string;
}) => {
  const {
    value,
    onChange,
    maxInlineSizeBytes,
    maxFileSizeBytes,
    allowedExtensions,
    fileError,
  } = options;

  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value.sourceType}
        onChange={(_, sourceType) => {
          if (sourceType) {
            onChange({ ...value, sourceType });
          }
        }}
      >
        <ToggleButton value="MARKDOWN">Markdown</ToggleButton>
        <ToggleButton value="INLINE">Text</ToggleButton>
        <ToggleButton value="URL">URL</ToggleButton>
        <ToggleButton value="FILE">File</ToggleButton>
      </ToggleButtonGroup>
      <Box mt={2}>
        {value.sourceType === 'MARKDOWN' && (
          <MarkdownContentEditor
            value={value.inlineContent}
            onChange={inlineContent => onChange({ ...value, inlineContent })}
            maxSizeBytes={maxInlineSizeBytes}
          />
        )}
        {value.sourceType === 'INLINE' && (
          <TextContentEditor
            value={value.inlineContent}
            onChange={inlineContent => onChange({ ...value, inlineContent })}
            maxSizeBytes={maxInlineSizeBytes}
          />
        )}
        {value.sourceType === 'URL' && (
          <UrlContentInput
            value={value.sourceUrl}
            onChange={sourceUrl => onChange({ ...value, sourceUrl })}
          />
        )}
        {value.sourceType === 'FILE' && (
          <FileContentInput
            file={value.file}
            onChange={file => onChange({ ...value, file })}
            allowedExtensions={allowedExtensions}
            maxSizeBytes={maxFileSizeBytes}
            error={fileError}
          />
        )}
      </Box>
    </Box>
  );
};
