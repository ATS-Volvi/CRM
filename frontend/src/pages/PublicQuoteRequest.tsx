import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export default function PublicQuoteRequest() {
  const [searchParams] = useSearchParams();
  const sourceParam = searchParams.get("source") || "website";
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    source: sourceParam
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Calling the local API. If deployed, this assumes standard relative path proxying or CORS.
      const response = await fetch("/api/v1/public/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit request.");
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl shadow-xl p-8 text-center border border-outline-variant transform transition-all animate-in fade-in zoom-in duration-500">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-container text-primary mb-6">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-display-sm font-bold text-on-surface mb-2">Thank You!</h2>
          <p className="text-body-lg text-on-surface-variant mb-6">
            Your request has been successfully received. Our team will get back to you shortly.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-primary text-on-primary rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl w-full bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant">
        <div className="bg-primary px-8 py-10 text-center relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          
          <h1 className="text-display-sm font-bold text-on-primary relative z-10 mb-2">Request a Quote</h1>
          <p className="text-primary-container text-body-lg relative z-10 max-w-sm mx-auto">
            Fill out the form below and our experts will reach out to you with a tailored solution.
          </p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-sm font-medium border border-error/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <input type="hidden" name="source" value={formData.source} />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="block text-sm font-semibold text-on-surface">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  placeholder="John"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="block text-sm font-semibold text-on-surface">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-on-surface">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="phone" className="block text-sm font-semibold text-on-surface">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="company" className="block text-sm font-semibold text-on-surface">Company Name</label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Acme Corp"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="message" className="block text-sm font-semibold text-on-surface">How can we help you?</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={formData.message}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none resize-none"
                placeholder="Tell us about your project or requirements..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg shadow-lg transition-all
                ${isSubmitting 
                  ? 'bg-primary/70 cursor-not-allowed' 
                  : 'bg-primary hover:bg-primary/90 hover:shadow-primary/25 active:scale-[0.98]'
                }`}
            >
              {isSubmitting ? "Submitting..." : "Request a Quote"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
