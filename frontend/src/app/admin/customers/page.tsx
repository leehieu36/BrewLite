
"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { adminUsers, type AdminUser } from "@/lib/api";

export default function CustomersPage() {
  const { token, role } = useApp();
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;

    try {
      setError("");
      const result = await adminUsers(token, 1, 100, search);
      setCustomers(result.items.filter((user) => user.role === "CUSTOMER"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải khách hàng.");
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    load();
  }, [load]);

  if (role !== "ADMIN") {
    return (
      <div className="admin-page">
        <div className="admin-error">Bạn không có quyền truy cập trang này.</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="admin-eyebrow">CUSTOMER MANAGEMENT</span>
          <h1>Quản lý khách hàng</h1>
          <p>Danh sách khách hàng và thông tin điểm tích lũy.</p>
        </div>

        <button className="admin-quiet-btn" onClick={load}>
          ↻ Làm mới
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Danh sách khách hàng</h2>
            <p>{customers.length} khách hàng được tìm thấy</p>
          </div>

          <input
            className="admin-search"
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Email</th>
                <th>Điểm tích lũy</th>
                <th>Ngày tham gia</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={4}>Đang tải dữ liệu...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={4}>Không tìm thấy khách hàng.</td></tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.name || "Chưa cập nhật tên"}</strong>
                    </td>
                    <td>{customer.email}</td>
                    <td>
                      <strong>
                        {(customer.loyaltyPoints ?? 0).toLocaleString("vi-VN")}
                      </strong>
                      {" điểm"}
                    </td>
                    <td>
                      {new Date(customer.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
