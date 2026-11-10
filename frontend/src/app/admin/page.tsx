"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  adminActivityLogs, adminSummary, adminUsers, updateUserRole, adminOrders, updateOrderStatus,
  adminProducts, createProduct, updateProduct, deleteProduct,
  type ActivityLog, type AdminSummary, type AdminUser, type ManagedOrder,
  type ManagedProduct, type ProductInput,
} from "@/lib/api";

const moneyDate = (value: string) => new Date(value).toLocaleString("vi-VN");
const money = (value: number) => value.toLocaleString("vi-VN") + "đ";

const actionName: Record<string, string> = {
  REGISTER: "Đăng ký tài khoản",
  LOGIN: "Đăng nhập",
  LOGIN_FAILED: "Đăng nhập thất bại",
  ORDER_CREATED: "Tạo đơn hàng",
  ORDER_STATUS_UPDATED: "Cập nhật đơn hàng",
  CUSTOMER_ORDER_DATA_ACCESSED: "Truy cập dữ liệu đơn hàng",
  CUSTOMER_DATA_ACCESSED: "Truy cập danh sách khách hàng",
  PAYMENT_SUCCEEDED: "Thanh toán",
  USER_ROLE_UPDATED: "Thay đổi quyền",
};

const transitions: Record<string, string[]> = {
  PENDING: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
};

const emptyProduct: ProductInput = {
  name: "",
  description: "",
  price: 0,
  imageUrl: "",
  stock: 0,
};

