import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Sparkles, ArrowRight, Lock, Mail } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText})`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Login failed (${res.status})`);
      }

      login(data.token, data.user);
      
      const queryParams = new URLSearchParams(window.location.search);
      const redirectQuery = queryParams.get("redirect");
      const redirectSession = sessionStorage.getItem("redirect_to");
      let targetPath = redirectQuery || redirectSession || "/";
      if (!targetPath.startsWith("/")) {
        targetPath = "/";
      }
      
      sessionStorage.removeItem("redirect_to");
      try {
        navigate(targetPath);
      } catch (navErr) {
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-min-dvh w-full flex flex-col justify-center items-center bg-slate-50 text-slate-900 safe-top safe-bottom-bar px-4 py-6 relative overflow-y-auto">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/90 z-10 my-auto">
        <div className="flex items-center gap-2.5 mb-4 sm:mb-6 justify-center">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Nexus CRM
          </h1>
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-center text-slate-900 mb-1">Welcome back</h2>
        <p className="text-xs sm:text-sm text-slate-500 text-center mb-4 sm:mb-6">
          Enter your credentials to access your workspace.
        </p>

        {error && (
          <div className="mb-4 sm:mb-5 p-3 bg-red-50 text-red-700 rounded-xl text-xs sm:text-sm font-medium border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 sm:py-3 bg-blue-600 text-white text-sm sm:text-base font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </form>
        
        <div className="mt-5 sm:mt-6 text-center border-t border-slate-200 pt-3.5 sm:pt-4 space-y-2">
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
            Quick-Fill Demo Accounts (Password: <span className="font-mono text-blue-600 font-bold">password123</span>)
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => { setEmail("admin@nexus.com"); setPassword("password123"); }}
              className="px-2.5 py-1 text-[11px] sm:text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              Admin (admin@nexus.com)
            </button>
            <button
              type="button"
              onClick={() => { setEmail("salesperson1@nexus.com"); setPassword("password123"); }}
              className="px-2.5 py-1 text-[11px] sm:text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Rep 1 (salesperson1@nexus.com)
            </button>
            <button
              type="button"
              onClick={() => { setEmail("salesperson2@nexus.com"); setPassword("password123"); }}
              className="px-2.5 py-1 text-[11px] sm:text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors cursor-pointer"
            >
              Rep 2 (salesperson2@nexus.com)
            </button>
            <button
              type="button"
              onClick={() => { setEmail("site_manager@nexus.com"); setPassword("password123"); }}
              className="px-2.5 py-1 text-[11px] sm:text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              Inspector (site_manager@nexus.com)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
