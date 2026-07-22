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
      let targetPath = redirectQuery || redirectSession || "/home";
      if (!targetPath.startsWith("/")) {
        targetPath = "/home";
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
    <div className="flex-1 min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-2xl shadow-xl border border-outline-variant z-10">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-6 h-6 text-on-primary" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">
            Nexus CRM
          </h1>
        </div>

        <h2 className="text-xl font-semibold text-center mb-2">Welcome back</h2>
        <p className="text-sm text-on-surface-variant text-center mb-8">
          Enter your credentials to access your workspace.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-error-container text-error rounded-lg text-sm font-medium border border-error/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-on-surface-variant" />
              </div>
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-on-surface-variant" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>
        
        <div className="mt-8 text-center border-t border-outline-variant pt-6">
          <p className="text-sm text-on-surface-variant">
            Default credentials:<br/>
            <span className="font-mono text-on-surface">admin@nexus.com / password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
