import React from 'react';
import * as Sentry from "@sentry/react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
    try {
      Sentry.captureException(error, { extra: errorInfo });
    } catch (e) {
      // Ignored if Sentry not initialized
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-[#1C1917] border border-[#3E3835] rounded-xl text-center shadow-lg max-w-sm mx-auto my-4 animate-slide-in">
          <div className="inline-flex w-10 h-10 rounded-lg bg-red-500/10 text-red-400 items-center justify-center text-lg mb-3 select-none">
            ⚠️
          </div>
          <h3 className="text-sm font-bold text-white mb-1.5">Component Recovered</h3>
          <p className="text-[11px] text-[#A8A29E] leading-relaxed mb-4">
            An unexpected error occurred in this view. The system isolated the fault to keep the rest of the CRM operational.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3.5 py-1.5 bg-[#3D3530] hover:bg-[#4E443F] text-xs font-semibold text-white rounded-lg transition-all cursor-pointer"
          >
            Retry Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
