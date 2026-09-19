import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import WorkOrderTable from "../../components/WorkOrderTable";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { getWorks } from "../../services/workService";

const PAGE_SIZE = 10;

export default function WorkOrdersPage() {
  const [orders,  setOrders]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    getWorks({ limit: 200 })
      .then((r: any) => {
        const arr = Array.isArray(r) ? r : r.items || [];
        setOrders(arr);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageSlice  = orders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <Topbar title="Work Orders" />
      <div className="p-6 space-y-4">
        {loading ? (
          <LoadingSpinner />
        ) : err ? (
          <div className="text-red-600">{err}</div>
        ) : orders.length === 0 ? (
          <EmptyState title="No work orders" desc="Create work from incident details via Assign Work." />
        ) : (
          <>
            <WorkOrderTable orders={pageSlice} />
            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={orders.length}
              pageSize={PAGE_SIZE}
              onChange={p => setPage(p)}
            />
          </>
        )}
      </div>
    </>
  );
}
