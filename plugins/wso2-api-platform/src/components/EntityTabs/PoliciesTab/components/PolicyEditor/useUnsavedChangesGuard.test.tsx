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

/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

function clickLink(href: string) {
  const anchor = document.createElement('a');
  anchor.href = href;
  document.body.appendChild(anchor);
  anchor.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
  );
  document.body.removeChild(anchor);
}

describe('useUnsavedChangesGuard', () => {
  function renderGuard(isDirty: boolean) {
    let currentPath = '';
    const LocationProbe = () => {
      currentPath = useLocation().pathname;
      return null;
    };
    const { result, rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty),
      {
        initialProps: { dirty: isDirty },
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/catalog/default/api/foo/policies']}>
            <Routes>
              <Route
                path="*"
                element={
                  <>
                    {children}
                    <LocationProbe />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        ),
      },
    );
    return { result, rerender, getPath: () => currentPath };
  }

  it('lets a same-origin navigation click through untouched when there are no unsaved changes', () => {
    const { result } = renderGuard(false);
    act(() => {
      clickLink('http://localhost/catalog/default/api/foo/definition');
    });
    expect(result.current.hasPendingNavigation).toBe(false);
  });

  it('intercepts a same-origin navigation click while dirty and exposes it as pending', () => {
    const { result } = renderGuard(true);
    act(() => {
      clickLink('http://localhost/catalog/default/api/foo/definition');
    });
    expect(result.current.hasPendingNavigation).toBe(true);
  });

  it('ignores a click that targets the current page (no real navigation)', () => {
    const { result } = renderGuard(true);
    act(() => {
      clickLink('http://localhost/catalog/default/api/foo/policies');
    });
    expect(result.current.hasPendingNavigation).toBe(false);
  });

  it('navigates to the intercepted destination once the pending navigation is confirmed', () => {
    const { result, getPath } = renderGuard(true);
    act(() => {
      clickLink('http://localhost/catalog/default/api/foo/definition');
    });
    expect(result.current.hasPendingNavigation).toBe(true);

    act(() => {
      result.current.proceedWithPendingNavigation();
    });
    expect(result.current.hasPendingNavigation).toBe(false);
    expect(getPath()).toBe('/catalog/default/api/foo/definition');
  });

  it('discards the pending navigation and stays put when cancelled', () => {
    const { result, getPath } = renderGuard(true);
    act(() => {
      clickLink('http://localhost/catalog/default/api/foo/docs');
    });
    expect(result.current.hasPendingNavigation).toBe(true);

    act(() => {
      result.current.cancelPendingNavigation();
    });
    expect(result.current.hasPendingNavigation).toBe(false);
    expect(getPath()).toBe('/catalog/default/api/foo/policies');
  });
});
