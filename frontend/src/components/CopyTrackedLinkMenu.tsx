import React, { useState, useRef, useEffect } from "react";
import {
  Link2,
  Copy,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Share2,
  Info
} from "lucide-react";
import {
  TRACKED_CHANNELS,
  buildTrackedCampaignUrl,
  SupportedTrackedChannel,
  DEFAULT_PUBLIC_QUOTE_URL
} from "../utils/campaignTrackingUrl";

interface CopyTrackedLinkMenuProps {
  campaignCode?: string | null;
  campaignName?: string;
  defaultChannel?: string;
}

export function CopyTrackedLinkMenu({
  campaignCode,
  campaignName,
  defaultChannel
}: CopyTrackedLinkMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<SupportedTrackedChannel>("WhatsApp");
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasCode = Boolean(campaignCode && campaignCode.trim());

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Sync default channel if provided
  useEffect(() => {
    if (defaultChannel) {
      const match = TRACKED_CHANNELS.find(
        (c) => c.channel.toLowerCase() === defaultChannel.toLowerCase()
      );
      if (match) setSelectedChannel(match.channel);
    }
  }, [defaultChannel]);

  const activeChannelConfig =
    TRACKED_CHANNELS.find((c) => c.channel === selectedChannel) || TRACKED_CHANNELS[0];

  const currentUrl = hasCode && campaignCode
    ? buildTrackedCampaignUrl(campaignCode, activeChannelConfig.source, activeChannelConfig.medium)
    : "";

  const handleCopy = async (channel: SupportedTrackedChannel, url: string) => {
    if (!url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedChannel(channel);
      setToastMessage(`Copied ${channel} tracked link to clipboard!`);

      setTimeout(() => {
        setCopiedChannel(null);
      }, 2500);

      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      console.error("Failed to copy tracked link:", err);
    }
  };

  if (!hasCode) {
    return (
      <div className="relative inline-block" title="Campaign has no code. Set a unique campaign code to generate tracked links.">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-60 shadow-2xs"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Copy tracked link</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl text-xs font-bold border border-slate-700/50 dark:border-slate-300 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Trigger Button */}
      <div className="inline-flex rounded-xl shadow-2xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <button
          type="button"
          onClick={() => handleCopy(selectedChannel, currentUrl)}
          className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-l-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          title={`Quick copy tracked link for ${selectedChannel}`}
        >
          {copiedChannel === selectedChannel ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Copy tracked link</span>
            </>
          )}
        </button>

        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className="px-2 py-2 border-l border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-r-xl transition-colors cursor-pointer"
          title="Choose channel for tracked link"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              <Share2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Copy Tracked Link</span>
            </div>
            <span className="font-campaign-code text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {campaignCode}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Select a channel to copy a pre-configured quote link with exact attribution UTM parameters.
          </p>

          {/* Channel Selector Pills */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl">
            {TRACKED_CHANNELS.map((ch) => {
              const isSelected = selectedChannel === ch.channel;
              return (
                <button
                  key={ch.channel}
                  type="button"
                  onClick={() => setSelectedChannel(ch.channel)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>

          {/* Generated URL Display & Verification */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span>Generated Destination URL:</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Readonly</span>
            </div>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={currentUrl}
                aria-label={`Tracked link for ${selectedChannel}`}
                className="w-full px-3 py-2 pr-16 text-[11px] font-campaign-code bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl focus:outline-none select-all"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={() => handleCopy(selectedChannel, currentUrl)}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                title="Copy URL"
              >
                {copiedChannel === selectedChannel ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-white" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Breakdown of UTM tags */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 text-[10px] space-y-1 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-600 dark:text-slate-300">utm_campaign:</span>
              <span className="font-campaign-code text-slate-800 dark:text-slate-200">{campaignCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-600 dark:text-slate-300">utm_source:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{activeChannelConfig.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-600 dark:text-slate-300">utm_medium:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{activeChannelConfig.medium}</span>
            </div>
          </div>

          {/* Quick Copy Channel List */}
          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
              Quick Copy Other Channels:
            </span>
            {TRACKED_CHANNELS.map((ch) => {
              if (ch.channel === selectedChannel) return null;
              const chUrl = buildTrackedCampaignUrl(campaignCode || "", ch.source, ch.medium);
              return (
                <div
                  key={ch.channel}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {ch.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(ch.channel, chUrl)}
                    className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedChannel === ch.channel ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedChannel === ch.channel ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
