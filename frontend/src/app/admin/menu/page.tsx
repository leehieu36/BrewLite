
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/context/AppContext";
import {
  adminProducts,
  createProduct,
  updateProduct,
  type ManagedProduct,
  type ProductInput,
} from "@/lib/api";

const emptyForm: ProductInput = {
  name: "",
  description: "",
  price: 0,
  imageUrl: "",
  stock: 0,
};

export default function MenuPage() {
  const { token, role } = useApp();
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const isAdmin = role === "ADMIN";

  const load = useCallback(async () => {
    if (!token) return;

    try {
      setError("");
      const data = await adminProducts(token);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải thực đơn.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (product: ManagedProduct) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      imageUrl: product.imageUrl || "",
      stock: product.stock,
    });
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !isAdmin) return;

    if (!form.name.trim()) {
      setError("Vui lòng nhập tên sản phẩm.");
      return;
    }

    if (Number(form.price) <= 0 || Number(form.stock) < 0) {
      setError("Giá phải lớn hơn 0 và số lượng không được âm.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload: ProductInput = {
        name: form.name.trim(),
        description: form.description || "",
        price: Number(form.price),
        imageUrl: form.imageUrl || "",
        stock: Number(form.stock),
      };

      if (editingId) {
        await updateProduct(token, editingId, payload);
      } else {
        await createProduct(token, payload);
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu sản phẩm.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (product: ManagedProduct) => {
    if (!token || !isAdmin) return;

    try {
        setError("");
        await updateProduct(token, product.id, {
        isActive: !product.isActive,
        });
        await load();
    } catch (err) {
        setError(
        err instanceof Error
            ? err.message
            : "Không thể cập nhật trạng thái sản phẩm."
        );
    }
    };

  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="admin-eyebrow">MENU MANAGEMENT</span>
          <h1>Quản lý thực đơn</h1>
          <p>Quản lý thông tin và trạng thái các sản phẩm.</p>
        </div>

        <div className="admin-heading-actions">
          <button className="admin-quiet-btn" onClick={load}>
            ↻ Làm mới
          </button>

          {isAdmin && (
            <button className="admin-primary-btn" onClick={openCreate}>
              + Thêm sản phẩm
            </button>
          )}
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {showForm && isAdmin && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>{editingId ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}</h2>
              <p>Nhập thông tin sản phẩm bên dưới.</p>
            </div>
            <button
              className="admin-quiet-btn"
              onClick={() => setShowForm(false)}
            >
              Đóng
            </button>
          </div>

          <form className="admin-product-form" onSubmit={handleSubmit}>
            <div className="admin-product-fields">
              <label>
                Tên sản phẩm *
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Tên sản phẩm"
                />
              </label>

              <label>
                Giá bán *
                <input
                  required
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: Number(e.target.value) })
                  }
                />
              </label>

              <label>
                Số lượng tồn kho *
                <input
                  required
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) =>
                    setForm({ ...form, stock: Number(e.target.value) })
                  }
                />
              </label>

              <label>
                Đường dẫn hình ảnh
                <input
                  value={form.imageUrl || ""}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </label>

              <label className="admin-product-description">
                Mô tả
                <textarea
                  rows={3}
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Mô tả sản phẩm..."
                />
              </label>
            </div>

            <div className="admin-row-actions">
              <button
                className="admin-primary-btn"
                type="submit"
                disabled={saving}
              >
                {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm sản phẩm"}
              </button>

              <button
                className="admin-quiet-btn"
                type="button"
                onClick={() => setShowForm(false)}
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Danh sách sản phẩm</h2>
            <p>{products.length} sản phẩm</p>
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
                <th>Giá</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
                {isAdmin && <th>Thao tác</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4}>Đang tải...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4}>Không tìm thấy sản phẩm.</td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="admin-product-cell">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} />
                        ) : (
                          <div className="admin-product-placeholder">☕</div>
                        )}
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.description || "Chưa có mô tả"}</small>
                        </div>
                      </div>
                    </td>

                    <td>{product.price.toLocaleString("vi-VN")}đ</td>
                    <td>{product.stock}</td>

                    <td>
                      <span
                        className={`admin-status ${
                          product.isActive ? "success" : "danger"
                        }`}
                      >
                        {product.isActive ? "Đang bán" : "Đã ẩn"}
                      </span>
                    </td>

                    {isAdmin && (
                      <td>
                        <div className="admin-row-actions">
                          <button
                            className="admin-quiet-btn"
                            onClick={() => openEdit(product)}
                          >
                            Sửa
                          </button>

                          <button
                            className="admin-quiet-btn"
                            onClick={() => handleToggleActive(product)}
                          >
                            {product.isActive ? "Ẩn" : "Hiện"}
                          </button>
                        </div>
                      </td>
                    )}
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