export default function AdminPage() {
  const { token, role } = useApp();
  const router = useRouter();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ManagedProduct | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(emptyProduct);
  const [savingProduct, setSavingProduct] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [s, l, o] = await Promise.all([
        adminSummary(token),
        adminActivityLogs(token),
        adminOrders(token),
      ]);
      setSummary(s);
      setLogs(l.items);
      setOrders(o);
      if (role === "ADMIN") {
        const [u, p] = await Promise.all([
          adminUsers(token, 1, 50, search),
          adminProducts(token),
        ]);
        setUsers(u.items);
        setProducts(p);
      } else {
        setUsers([]);
        setProducts([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu quản trị.");
    } finally {
      setLoading(false);
    }
  }, [token, role, search]);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role !== "ADMIN" && role !== "STAFF") return;
    void load();
  }, [token, role, router, load]);

  useEffect(() => {
    if (!token || (role !== "ADMIN" && role !== "STAFF")) return;

    let active = true;
    let refreshing = false;

    const refreshDashboard = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const [s, l, o] = await Promise.all([
          adminSummary(token),
          adminActivityLogs(token),
          adminOrders(token),
        ]);
        if (active) {
          setSummary(s);
          setLogs(l.items);
          setOrders(o);
        }
      } catch {
      } finally {
        refreshing = false;
      }
    };

    const interval = window.setInterval(() => void refreshDashboard(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token, role]);

  async function changeRole(user: AdminUser, nextRole: AdminUser["role"]) {
    if (!token || nextRole === user.role) return;
    setBusyId(user.id);
    setError("");
    try {
      await updateUserRole(token, user.id, nextRole);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật quyền.");
    } finally {
      setBusyId("");
    }
  }

  async function changeOrderStatus(order: ManagedOrder, nextStatus: string) {
    if (!token || nextStatus === order.status) return;
    setBusyId(order.id);
    setError("");
    try {
      await updateOrderStatus(token, order.id, nextStatus);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật đơn hàng.");
    } finally {
      setBusyId("");
    }
  }

  function openCreateProduct() {
    setEditingProduct(null);
    setProductForm(emptyProduct);
    setShowProductForm(true);
  }

  function openEditProduct(product: ManagedProduct) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      imageUrl: product.imageUrl || "",
      stock: product.stock,
    });
    setShowProductForm(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!productForm.name.trim()) {
      setError("Vui lòng nhập tên sản phẩm.");
      return;
    }
    if (!Number.isFinite(productForm.price) || productForm.price < 0 ||
        !Number.isFinite(productForm.stock) || productForm.stock < 0) {
      setError("Giá và số lượng tồn kho phải là số không âm.");
      return;
    }

    setSavingProduct(true);
    setError("");
    const payload: ProductInput = {
      name: productForm.name.trim(),
      description: productForm.description?.trim() || "",
      price: Number(productForm.price),
      imageUrl: productForm.imageUrl?.trim() || "",
      stock: Number(productForm.stock),
    };
    try {
      if (editingProduct) {
        await updateProduct(token, editingProduct.id, payload);
      } else {
        await createProduct(token, payload);
      }
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm(emptyProduct);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu sản phẩm.");
    } finally {
      setSavingProduct(false);
    }
  }

  async function removeProduct(product: ManagedProduct) {
    if (!token) return;
    const confirmed = window.confirm(`Ẩn sản phẩm "${product.name}" khỏi thực đơn?`);
    if (!confirmed) return;

    setBusyId(product.id);
    setError("");
    try {
      await deleteProduct(token, product.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xóa sản phẩm.");
    } finally {
      setBusyId("");
    }
  }

  if (!token) return <div className="wrap"><div className="state">Đang chuyển đến trang đăng nhập...</div></div>;
  if (role !== "ADMIN" && role !== "STAFF") return <div className="wrap"><div className="state">Tài khoản không có quyền truy cập trang quản trị.</div></div>;

  return <div className="wrap admin-wrap">
    <div className="admin-heading">
      <div><small>BREWLITE CONTROL CENTER</small><h1>Quản trị hệ thống</h1><p>Quản lý thực đơn, tài khoản và hoạt động của cửa hàng.</p></div>
      <button className="orders-refresh" onClick={() => void load()} disabled={loading}>{loading ? "Đang tải..." : "↻ Làm mới"}</button>
    </div>
    {error && <p className="error">{error}</p>}

    <div className="admin-stats">
      <div><span>Khách hàng</span><strong>{summary?.customers ?? "—"}</strong></div>
      {role === "ADMIN" && <div><span>Nhân viên</span><strong>{summary?.staff ?? "—"}</strong></div>}
      <div><span>Tổng đơn hàng</span><strong>{summary?.orders ?? "—"}</strong></div>
      <div><span>Đơn chờ xử lý</span><strong>{summary?.pendingOrders ?? "—"}</strong></div>
      <div><span>Nhật ký hoạt động</span><strong>{summary?.activityLogs ?? "—"}</strong></div>
    </div>

    {role === "ADMIN" && <>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Quản lý thực đơn</h2><p>Thêm món mới, cập nhật thông tin hoặc ẩn món khỏi thực đơn.</p></div>
          <button className="admin-primary-btn" onClick={openCreateProduct}>+ Thêm sản phẩm</button>
        </div>

        {showProductForm && <form className="admin-product-form" onSubmit={saveProduct}>
          <div className="admin-product-form-title">
            <h3>{editingProduct ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h3>
            <button type="button" className="admin-quiet-btn" onClick={() => setShowProductForm(false)}>Đóng</button>
          </div>
          <div className="admin-product-fields">
            <label>Tên sản phẩm
              <input required value={productForm.name} onChange={e => setProductForm(v => ({ ...v, name: e.target.value }))} placeholder="Ví dụ: Cà phê sữa" />
            </label>
            <label>Giá bán (VNĐ)
              <input required type="number" min="0" step="1000" value={productForm.price} onChange={e => setProductForm(v => ({ ...v, price: Number(e.target.value) }))} />
            </label>
            <label>Số lượng tồn kho
              <input required type="number" min="0" step="1" value={productForm.stock} onChange={e => setProductForm(v => ({ ...v, stock: Number(e.target.value) }))} />
            </label>
            <label className="admin-product-image-field">Đường dẫn hình ảnh
              <input value={productForm.imageUrl || ""} onChange={e => setProductForm(v => ({ ...v, imageUrl: e.target.value }))} placeholder="https://..." />
            </label>
            <label className="admin-product-description">Mô tả
              <textarea rows={3} value={productForm.description || ""} onChange={e => setProductForm(v => ({ ...v, description: e.target.value }))} placeholder="Mô tả ngắn về sản phẩm..." />
            </label>
          </div>
          <div className="admin-product-form-actions">
            <button type="button" className="admin-quiet-btn" onClick={() => setShowProductForm(false)}>Hủy</button>
            <button type="submit" className="admin-primary-btn" disabled={savingProduct}>{savingProduct ? "Đang lưu..." : editingProduct ? "Lưu thay đổi" : "Tạo sản phẩm"}</button>
          </div>
        </form>}

        <div className="admin-table-scroll">
          <table className="admin-table admin-products-table">
            <thead><tr><th>Sản phẩm</th><th>Giá bán</th><th>Tồn kho</th><th>Thao tác</th></tr></thead>
            <tbody>{products.map(product => <tr key={product.id}>
              <td>
                <div className="admin-product-cell">
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span className="admin-product-thumb">☕</span>}
                  <div><strong>{product.name}</strong><small>{product.description || "Chưa có mô tả"}</small></div>
                </div>
              </td>
              <td>{money(product.price)}</td>
              <td>{product.stock}</td>
              <td><div className="admin-row-actions">
                <button type="button" className="admin-quiet-btn" onClick={() => openEditProduct(product)}>Sửa</button>
                <button type="button" className="admin-delete-btn" disabled={busyId === product.id} onClick={() => void removeProduct(product)}>{busyId === product.id ? "Đang xử lý..." : "Ẩn món"}</button>
              </div></td>
            </tr>)}</tbody>
          </table>
          {products.length === 0 && <p className="state">Chưa có sản phẩm đang hiển thị.</p>}
        </div>
        <p className="admin-note">Ẩn món sẽ không xóa dữ liệu sản phẩm khỏi lịch sử đơn hàng.</p>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Quản lý tài khoản</h2><p>Chỉ quản trị viên mới được xem danh sách và thay đổi vai trò.</p></div>
          <input aria-label="Tìm tài khoản" placeholder="Tìm theo tên hoặc email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="admin-table-scroll"><table className="admin-table">
          <thead><tr><th>Khách hàng / nhân viên</th><th>Ngày tạo</th><th>Điểm</th><th>Vai trò</th></tr></thead>
          <tbody>{users.map(user => <tr key={user.id}>
            <td><strong>{user.name || "Chưa cập nhật tên"}</strong><small>{user.email}</small></td>
            <td>{moneyDate(user.createdAt)}</td><td>{user.loyaltyPoints}</td>
            <td><select value={user.role} disabled={busyId === user.id} onChange={e => void changeRole(user, e.target.value as AdminUser["role"])}>
              <option value="CUSTOMER">Khách hàng</option><option value="STAFF">Nhân viên</option><option value="ADMIN">Quản trị viên</option>
            </select></td>
          </tr>)}</tbody>
        </table>{users.length === 0 && <p className="state">Không tìm thấy tài khoản.</p>}</div>
      </section>
    </>}

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><h2>Quản lý đơn hàng</h2><p>Nhân viên và quản trị viên có thể cập nhật trạng thái đơn hàng. Mọi thay đổi đều được ghi nhật ký.</p></div></div>
      <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>Đơn hàng</th><th>Khách hàng</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
        <tbody>{orders.map(order => {
          const next = transitions[order.status] || [];
          return <tr key={order.id}>
            <td><strong>{order.id.slice(0, 12)}</strong><small>{moneyDate(order.createdAt)}</small></td>
            <td><strong>{order.user.name || "Khách hàng"}</strong><small>{order.user.email}</small></td>
            <td>{order.items.map(item => `${item.product.name} × ${item.qty}`).join(", ")}</td>
            <td>{money(order.total)}</td>
            <td><select value={order.status} disabled={busyId === order.id || next.length === 0} onChange={e => void changeOrderStatus(order, e.target.value)}>
              <option value={order.status}>{order.status}</option>
              {next.map(status => <option key={status} value={status}>{status}</option>)}
            </select></td>
          </tr>;
        })}</tbody>
      </table>{orders.length === 0 && <p className="state">Chưa có đơn hàng.</p>}</div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><h2>Nhật ký hoạt động</h2><p>Ghi nhận đăng nhập, đăng ký, đặt hàng, thanh toán, truy cập dữ liệu và thay đổi quyền.</p></div><span className="admin-role">{role}</span></div>
      <div className="admin-table-scroll"><table className="admin-table logs-table">
        <thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Hoạt động</th><th>Đối tượng</th><th>IP</th></tr></thead>
        <tbody>{logs.map(log => <tr key={log.id}>
          <td>{moneyDate(log.createdAt)}</td>
          <td><strong>{log.actor?.name || "Không xác định"}</strong><small>{log.actor?.email || "Hoạt động chưa xác thực"}</small></td>
          <td><strong>{actionName[log.action] || log.action}</strong><small>{log.description}</small></td>
          <td>{log.entity}{log.actorRole ? ` · ${log.actorRole}` : ""}</td>
          <td>{log.ipAddress || "—"}</td>
        </tr>)}</tbody>
      </table>{logs.length === 0 && <p className="state">Chưa có nhật ký hoạt động.</p>}</div>
    </section>
    <p className="admin-note">Thông tin tài khoản được trả về từ API có phân quyền. Mật khẩu và token không được hiển thị trong trang quản trị.</p>
  </div>;
}
