import { Link, useLocation } from "react-router-dom";
import { CheckCircle, FileText, MapPin, AlertCircle, Search } from "lucide-react";

export default function ReportSuccessPage(){
  const loc=useLocation() as any;
  const d=loc.state;
  
  const incidentId = d?.id || null;
  
  return <div className="max-w-3xl mx-auto px-6 py-16">
    <div className="bg-white border-2 border-green-200 rounded-2xl p-8 md:p-12">
      {/* Success Icon */}
      <div className="flex justify-center mb-6">
        <div className="bg-green-100 rounded-full p-6">
          <CheckCircle size={64} className="text-green-600" />
        </div>
      </div>

      {/* Success Message */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
          Complaint Submitted Successfully!
        </h1>
        <p className="text-slate-600 text-lg">
          Thank you for reporting. Your complaint has been forwarded to the authorities for review and action.
        </p>
      </div>

      {/* Complaint Details */}
      {d && (
        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6 space-y-4 mb-8">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-lg border-b border-slate-300 pb-3">
            <FileText size={20} />
            <span>Complaint Details</span>
          </div>

          {/* Complaint ID - Highlighted */}
          {incidentId && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-1">Your Complaint ID</p>
              <p className="text-3xl font-bold text-blue-900">#{incidentId}</p>
              <p className="text-xs text-blue-700 mt-2">Save this ID to track your complaint status</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm text-slate-600 mb-1">Issue Type</p>
              <p className="font-semibold text-slate-900 capitalize">{d.incident_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Severity</p>
              <p className="font-semibold text-slate-900 capitalize">{d.severity}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Status</p>
              <p className="font-semibold text-slate-900 capitalize">{d.status}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Reported On</p>
              <p className="font-semibold text-slate-900">
                {d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Just now'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 mb-1">Title</p>
            <p className="font-semibold text-slate-900">{d.title}</p>
          </div>

          {d.description && (
            <div>
              <p className="text-sm text-slate-600 mb-1">Description</p>
              <p className="text-slate-900">{d.description}</p>
            </div>
          )}

          <div className="flex items-start gap-2">
            <MapPin size={18} className="text-slate-600 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-1">Location</p>
              <p className="font-medium text-slate-900">
                {d.location_name || d.address || `${d.latitude?.toFixed(4)}, ${d.longitude?.toFixed(4)}`}
              </p>
              {(d.location_name || d.address) && (
                <p className="text-xs text-slate-600 mt-1">
                  Coordinates: {d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)}
                </p>
              )}
            </div>
          </div>

          {/* Image Preview */}
          {(d.image_url || d.image_key) && (
            <div>
              <p className="text-sm text-slate-600 mb-2">Uploaded Photo</p>
              {d.image_url ? (
                <img 
                  src={d.image_url} 
                  alt="Incident evidence" 
                  className="rounded-lg border-2 border-slate-300 max-h-64 w-full object-cover"
                />
              ) : (
                <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-600" />
                  <span className="text-sm text-green-800">Photo uploaded successfully</span>
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
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Search size={20} />
          Track My Complaint
        </Link>
        <Link 
          to="/report" 
          className="px-6 py-3 bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
        >
          <AlertCircle size={20} />
          Report Another Issue
        </Link>
        <Link 
          to="/" 
          className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
        >
          Back to Home
        </Link>
      </div>
    </div>

    {/* What Happens Next Section */}
    <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
      <h3 className="font-bold text-lg text-blue-900 mb-3">What Happens Next?</h3>
      <ol className="space-y-3 text-sm text-blue-900">
        <li className="flex gap-3">
          <span className="font-bold">1.</span>
          <span>Authorities will review your complaint and verify the details.</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold">2.</span>
          <span>If approved, it will be assigned to field workers for resolution.</span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold">3.</span>
          <span>You can track the status anytime using your Complaint ID.</span>
        </li>
      </ol>
    </div>
  </div>;
}
