import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import IncidentTable from "../../components/IncidentTable";
import IncidentFilters from "../../components/IncidentFilters";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { getIncidents } from "../../services/incidentService";
import { Incident } from "../../types/incident";

const PAGE_SIZE = 10;

export default function IncidentsPage() {
  const [filters, setFilters] = useState<any>({});
  const [search,  setSearch]  = useState("");
  const [data,    setData]    = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [page,    setPage]    = useState(1);

  // Re-fetch whenever API-level filters change
  useEffect(() => {
    setLoading(true);
    getIncidents({ ...filters, limit: 200 })
      .then((res: any) => {
        const arr = Array.isArray(res) ? res : res.items || [];
        setData(arr);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  // Reset to page 1 whenever filters OR search changes
  useEffect(() => { setPage(1); }, [JSON.stringify(filters), search]);

  // Client-side text search (same logic as before)
  const filtered = data.filter(i =>
    !search ||
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    (i.location_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.address || "").toLowerCase().includes(search.toLowerCase())
  );

  // Slice for current page
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <Topbar title="Incidents" />
      <div className="p-6 space-y-4">
        <IncidentFilters filters={filters} setFilters={setFilters} />
        <input
          placeholder="Search title / location / address (local)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-surface-border rounded-lg px-3 py-2 bg-white text-ink placeholder-ink-subtle focus:outline-none focus:border-brand"
        />

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No incidents found" />
        ) : (
          <>
            <IncidentTable incidents={pageSlice} />
            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={p => setPage(p)}
            />
          </>
        )}
      </div>
    </>
  );
}
