import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import api from "../../services/api";

const PAGE_SIZE = 10;

export default function WorkersPage() {
  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    api.get("/users", { params: { limit: 200 } })
      .then(r => {
        const arr = Array.isArray(r.data) ? r.data : r.data.items || [];
        setData(arr);
      })
      .catch(e => setErr(e.response?.data?.detail || e.message || "Could not load workers."))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageSlice  = data.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <Topbar title="Workers" />
      <div className="p-6 space-y-4">
        {loading ? (
          <LoadingSpinner />
        ) : err ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-sm">{err}</div>
        ) : data.length === 0 ? (
          <EmptyState title="No workers" desc="No users found." />
        ) : (
          <>
            <div className="bg-white border border-surface-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-page text-ink-muted">
                  <tr>
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Full Name</th>
                    <th className="p-3 text-left">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map((u: any) => (
                    <tr key={u.id} className="border-t border-surface-border hover:bg-brand-50 transition-colors">
                      <td className="p-3 font-mono text-ink">{u.id}</td>
                      <td className="p-3 text-ink">{u.email}</td>
                      <td className="p-3 text-ink-muted">{u.full_name || "—"}</td>
                      <td className="p-3 text-ink-muted capitalize">{u.role}</td>
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
