import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { getRoutes } from "../../services/routeService";

const PAGE_SIZE = 10;

export default function RoutesPage() {
  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    getRoutes({ limit: 200 })
      .then((r: any) => { const arr = Array.isArray(r) ? r : r.items || []; setData(arr); })
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageSlice  = data.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <Topbar title="Routes" />
      <div className="p-6 space-y-4">
        {loading ? (
          <LoadingSpinner />
        ) : data.length === 0 ? (
          <EmptyState title="No routes" />
        ) : (
          <>
            <div className="bg-white border border-surface-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-page text-ink-muted">
                  <tr>
                    <th className="p-3 text-left">Route Number</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Start</th>
                    <th className="p-3 text-left">End</th>
                    <th className="p-3 text-left">Distance (km)</th>
                    <th className="p-3 text-left">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map((r: any) => (
                    <tr key={r.id} className="border-t border-surface-border hover:bg-brand-50 transition-colors">
                      <td className="p-3 font-medium text-ink">{r.route_number || r.id}</td>
                      <td className="p-3 text-ink">{r.name || "—"}</td>
                      <td className="p-3 text-ink-muted">{r.start_location || "—"}</td>
                      <td className="p-3 text-ink-muted">{r.end_location || "—"}</td>
                      <td className="p-3 text-ink-muted">{r.distance_km ?? "—"}</td>
                      <td className="p-3 text-ink-muted">{String(r.is_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={data.length}
              pageSize={PAGE_SIZE}
              onChange={p => setPage(p)}
            />
          </>
        )}
      </div>
    </>
  );
}
