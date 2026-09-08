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

import { useState, useEffect } from 'react';
/* eslint-disable no-nested-ternary */
import * as yaml from 'js-yaml';
import Editor from '@monaco-editor/react';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import Box from '@material-ui/core/Box';
import GetAppIcon from '@material-ui/icons/GetApp';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import EditIcon from '@material-ui/icons/Edit';
import { useStyles } from './styles';

export interface ApiDefinitionViewerProps {
  value: string;
  language?: string;
  onUpdateClick?: () => void;
}

const editorActionButtonStyle = {
  color: '#d4d4d4',
  borderColor: '#555',
  textTransform: 'none' as const,
};

export const ApiDefinitionViewer = ({
  value,
  language,
  onUpdateClick,
}: ApiDefinitionViewerProps) => {
  const classes = useStyles();

  const [displayFormat, setDisplayFormat] = useState<'YAML' | 'JSON'>('YAML');
  const [localValue, setLocalValue] = useState<string>(value);

  // Detect if the original value looks like XML
  const isXml = language === 'xml' || value?.trimStart().startsWith('<');
  const isGraphql = language === 'graphql';

  // Parse and format the value whenever `value` or `displayFormat` changes.
  useEffect(() => {
    if (!value?.trim()) {
      setLocalValue('');
      return;
    }
    if (isXml || isGraphql) {
      setLocalValue(value);
      return;
    }
    try {
      // yaml.load works for both JSON and YAML strings
      const parsed = yaml.load(value);
      if (displayFormat === 'JSON') {
        setLocalValue(JSON.stringify(parsed, null, 2));
      } else {
        setLocalValue(yaml.dump(parsed));
      }
    } catch (e) {
      // If it fails to parse, fallback to the raw value
      setLocalValue(value);
    }
  }, [value, displayFormat, isXml, isGraphql]);

  const handleFormatToggle = () => {
    setDisplayFormat(prev => (prev === 'YAML' ? 'JSON' : 'YAML'));
  };

  // Detect if the CURRENT localValue looks like YAML, JSON, or XML
  let lang = 'YAML';
  if (isXml) {
    lang = 'XML';
  } else if (isGraphql) {
    lang = 'GRAPHQL';
  } else if (localValue.trimStart().startsWith('{')) {
    lang = 'JSON';
  }

  const handleDownload = () => {
    const ext = lang === 'GRAPHQL' ? 'graphql' : lang.toLowerCase();
    const blob = new Blob([localValue], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `source-definition.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={classes.editorContainer}>
      {/* VS Code-style title bar */}
      <div className={classes.editorHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography className={classes.editorLang}>
            definition.{lang.toLowerCase()}
          </Typography>
        </div>
        <div className={classes.editorActions}>
          {onUpdateClick && (
            <Tooltip title="Update definition">
              <Button
                id="swagger-update-btn"
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={onUpdateClick}
                style={editorActionButtonStyle}
              >
                Update Definition
              </Button>
            </Tooltip>
          )}

          {/* Format Toggle button (hidden for XML and GraphQL) */}
          {!isXml && !isGraphql && (
            <Tooltip
              title={`Convert to ${displayFormat === 'YAML' ? 'JSON' : 'YAML'}`}
            >
              <Button
                id="swagger-format-btn"
                size="small"
                variant="outlined"
                startIcon={<AutorenewIcon />}
                onClick={handleFormatToggle}
                style={editorActionButtonStyle}
              >
                Convert to {displayFormat === 'YAML' ? 'JSON' : 'YAML'}
              </Button>
            </Tooltip>
          )}

          {/* Download button */}
          <Tooltip title="Download definition">
            <Button
              id="swagger-download-btn"
              size="small"
              variant="outlined"
              startIcon={<GetAppIcon />}
              onClick={handleDownload}
              style={editorActionButtonStyle}
            >
              Download
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* The editor itself */}
      <div
        style={{
          height: Math.max(
            400,
            Math.min(800, (localValue || '').split('\n').length * 19 + 40),
          ),
        }}
      >
        <Editor
          language={lang.toLowerCase()}
          theme="vs-dark"
          value={localValue}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>

      {/* Bottom status bar like VS Code */}
      <Box
        style={{
          backgroundColor: '#007acc',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '2px 12px',
          fontSize: 11,
        }}
      >
        <span>
          {lang} | {(localValue || '').split('\n').length} lines
        </span>
      </Box>
    </div>
  );
};
