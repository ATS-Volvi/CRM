import React, { useState, useEffect, useMemo } from "react";
import {
  Compass,
  MapPin,
  Clock,
  Fuel,
  ArrowRight,
  TrendingDown,
  Navigation,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { SiteInspectionRecord } from "../lib/siteInspection";
import { siteInspectionApi } from "../api/siteInspection";
import { clientOptimizeDailyRoute, ClientRouteResult } from "../utils/routeOptimizer";

interface SiteInspectionRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspections: SiteInspectionRecord[];
  onApplySequence?: (sortedIds: string[]) => void;
}

export const SiteInspectionRouteModal: React.FC<SiteInspectionRouteModalProps> = ({
  isOpen,
  onClose,
  inspections,
  onApplySequence
}) => {
  const [mode, setMode] = useState<"SHORTEST_DISTANCE" | "SLA_GUARDED">("SHORTEST_DISTANCE");
  const [returnToBase, setReturnToBase] = useState<boolean>(true);
  const [isUsingLiveGps, setIsUsingLiveGps] = useState<boolean>(false);
  const [liveGpsCoords, setLiveGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<any>(null);
  const [isLoadingServer, setIsLoadingServer] = useState<boolean>(false);

  // Filter to eligible scheduled/todo inspections
  const activeInspections = useMemo(() => {
    return inspections.filter(
      (ins) => ins.status === "REQUESTED" || ins.status === "DRAFT" || ins.status === "CHANGES_REQUESTED"
    );
  }, [inspections]);

  // Request Live GPS
  const handleToggleLiveGps = () => {
    if (!isUsingLiveGps) {
      if (!navigator.geolocation) {
        setGpsError("Geolocation is not supported by your browser");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLiveGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          setIsUsingLiveGps(true);
          setGpsError(null);
        },
        (err) => {
          setGpsError(`Unable to retrieve GPS: ${err.message}`);
        }
      );
    } else {
      setIsUsingLiveGps(false);
      setLiveGpsCoords(null);
    }
  };

  // Compute Client-Side Route (Instant & 100% Offline Capable)
  const clientResult = useMemo<ClientRouteResult>(() => {
    const startLocation = isUsingLiveGps && liveGpsCoords
      ? { name: "Current GPS Position", latitude: liveGpsCoords.latitude, longitude: liveGpsCoords.longitude }
      : { name: "Jafurah Operations Base", latitude: 25.55, longitude: 49.85 };

    return clientOptimizeDailyRoute(activeInspections, {
      startLocation,
      returnToBase,
      mode
    });
  }, [activeInspections, isUsingLiveGps, liveGpsCoords, returnToBase, mode]);

  // Try fetching backend calculation when online; fallback gracefully to clientResult if offline
  useEffect(() => {
    if (!isOpen || activeInspections.length === 0) return;

    let isMounted = true;
    setIsLoadingServer(true);

    const startLocation = isUsingLiveGps && liveGpsCoords
      ? { name: "Current GPS Position", latitude: liveGpsCoords.latitude, longitude: liveGpsCoords.longitude }
      : undefined;

    siteInspectionApi
      .optimizeRoute({
        inspectionIds: activeInspections.map((i) => i.id),
        startLocation,
        returnToBase,
        mode
      })
      .then((res) => {
        if (isMounted && res.success) {
          setServerResult(res);
        }
      })
      .catch((err) => {
        // Safe offline fallback: clientResult is used automatically
        console.warn("[SiteInspectionRouteModal] Server optimization unavailable, using local offline calculation:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingServer(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeInspections, isUsingLiveGps, liveGpsCoords, returnToBase, mode]);

  const activeResult = serverResult || clientResult;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-face-line dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="p-6 bg-linear-to-r from-face-green/10 via-emerald-500/5 to-transparent border-b border-face-line dark:border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-face-green/20 text-face-green dark:text-face-green-mint flex items-center justify-center shrink-0 shadow-inner">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-face-ink dark:text-white">
                  Daily Multi-Site Route Optimizer
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Fuel & Time Saver
                </span>
              </div>
              <p className="text-xs text-face-muted mt-0.5">
                Automatically calculates the shortest driving loop for your {activeInspections.length} scheduled sites.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-face-muted hover:text-face-ink hover:bg-face-field dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Controls Bar: Mode & Origin */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-face-field/70 dark:bg-slate-800/40 border border-face-line dark:border-slate-800">
            {/* Strategy Mode Toggle */}
            <div>
              <label className="text-xs font-bold text-face-muted block mb-2 uppercase tracking-wider">
                Routing Strategy
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-face-line dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode("SHORTEST_DISTANCE")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === "SHORTEST_DISTANCE"
                      ? "bg-face-green text-white shadow-xs"
                      : "text-face-muted hover:text-face-ink dark:hover:text-white"
                  }`}
                >
                  ⚡ Shortest Distance
                </button>
                <button
                  type="button"
                  onClick={() => setMode("SLA_GUARDED")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === "SLA_GUARDED"
                      ? "bg-face-green text-white shadow-xs"
                      : "text-face-muted hover:text-face-ink dark:hover:text-white"
                  }`}
                >
                  🛡️ SLA Guarded
                </button>
              </div>
            </div>

            {/* Starting Origin & Return Toggle */}
            <div className="flex flex-col justify-between">
              <label className="text-xs font-bold text-face-muted block mb-1 uppercase tracking-wider">
                Starting Location & Return
              </label>
              <div className="flex items-center justify-between gap-3 mt-1">
                <button
                  type="button"
                  onClick={handleToggleLiveGps}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    isUsingLiveGps
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300"
                      : "bg-white dark:bg-slate-900 border-face-line dark:border-slate-700 text-face-ink dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{isUsingLiveGps ? "Using Live GPS" : "Use Live Mobile GPS"}</span>
                </button>

                <label className="flex items-center gap-2 text-xs font-bold text-face-ink dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnToBase}
                    onChange={(e) => setReturnToBase(e.target.checked)}
                    className="rounded accent-face-green"
                  />
                  <span>Return to Base</span>
                </label>
              </div>
              {gpsError && <p className="text-[11px] text-face-red mt-1">{gpsError}</p>}
            </div>
          </div>

          {/* Efficiency Savings Banner */}
          {activeResult.distanceSavedKm > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300/80 dark:border-emerald-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                    Optimal Route Saves {activeResult.distanceSavedKm} km
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5">
                    Saves approximately <strong className="font-extrabold">{activeResult.fuelSavedLitres} L Diesel</strong> and <strong className="font-extrabold">{activeResult.timeSavedMinutes} minutes</strong> driving vs unorganized sequence.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Metrics 4-Card Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-face-field/70 dark:bg-slate-800/40 border border-face-line dark:border-slate-800 text-center">
              <span className="text-[11px] uppercase font-bold text-face-muted tracking-wider block">Total Distance</span>
              <span className="text-lg font-black text-face-ink dark:text-white mt-1 block">
                {activeResult.totalDistanceKm} km
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-face-field/70 dark:bg-slate-800/40 border border-face-line dark:border-slate-800 text-center">
              <span className="text-[11px] uppercase font-bold text-face-muted tracking-wider block">Est. Driving Time</span>
              <span className="text-lg font-black text-face-ink dark:text-white mt-1 block">
                {Math.floor(activeResult.totalEstimatedMinutes / 60)}h {activeResult.totalEstimatedMinutes % 60}m
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-face-field/70 dark:bg-slate-800/40 border border-face-line dark:border-slate-800 text-center">
              <span className="text-[11px] uppercase font-bold text-face-muted tracking-wider block">Diesel Estimate</span>
              <span className="text-lg font-black text-face-ink dark:text-white mt-1 block">
                ~{activeResult.estimatedFuelLitres} L
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-face-field/70 dark:bg-slate-800/40 border border-face-line dark:border-slate-800 text-center">
              <span className="text-[11px] uppercase font-bold text-face-muted tracking-wider block">Stops Ordered</span>
              <span className="text-lg font-black text-face-green dark:text-face-green-mint mt-1 block">
                {activeResult.optimizedOrder.length} Sites
              </span>
            </div>
          </div>

          {/* Leg-by-Leg Itinerary Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-face-ink dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Recommended Stop Sequence</span>
              </h3>
              <span className="text-xs text-face-muted font-medium">
                Start: {isUsingLiveGps ? "Current GPS" : "Operations Base"}
              </span>
            </div>

            <div className="space-y-2.5">
              {activeResult.optimizedOrder.map((stop: any, idx: number) => {
                const leg = activeResult.legs[idx];
                const isUrgent = stop.priority === "URGENT";

                return (
                  <div
                    key={stop.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-face-line dark:border-slate-800 hover:border-face-green/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      {/* Step Number Badge */}
                      <div className="w-8 h-8 rounded-xl bg-face-green text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-face-ink dark:text-white">
                            {stop.clientName}
                          </h4>
                          <span className="font-mono text-[11px] font-bold text-face-muted">
                            ({stop.inspectionNumber})
                          </span>
                          {isUrgent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-face-red-light text-face-red uppercase">
                              Urgent
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-face-muted font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-face-muted shrink-0" />
                          <span>{stop.areaName || stop.siteName}</span>
                          {stop.resolvedSource === "REGION_FALLBACK" && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                              City Area Approx
                            </span>
                          )}
                          {!stop.hasCoordinates && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700">
                              ⚠️ GPS Pin Missing
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Travel Leg Metrics */}
                    {leg && (
                      <div className="flex items-center gap-2 text-xs font-bold text-face-muted self-end sm:self-center bg-face-field/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl">
                        <span>{leg.distanceKm} km</span>
                        <span>•</span>
                        <span>~{leg.estimatedMinutes} min drive</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Return to Base Leg Indicator */}
              {returnToBase && activeResult.legs.length > activeResult.optimizedOrder.length && (
                <div className="p-3 rounded-2xl bg-face-field/50 dark:bg-slate-800/20 border border-dashed border-face-line dark:border-slate-800 flex items-center justify-between text-xs text-face-muted font-bold px-4">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-face-green" />
                    <span>Return Leg: Back to Base</span>
                  </div>
                  <span>
                    {activeResult.legs[activeResult.legs.length - 1]?.distanceKm} km (~{activeResult.legs[activeResult.legs.length - 1]?.estimatedMinutes} min)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 bg-face-field/70 dark:bg-slate-800/50 border-t border-face-line dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-face-muted font-medium">
            {activeResult.unresolvedCount > 0 ? (
              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {activeResult.unresolvedCount} site(s) missing coordinates were placed at the end.
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All {activeResult.optimizedOrder.length} site coordinates resolved accurately.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Launch Google Maps Multi-Stop Navigation */}
            {activeResult.googleMapsUrl && (
              <a
                href={activeResult.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer w-full sm:w-auto"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
              </a>
            )}

            {/* Apply Sequence To Cards */}
            {onApplySequence && (
              <button
                type="button"
                onClick={() => {
                  onApplySequence(activeResult.optimizedOrder.map((s: any) => s.id));
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-face-green hover:bg-face-green-dark text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer w-full sm:w-auto"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply Sequence Order</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
