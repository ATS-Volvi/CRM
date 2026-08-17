import { MasterDataSidebar } from "../../components/MasterDataNav";
import { Outlet } from "react-router-dom";

/**
 * MasterDataShell — layout wrapper for all /master-data/* routes.
 * Renders the left sidebar + the page content via <Outlet />.
 */
export default function MasterDataShell() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Sidebar */}
      <div className="w-56 shrink-0 bg-white border-r border-slate-200 pt-8 pb-8 px-4">
        <MasterDataSidebar />
      </div>

      {/* Page Content (routed via Outlet) */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
