import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-16 bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xl animate-fade-in">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              {this.state.error?.message || "An unexpected error occurred while rendering this page component."}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
