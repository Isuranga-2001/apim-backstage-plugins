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

import { useState } from 'react';
import Box from '@material-ui/core/Box';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';
import Editor from '@monaco-editor/react';
import { MarkdownContent } from '@backstage/core-components';

export const MarkdownContentEditor = (options: {
  value: string;
  onChange: (value: string) => void;
  maxSizeBytes: number;
}) => {
  const { value, onChange, maxSizeBytes } = options;
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const sizeBytes = new Blob([value]).size;
  const overLimit = sizeBytes > maxSizeBytes;

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab label="Write" value="write" />
        <Tab label="Preview" value="preview" />
      </Tabs>
      <Box border={1} borderColor="divider" mt={1}>
        {tab === 'write' ? (
          <Editor
            height="240px"
            defaultLanguage="markdown"
            value={value}
            onChange={v => onChange(v ?? '')}
            options={{ minimap: { enabled: false }, wordWrap: 'on' }}
          />
        ) : (
          <Box p={2} minHeight={240}>
            <MarkdownContent content={value || '_Nothing to preview yet._'} />
          </Box>
        )}
      </Box>
      <Typography
        variant="caption"
        color={overLimit ? 'error' : 'textSecondary'}
      >
        {sizeBytes.toLocaleString()} / {maxSizeBytes.toLocaleString()} bytes
      </Typography>
    </Box>
  );
};
