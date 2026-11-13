
"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { adminProducts, type ManagedProduct } from "@/lib/api";

export default function InventoryPage() {
  const { token } = useApp();
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!token) return;

    try {
      setError("");
      const data = await adminProducts(token);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải tồn kho.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = products.filter(
    (product) => product.isActive && product.stock <= 5
  ).length;

  const outOfStock = products.filter(
    (product) => product.stock <= 0
  ).length;

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="admin-eyebrow">INVENTORY</span>
          <h1>Tình trạng tồn kho</h1>
          <p>Theo dõi số lượng sản phẩm hiện có trong cửa hàng.</p>
        </div>

        <button className="admin-quiet-btn" onClick={load}>
          ↻ Làm mới
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">▤</div>
          <div>
            <span>Tổng sản phẩm</span>
            <strong>{products.length}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">⚠</div>
          <div>
            <span>Sắp hết hàng (≤ 5)</span>
            <strong>{lowStock}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">!</div>
          <div>
            <span>Hết hàng</span>
            <strong>{outOfStock}</strong>
          </div>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Danh sách tồn kho</h2>
            <p>Số lượng sản phẩm đang được quản lý.</p>
          </div>

          <input
            className="admin-search"
            placeholder="Tìm sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Giá bán</th>
                <th>Số lượng tồn</th>
                <th>Tình trạng</th>
                <th>Hiển thị</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Đang tải dữ liệu...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>Không có sản phẩm phù hợp.</td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                    </td>
                    <td>
                      {product.price.toLocaleString("vi-VN")}đ
                    </td>
                    <td>
                      <strong>{product.stock}</strong>
                    </td>
                    <td>
                      {product.stock <= 0 ? (
                        <span className="admin-status danger">Hết hàng</span>
                      ) : product.stock <= 5 ? (
                        <span className="admin-status warning">Sắp hết</span>
                      ) : (
                        <span className="admin-status success">Còn hàng</span>
                      )}
                    </td>
                    <td>
                      {product.isActive ? "Đang bán" : "Đã ẩn"}
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
