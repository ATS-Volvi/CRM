import { useState, useEffect } from "react";
import { User, Phone, Mail, Award, Compass, DollarSign, Briefcase, FileSpreadsheet, Search } from "lucide-react";

interface Salesperson {
  id: string;
  name: string;
  role: string;
  isAvailable: boolean;
  maxOpenLeads: number;
  totalLeads: number;
  totalDeals: number;
  purchaseOrders: {
    id: string;
    poNumber: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
  wonClients: {
    id: string;
    name: string;
    company: string;
    email: string;
    status: string;
  }[];
  leadSources: { source: string; count: number }[];
  dealTypes: { stage: string; count: number }[];
}

export default function SalespersonTracker() {
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [selectedRep, setSelectedRep] = useState<Salesperson | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalespersons();
  }, []);

  const fetchSalespersons = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/v1/salespersons/performance", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSalespersons(data);
        if (data.length > 0) {
          setSelectedRep(data[0]);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const filteredReps = salespersons.filter((rep) =>
    rep.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in text-on-surface">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-display-sm font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Sales Performance Tracker
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Monitor sales representative metrics, won client portfolios, deal categories, and source analytics.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search salesperson..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-lg border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Salesperson List */}
          <div className="lg:col-span-1 bg-surface-container-low rounded-2xl border border-outline-variant p-6 space-y-4">
            <h2 className="text-title-md font-semibold mb-4">Representatives ({filteredReps.length})</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredReps.map((rep) => {
                const isSelected = selectedRep?.id === rep.id;
                return (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedRep(rep)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
                      isSelected
                        ? "bg-primary-container border-primary text-on-primary-container"
                        : "bg-surface hover:bg-surface-container-high border-outline-variant"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-body-lg">{rep.name}</div>
                          <div className="text-body-sm opacity-80 capitalize">{rep.role.replace("_", " ")}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-body-sm font-semibold">{rep.totalDeals} Deals</div>
                        <div className="text-body-xs opacity-75">{rep.totalLeads} Leads</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Dashboard */}
          {selectedRep && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-surface-container rounded-2xl border border-outline-variant p-8 space-y-8">
                {/* Header Profile Details */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-outline-variant pb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-headline-sm font-bold">
                      {selectedRep.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-headline-sm font-bold">{selectedRep.name}</h2>
                      <div className="flex items-center space-x-3 text-body-md text-on-surface-variant mt-1">
                        <span className="capitalize px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-body-xs font-semibold">
                          {selectedRep.role.replace("_", " ")}
                        </span>
                        <span>•</span>
                        <span className={selectedRep.isAvailable ? "text-green-500 font-semibold" : "text-amber-500 font-semibold"}>
                          {selectedRep.isAvailable ? "Available for assignment" : "Unavailable"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
                      <div className="text-body-xs text-on-surface-variant font-medium">Won POs</div>
                      <div className="text-title-lg font-bold text-primary">{selectedRep.purchaseOrders.length}</div>
                    </div>
                    <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
                      <div className="text-body-xs text-on-surface-variant font-medium">Clients</div>
                      <div className="text-title-lg font-bold text-secondary">{selectedRep.wonClients.length}</div>
                    </div>
                    <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center col-span-2 md:col-span-1">
                      <div className="text-body-xs text-on-surface-variant font-medium">Capacity Limit</div>
                      <div className="text-title-lg font-bold">{selectedRep.maxOpenLeads}</div>
                    </div>
                  </div>
                </div>

                {/* Subsections Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lead Sources Distribution */}
                  <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4">
                    <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
                      <Compass className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-body-lg">Lead Sources Distribution</h3>
                    </div>
                    <div className="space-y-3">
                      {selectedRep.leadSources.length === 0 ? (
                        <p className="text-body-sm text-on-surface-variant italic">No lead sources mapped.</p>
                      ) : (
                        selectedRep.leadSources.map((ls, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-body-sm">
                              <span className="font-medium">{ls.source}</span>
                              <span className="text-on-surface-variant font-semibold">{ls.count} leads</span>
                            </div>
                            <div className="w-full bg-surface-container rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${(ls.count / selectedRep.totalLeads) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Deal Category Mix */}
                  <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4">
                    <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
                      <Briefcase className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-body-lg">Deal Categories Mix</h3>
                    </div>
                    <div className="space-y-3">
                      {selectedRep.dealTypes.length === 0 ? (
                        <p className="text-body-sm text-on-surface-variant italic">No deals active or won yet.</p>
                      ) : (
                        selectedRep.dealTypes.map((dt, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-body-sm">
                              <span className="font-medium">{dt.stage}</span>
                              <span className="text-on-surface-variant font-semibold">{dt.count} deals</span>
                            </div>
                            <div className="w-full bg-surface-container rounded-full h-2">
                              <div
                                className="bg-secondary h-2 rounded-full"
                                style={{ width: `${(dt.count / selectedRep.totalDeals) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Purchase Orders Won */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-body-lg">Associated Purchase Orders ({selectedRep.purchaseOrders.length})</h3>
                  </div>
                  {selectedRep.purchaseOrders.length === 0 ? (
                    <p className="text-body-sm text-on-surface-variant italic">No won purchase orders associated yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-body-sm">
                        <thead>
                          <tr className="border-b border-outline-variant text-on-surface-variant font-medium">
                            <th className="py-2">PO Number</th>
                            <th className="py-2">Amount</th>
                            <th className="py-2">Status</th>
                            <th className="py-2">Generated Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRep.purchaseOrders.map((po) => (
                            <tr key={po.id} className="border-b border-outline-variant/50 hover:bg-surface-container-high transition-colors">
                              <td className="py-2.5 font-semibold text-primary">{po.poNumber}</td>
                              <td className="py-2.5 font-bold">${Number(po.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-body-xs font-semibold ${
                                  po.status === "Approved" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                                }`}>
                                  {po.status}
                                </span>
                              </td>
                              <td className="py-2.5 text-on-surface-variant">{new Date(po.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Won Clients */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
                    <Award className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-body-lg">Client Portfolio ({selectedRep.wonClients.length})</h3>
                  </div>
                  {selectedRep.wonClients.length === 0 ? (
                    <p className="text-body-sm text-on-surface-variant italic">No client accounts activated yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedRep.wonClients.map((client) => (
                        <div key={client.id} className="bg-surface p-4 rounded-xl border border-outline-variant flex flex-col justify-between space-y-2">
                          <div>
                            <div className="font-semibold text-body-md text-on-surface">{client.name}</div>
                            <div className="text-body-xs text-on-surface-variant font-medium">{client.company}</div>
                          </div>
                          <div className="flex items-center space-x-2 text-body-xs text-on-surface-variant font-semibold">
                            <Mail className="w-3.5 h-3.5 text-primary" />
                            <span>{client.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
