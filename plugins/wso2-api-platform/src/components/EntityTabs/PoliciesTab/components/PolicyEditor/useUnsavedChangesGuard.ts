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

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Intercepts in-app navigation away from the current page while `isDirty`,
 * so the caller can show its own "unsaved changes" confirmation instead of
 * silently losing local edits.
 *
 * This app runs under a plain `<BrowserRouter>` (no data router), so React
 * Router's `useBlocker`/`unstable_usePrompt` aren't available — those only
 * work with `RouterProvider`. Every other tab (Overview/Definition/TryOut/
 * Docs) and the "back to API Manager" breadcrumb are real routes rendered
 * as `<a href>` links by Backstage's own catalog-page/breadcrumb
 * components, outside this plugin's control, so the only viable
 * interception point is a capture-phase `click` listener on `document`:
 * it runs before the click ever reaches those links' own react-router
 * click handler, letting us `preventDefault()` the navigation and decide
 * what happens next ourselves.
 *
 * A hard reload/tab-close (which no click-listener can catch) is separately
 * covered by the standard `beforeunload` guard, which shows the browser's
 * own native confirmation instead of a custom dialog.
 *
 * Not covered: browser back/forward and direct address-bar navigation —
 * those don't originate from a click and aren't interceptable without a
 * data router.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  // Compared against on every click via a ref, not a `useLocation()`
  // dependency on the listener effect, so the capture-phase listener stays
  // attached across route changes instead of being torn down and re-added.
  const locationRef = useRef(location);
  locationRef.current = location;

  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    function onClickCapture(event: MouseEvent) {
      if (!isDirtyRef.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== '_self')) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) {
        return;
      }

      const destination = `${url.pathname}${url.search}${url.hash}`;
      const { pathname, search, hash } = locationRef.current;
      if (destination === `${pathname}${search}${hash}`) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingPath(destination);
    }

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const proceedWithPendingNavigation = () => {
    const destination = pendingPath;
    setPendingPath(null);
    if (destination) {
      navigate(destination);
    }
  };

  const cancelPendingNavigation = () => setPendingPath(null);

  return {
    hasPendingNavigation: pendingPath !== null,
    proceedWithPendingNavigation,
    cancelPendingNavigation,
  };
}
