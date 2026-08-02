// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Component, type ReactNode, type ErrorInfo } from 'react'
import { makeT, detectSystemLocale } from '../../../i18n'
import { Button } from '../Button'
import './error-boundary.css'

interface ErrorBoundaryProps {
  children: ReactNode
  // A render throw below this boundary swaps in the fallback instead of unmounting the whole tree to a
  // white screen. Omit for the full-app fallback; pass a scoped node for a per-region boundary.
  fallback?: ReactNode
}

interface ErrorBoundaryState { error: Error | null }

// The whole-app fallback. Localizes via makeT (not the useI18n hook) because the top-level boundary
// sits ABOVE I18nProvider: a provider-level render throw would leave the hook context gone. The caught
// message is shown so an alpha tester can report the failure (act-or-report, not a silent swallow).
function AppErrorFallback({ error }: { error: Error }) {
  const t = makeT(detectSystemLocale())

  return (
    <div className="error-boundary" role="alert">
      <div className="error-boundary-title">{t('app.error.title')}</div>
      <div className="error-boundary-body">{t('app.error.body')}</div>
      <pre className="error-boundary-tech">{error.message}</pre>
      <Button variant="primary" onClick={() => window.location.reload()}>{t('app.error.reload')}</Button>
    </div>
  )
}

// What broke, never the message shown above it: that message is written by whatever threw and can
// name a printer, a file on this machine or something the user typed. A screen that just fell over is
// no place to also fail at reporting, so the send is fire and forget in both directions.
function reportRenderFailureToUsage(error: Error): void {
  window.b3d?.analytics
    .reportRenderFailure(error.constructor?.name ?? error.name)
    .catch((unreported: unknown) => console.warn('render failure went unreported', unreported))
}

// The renderer's one class component: a React error boundary must be a class. It catches a render throw
// from any descendant and shows a recoverable fallback, so a single bad render never white-screens the
// app (printer-base-functions-non-negotiable, at the UI layer).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  // getDerivedStateFromError already swaps in the visible fallback; this logs the stack so an alpha
  // tester's bug report carries the cause the generic fallback message hides.
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught a render error', error, info.componentStack)
    reportRenderFailureToUsage(error)
  }

  render() {
    if (this.state.error) return this.props.fallback ?? <AppErrorFallback error={this.state.error} />

    return this.props.children
  }
}
