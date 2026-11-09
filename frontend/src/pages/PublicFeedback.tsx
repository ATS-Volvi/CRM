import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Building,
  User,
  MessageSquare,
  AlertCircle,
  Wrench,
  Check,
} from "lucide-react";

interface FeedbackData {
  id: string;
  workOrderId: string;
  workOrderNumber: string;
  subject: string;
  technicianName: string | null;
  preselectedRating: number;
  rating: number | null;
  comment: string | null;
  submittedAt: string | null;
  isAlreadySubmitted: boolean;
}

export default function PublicFeedback() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const queryRating = searchParams.get("rating");

  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    fetchFeedbackData();
  }, [token, queryRating]);

  const fetchFeedbackData = async () => {
    if (!token) {
      setErrorStatus(404);
      setErrorMessage("Missing feedback token.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);

      const ratingQuery = queryRating ? `?rating=${queryRating}` : "";
      const res = await fetch(`/api/v1/public/feedback/${token}${ratingQuery}`);

      if (!res.ok) {
        setErrorStatus(res.status);
        if (res.status === 410) {
          setErrorMessage("This feedback link has expired (past 30 days).");
        } else if (res.status === 404) {
          setErrorMessage("Invalid feedback link. Service record not found.");
        } else {
          setErrorMessage("Unable to load feedback request.");
        }
        setLoading(false);
        return;
      }

      const data: FeedbackData = await res.json();
      setFeedback(data);

      if (data.isAlreadySubmitted) {
        setSelectedRating(data.rating || 5);
        setComment(data.comment || "");
      } else {
        const initialRating = queryRating ? parseInt(queryRating, 10) : data.preselectedRating;
        if (!isNaN(initialRating) && initialRating >= 1 && initialRating <= 5) {
          setSelectedRating(initialRating);
        }
      }
    } catch (err: any) {
      setErrorStatus(500);
      setErrorMessage(err.message || "Failed to load feedback page.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || submitting) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/public/feedback/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: selectedRating,
          comment: comment.trim(),
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          setErrorStatus(410);
          setErrorMessage("This feedback link has expired.");
        } else if (res.status === 400 && resData.alreadySubmitted) {
          setFeedback((prev) =>
            prev
              ? {
                  ...prev,
                  isAlreadySubmitted: true,
                  rating: resData.rating || selectedRating,
                  submittedAt: resData.submittedAt || new Date().toISOString(),
                }
              : null
          );
        } else {
          alert(resData.error || "Failed to submit feedback.");
        }
        return;
      }

      setSubmittedSuccess(true);
      setFeedback((prev) =>
        prev
          ? {
              ...prev,
              isAlreadySubmitted: true,
              rating: selectedRating,
              comment: comment.trim(),
              submittedAt: new Date().toISOString(),
            }
          : null
      );
    } catch (err: any) {
      alert(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels: Record<number, string> = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

  const activeRating = hoverRating || selectedRating;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 antialiased font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-4 px-6 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold tracking-wider shadow-inner">
              N
            </div>
            <div>
              <span className="font-bold text-white tracking-wide text-sm block">
                NEXUS CRM
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Field Service Care
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60">
            <Building className="w-3.5 h-3.5 text-blue-400" />
            <span>Customer Experience Portal</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {loading ? (
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-600">
              Loading service details...
            </p>
          </div>
        ) : errorStatus ? (
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-8 sm:p-10 text-center space-y-4">
            <div
              className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                errorStatus === 410 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
              }`}
            >
              {errorStatus === 410 ? (
                <Clock className="w-7 h-7" />
              ) : (
                <AlertCircle className="w-7 h-7" />
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {errorStatus === 410
                ? "Feedback Window Expired"
                : errorStatus === 404
                ? "Feedback Request Not Found"
                : "Unable to Load Feedback"}
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">{errorMessage}</p>
          </div>
        ) : feedback?.isAlreadySubmitted || submittedSuccess ? (
          <div className="bg-white rounded-xl shadow-xs border border-emerald-100 p-8 sm:p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-900">
                {submittedSuccess ? "Thank You for Your Feedback!" : "Feedback Already Received"}
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {submittedSuccess
                  ? "Your ratings and comments have been recorded and shared with our service management team."
                  : "You have already submitted a rating for this service appointment. We truly appreciate your time!"}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 max-w-md mx-auto text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                <span className="text-slate-500">Work Order:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {feedback?.workOrderNumber}
                </span>
              </div>
              {feedback?.technicianName && (
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Technician:</span>
                  <span className="font-medium text-slate-800">
                    {feedback.technicianName}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                <span className="text-slate-500">Your Rating:</span>
                <div className="flex items-center gap-1 font-bold text-amber-500">
                  <span>{feedback?.rating || selectedRating} / 5</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= (feedback?.rating || selectedRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {feedback?.comment && (
                <div className="text-xs space-y-1 pt-1">
                  <span className="text-slate-500 block">Your Comment:</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-slate-200 text-xs italic">
                    "{feedback.comment}"
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
            {/* Header info badge */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100/60 p-5 sm:p-6">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 inline-block mb-2">
                Service Completion Review
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                How was your service experience?
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Help us ensure the highest standards by rating the service provided for{" "}
                <span className="font-semibold text-slate-800">
                  Work Order #{feedback?.workOrderNumber}
                </span>
                .
              </p>

              {feedback?.technicianName && (
                <div className="mt-3.5 flex items-center gap-2 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-blue-200/50 w-fit">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-slate-600">Assigned Technician:</span>
                  <span className="text-xs font-bold text-slate-900">
                    {feedback.technicianName}
                  </span>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6">
              {/* Star Rating Section */}
              <div className="text-center space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Select Your Overall Rating
                </label>
                <div className="flex items-center justify-center gap-2 pt-1 pb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 sm:p-2 rounded-lg hover:bg-amber-50/80 transition-all transform hover:scale-110 active:scale-95 focus:outline-hidden"
                      title={`${star} Star - ${ratingLabels[star]}`}
                    >
                      <Star
                        className={`w-9 h-9 sm:w-11 sm:h-11 transition-colors ${
                          star <= activeRating
                            ? "fill-amber-400 text-amber-500 drop-shadow-xs"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <div className="h-6">
                  <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 inline-block">
                    {activeRating} - {ratingLabels[activeRating]}
                  </span>
                </div>
              </div>

              {/* Comment Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="feedback-comment"
                    className="font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" /> Comments or Suggestions
                    (Optional)
                  </label>
                  <span
                    className={`text-[11px] ${
                      comment.length > 1900 ? "text-amber-600 font-bold" : "text-slate-400"
                    }`}
                  >
                    {comment.length} / 2000
                  </span>
                </div>
                <textarea
                  id="feedback-comment"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 2000))}
                  placeholder="Share details regarding technician punctuality, work quality, professionalism, or areas for improvement..."
                  className="w-full text-xs sm:text-sm p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all placeholder:text-slate-400 bg-white"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Feedback...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Rating & Comments</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200/80 bg-white">
        <p>&copy; {new Date().getFullYear()} Nexus CRM Field Service. All rights reserved.</p>
      </footer>
    </div>
  );
}
