/** @jest-environment jsdom */
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

import { act, render, screen } from '@testing-library/react';
import { SwaggerDefinitionPreview } from './SwaggerDefinitionPreview';

/** Advances fake timers and flushes the resulting state update synchronously. */
function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: ({ spec, supportedSubmitMethods }: any) => (
    <div
      data-testid="swagger-ui"
      data-supported-submit-methods={JSON.stringify(supportedSubmitMethods)}
    >
      {JSON.stringify(spec)}
    </div>
  ),
}));
jest.mock('swagger-ui-react/swagger-ui.css', () => ({}));

const VALID_SPEC = 'openapi: 3.0.0\ninfo:\n  title: Orders\n  version: "1.0"\n';
// js-yaml throws on an unterminated flow sequence.
const UNPARSABLE_YAML = 'foo: [1, 2';

describe('SwaggerDefinitionPreview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders SwaggerUI with the parsed spec after the debounce elapses', () => {
    render(<SwaggerDefinitionPreview content={VALID_SPEC} height={400} />);

    advance(300);

    const swaggerUi = screen.getByTestId('swagger-ui');
    expect(JSON.parse(swaggerUi.textContent!)).toMatchObject({
      openapi: '3.0.0',
      info: { title: 'Orders' },
    });
    expect(screen.queryByTestId('swagger-preview-error')).toBeNull();
  });

  it('shows an error banner for unparsable YAML, with no SwaggerUI to fall back on', () => {
    render(<SwaggerDefinitionPreview content={UNPARSABLE_YAML} height={400} />);
    advance(300);

    expect(screen.getByTestId('swagger-preview-error')).toBeDefined();
    expect(screen.queryByTestId('swagger-ui')).toBeNull();
  });

  it('flags valid YAML that is missing an openapi/swagger version field', () => {
    render(
      <SwaggerDefinitionPreview content="title: Not a spec" height={400} />,
    );
    advance(300);

    expect(screen.getByTestId('swagger-preview-error').textContent).toMatch(
      /openapi.*swagger/i,
    );
  });

  it('keeps the last valid spec rendered and overlays an error banner once an edit breaks it', () => {
    const { rerender } = render(
      <SwaggerDefinitionPreview content={VALID_SPEC} height={400} />,
    );
    advance(300);
    expect(screen.getByTestId('swagger-ui')).toBeDefined();

    rerender(
      <SwaggerDefinitionPreview content={UNPARSABLE_YAML} height={400} />,
    );
    advance(300);

    // The previously-valid spec is still shown underneath the error banner.
    expect(screen.getByTestId('swagger-ui')).toBeDefined();
    expect(screen.getByTestId('swagger-preview-error')).toBeDefined();
  });

  it('debounces rapid edits, only re-rendering once typing settles', () => {
    const { rerender } = render(
      <SwaggerDefinitionPreview content="title: v1" height={400} />,
    );
    advance(300);
    expect(screen.getByTestId('swagger-preview-error')).toBeDefined();

    rerender(<SwaggerDefinitionPreview content={VALID_SPEC} height={400} />);
    // Before the debounce elapses, the stale (invalid) state still shows.
    advance(100);
    expect(screen.getByTestId('swagger-preview-error')).toBeDefined();

    advance(200);
    expect(screen.queryByTestId('swagger-preview-error')).toBeNull();
    expect(screen.getByTestId('swagger-ui')).toBeDefined();
  });

  it('shows an error for empty content, with no SwaggerUI to fall back on', () => {
    render(<SwaggerDefinitionPreview content="" height={400} />);
    advance(300);

    expect(screen.getByTestId('swagger-preview-error')).toBeDefined();
    expect(screen.queryByTestId('swagger-ui')).toBeNull();
  });

  it('renders SwaggerUI with an empty supportedSubmitMethods, disabling Try it out', () => {
    render(<SwaggerDefinitionPreview content={VALID_SPEC} height={400} />);
    advance(300);

    expect(
      screen
        .getByTestId('swagger-ui')
        .getAttribute('data-supported-submit-methods'),
    ).toBe('[]');
  });

  it('reports validity changes via onValidityChange', () => {
    const onValidityChange = jest.fn();
    const { rerender } = render(
      <SwaggerDefinitionPreview
        content={VALID_SPEC}
        height={400}
        onValidityChange={onValidityChange}
      />,
    );
    advance(300);
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    rerender(
      <SwaggerDefinitionPreview
        content={UNPARSABLE_YAML}
        height={400}
        onValidityChange={onValidityChange}
      />,
    );
    advance(300);
    expect(onValidityChange).toHaveBeenLastCalledWith(true);

    rerender(
      <SwaggerDefinitionPreview
        content={VALID_SPEC}
        height={400}
        onValidityChange={onValidityChange}
      />,
    );
    advance(300);
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });
});
