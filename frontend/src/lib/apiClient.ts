let logoutCallback: (() => void) | null = null;

export const setLogoutCallback = (cb: () => void) => {
  logoutCallback = cb;
};

export interface ApiOptions extends RequestInit {
  // Add custom options if needed
}

export async function apiClient(path: string, options: ApiOptions = {}): Promise<Response> {
  const token = localStorage.getItem("nexus_token");
  
  const headers = new Headers(options.headers || {});
  
  // Set JSON content type by default if sending body, unless content-type is already specified
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const res = await fetch(path, {
    ...options,
    headers,
  });
  
  if (res.status === 401) {
    let isExpiredOrInvalid = false;
    try {
      const clone = res.clone();
      const body = await clone.json();
      if (body && (body.error === "TokenExpired" || body.error?.includes("Unauthorized") || body.error?.includes("token"))) {
        isExpiredOrInvalid = true;
      }
    } catch (e) {
      // If we can't parse JSON, assume it is standard 401
      isExpiredOrInvalid = true;
    }
    
    if (isExpiredOrInvalid) {
      if (logoutCallback) {
        logoutCallback();
      } else {
        localStorage.removeItem("nexus_token");
        localStorage.removeItem("nexus_user");
      }
      
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== "/login") {
        sessionStorage.setItem("redirect_to", currentPath);
        // Avoid infinite redirects if already redirecting
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
  }
  
  return res;
}
