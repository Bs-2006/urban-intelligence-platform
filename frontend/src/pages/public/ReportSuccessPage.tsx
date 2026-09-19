import { Link, useLocation } from "react-router-dom";
import { CheckCircle, FileText, MapPin, AlertCircle, Search } from "lucide-react";

export default function ReportSuccessPage(){
  const loc=useLocation() as any;
  const d=loc.state;
  
  const incidentId = d?.id || null;
  
  return <div className="max-w-3xl mx-auto px-6 py-16">
    <div className="bg-white border border-surface-border shadow-sm rounded-2xl p-8 md:p-12">
      {/* Success Icon */}
      <div className="flex justify-center mb-6">
        <div className="bg-brand-50 rounded-full p-6">
          <CheckCircle size={64} className="text-brand" />
        </div>
      </div>

      {/* Success Message */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-ink mb-3">
          Complaint Submitted Successfully!
        </h1>
        <p className="text-ink-muted text-lg">
          Thank you for reporting. Your complaint has been forwarded to the authorities for review and action.
        </p>
      </div>

      {/* Complaint Details */}
      {d && (
        <div className="bg-surface-page border border-surface-border rounded-xl p-6 space-y-4 mb-8">
          <div className="flex items-center gap-2 text-ink font-semibold text-lg border-b border-surface-border pb-3">
            <FileText size={20} />
            <span>Complaint Details</span>
          </div>

          {/* Complaint ID - Highlighted */}
          {incidentId && (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
              <p className="text-sm text-brand-700 font-medium mb-1">Your Complaint ID</p>
              <p className="text-3xl font-bold text-ink">#{incidentId}</p>
              <p className="text-xs text-brand-700 mt-2">Save this ID to track your complaint status</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm text-ink-muted mb-1">Issue Type</p>
              <p className="font-semibold text-ink capitalize">{d.incident_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-1">Severity</p>
              <p className="font-semibold text-ink capitalize">{d.severity}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-1">Status</p>
              <p className="font-semibold text-ink capitalize">{d.status}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-1">Reported On</p>
              <p className="font-semibold text-ink">
                {d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Just now'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-ink-muted mb-1">Title</p>
            <p className="font-semibold text-ink">{d.title}</p>
          </div>

          {d.description && (
            <div>
              <p className="text-sm text-ink-muted mb-1">Description</p>
              <p className="text-ink">{d.description}</p>
            </div>
          )}

          <div className="flex items-start gap-2">
            <MapPin size={18} className="text-ink-muted mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-ink-muted mb-1">Location</p>
              <p className="font-medium text-ink">
                {d.location_name || d.address || `${d.latitude?.toFixed(4)}, ${d.longitude?.toFixed(4)}`}
              </p>
              {(d.location_name || d.address) && (
                <p className="text-xs text-ink-muted mt-1">
                  Coordinates: {d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)}
                </p>
              )}
            </div>
          </div>

          {/* Image Preview */}
          {(d.image_url || d.image_key) && (
            <div>
              <p className="text-sm text-ink-muted mb-2">Uploaded Photo</p>
              {d.image_url ? (
                <img 
                  src={d.image_url} 
                  alt="Incident evidence" 
                  className="rounded-lg border border-surface-border max-h-64 w-full object-cover"
                />
              ) : (
                <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle size={18} className="text-brand" />
                  <span className="text-sm text-brand-700">Photo uploaded successfully</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link 
          to="/track" 
          className="px-6 py-3 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
        >
          <Search size={20} />
          Track My Complaint
        </Link>
        <Link 
          to="/report" 
          className="px-6 py-3 bg-white text-ink border border-surface-border rounded-lg font-semibold hover:bg-brand-50 hover:border-brand transition-colors flex items-center justify-center gap-2"
        >
          <AlertCircle size={20} />
          Report Another Issue
        </Link>
        <Link 
          to="/" 
          className="px-6 py-3 border border-surface-border text-ink-muted rounded-lg font-semibold hover:bg-surface-page transition-colors flex items-center justify-center gap-2"
        >
          Back to Home
        </Link>
      </div>
    </div>

    {/* What Happens Next Section */}
    <div className="mt-8 bg-white border border-surface-border rounded-xl p-6 shadow-sm">
      <h3 className="font-bold text-lg text-ink mb-3">What Happens Next?</h3>
      <ol className="space-y-3 text-sm text-ink">
        <li className="flex gap-3">
          <span className="font-bold text-brand">1.</span>
          <span>Authorities will review your complaint and verify the details.</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-brand">2.</span>
          <span>If approved, it will be assigned to field workers for resolution.</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-brand">3.</span>
          <span>You can track the status anytime using your Complaint ID.</span>
        </li>
      </ol>
    </div>
  </div>;
}
