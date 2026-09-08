import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2, AlertCircle, CheckCircle, Clock, MapPin, FileText, XCircle } from "lucide-react";
import { getPublicIncident } from "../../services/incidentService";
import type { Incident } from "../../types/incident";

export default function TrackComplaintPage(){
  const [complaintId, setComplaintId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintId.trim()) {
      setError("Please enter a complaint ID");
      return;
    }

    setLoading(true);
    setError(null);
    setIncident(null);

    try {
      const data = await getPublicIncident(complaintId);
      setIncident(data);
    } catch (ex: any) {
      setError(ex.response?.status === 404 
        ? "Complaint not found. Please check the ID and try again." 
        : ex.response?.data?.detail || "Failed to fetch complaint details. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "reported":
      case "pending":
        return <Clock className="text-yellow-600" size={24} />;
      case "in_progress":
        return <Loader2 className="text-blue-600" size={24} />;
      case "resolved":
      case "closed":
        return <CheckCircle className="text-green-600" size={24} />;
      case "rejected":
        return <XCircle className="text-red-600" size={24} />;
      default:
        return <AlertCircle className="text-gray-600" size={24} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "reported":
      case "pending":
        return "bg-yellow-50 border-yellow-300 text-yellow-900";
      case "in_progress":
        return "bg-blue-50 border-blue-300 text-blue-900";
      case "resolved":
      case "closed":
        return "bg-green-50 border-green-300 text-green-900";
      case "rejected":
        return "bg-red-50 border-red-300 text-red-900";
      default:
        return "bg-gray-50 border-gray-300 text-gray-900";
    }
  };

  return <div className="max-w-4xl mx-auto px-6 py-10">
    <div className="mb-8">
      <Link to="/" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4">
        ← Back to Home
      </Link>
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Track Your Complaint</h1>
      <p className="text-slate-600">Enter your complaint ID to check the current status and details</p>
    </div>

    {/* Search Form */}
    <form onSubmit={handleSearch} className="bg-white border-2 border-slate-200 rounded-2xl p-6 md:p-8 mb-8">
      <label className="block text-sm font-semibold text-slate-900 mb-3">
        Complaint ID / Incident ID
      </label>
      <div className="flex gap-3">
        <input
          type="text"
          value={complaintId}
          onChange={(e) => setComplaintId(e.target.value)}
          placeholder="Enter your complaint ID (e.g., 123)"
          className="flex-1 border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none text-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search size={20} />
              Search
            </>
          )}
        </button>
      </div>
    </form>

    {/* Error Message */}
    {error && (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8 flex items-start gap-4">
        <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-semibold text-red-900 mb-1">Error</h3>
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )}

    {/* Incident Details */}
    {incident && (
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText size={24} className="text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">Complaint #{incident.id}</h2>
            </div>
            <p className="text-slate-600">Submitted on {new Date(incident.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${getStatusColor(incident.status)}`}>
            {getStatusIcon(incident.status)}
            <span className="font-semibold capitalize">{incident.status.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Status Timeline</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${incident.status !== 'rejected' ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <CheckCircle size={16} className="text-white" />
                </div>
                <div className={`w-0.5 h-12 ${incident.status !== 'reported' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="font-semibold text-slate-900">Reported</p>
                <p className="text-sm text-slate-600">Complaint submitted by citizen</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${['in_progress', 'resolved', 'closed'].includes(incident.status) ? 'bg-green-500' : incident.status === 'rejected' ? 'bg-red-500' : 'bg-gray-300'}`}>
                  {['in_progress', 'resolved', 'closed'].includes(incident.status) ? (
                    <CheckCircle size={16} className="text-white" />
                  ) : incident.status === 'rejected' ? (
                    <XCircle size={16} className="text-white" />
                  ) : (
                    <Clock size={16} className="text-gray-500" />
                  )}
                </div>
                <div className={`w-0.5 h-12 ${['resolved', 'closed'].includes(incident.status) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="font-semibold text-slate-900">
                  {incident.status === 'rejected' ? 'Rejected' : 'Under Review / In Progress'}
                </p>
                <p className="text-sm text-slate-600">
                  {incident.status === 'rejected' 
                    ? 'Complaint was reviewed and rejected' 
                    : ['in_progress', 'resolved', 'closed'].includes(incident.status)
                    ? 'Work assigned to field team'
                    : 'Pending review by authorities'
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${['resolved', 'closed'].includes(incident.status) ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <CheckCircle size={16} className={['resolved', 'closed'].includes(incident.status) ? 'text-white' : 'text-gray-500'} />
                </div>
              </div>
              <div className="flex-1 pt-1">
                <p className="font-semibold text-slate-900">Resolved</p>
                <p className="text-sm text-slate-600">
                  {['resolved', 'closed'].includes(incident.status) 
                    ? 'Issue has been fixed and closed' 
                    : 'Not yet resolved'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Incident Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">Complaint Details</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-1">Issue Type</p>
              <p className="font-semibold text-slate-900 capitalize">{incident.incident_type.replace(/_/g, ' ')}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-1">Severity</p>
              <p className="font-semibold text-slate-900 capitalize">{incident.severity}</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-1">Title</p>
            <p className="font-semibold text-slate-900">{incident.title}</p>
          </div>

          {incident.description && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-1">Description</p>
              <p className="text-slate-900">{incident.description}</p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <MapPin size={18} className="text-slate-600 mt-1 flex-shrink-0" />
              <p className="text-sm text-slate-600">Location</p>
            </div>
            <p className="font-semibold text-slate-900">
              {incident.location_name || incident.address || 'Location not specified'}
            </p>
            {(incident.location_name || incident.address) && (
              <p className="text-sm text-slate-600 mt-1">
                Coordinates: {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
              </p>
            )}
            {!incident.location_name && !incident.address && (
              <p className="text-sm text-slate-600 mt-1">
                {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
              </p>
            )}
          </div>

          {/* Image */}
          {incident.image_url && (
            <div>
              <p className="text-sm text-slate-600 mb-2">Submitted Photo</p>
              <img 
                src={incident.image_url} 
                alt="Incident evidence" 
                className="rounded-lg border-2 border-slate-300 max-h-96 w-full object-cover"
              />
            </div>
          )}

          {/* Source Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Source:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              incident.source === 'citizen' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-purple-100 text-purple-800'
            }`}>
              {incident.source === 'citizen' ? '👤 Citizen Report' : '🤖 AI Detection'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-200">
          <Link 
            to="/report" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
    )}

    {/* Help Section */}
    {!incident && !error && (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mt-8">
        <h3 className="font-bold text-lg text-blue-900 mb-3">How to Find Your Complaint ID?</h3>
        <ul className="space-y-2 text-sm text-blue-900">
          <li className="flex gap-2">
            <span>•</span>
            <span>Your Complaint ID was displayed on the success page after submitting your report</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>It's a numeric ID like: 123, 456, etc.</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>If you've lost your ID, please contact your local government office</span>
          </li>
        </ul>
      </div>
    )}
  </div>;
}
