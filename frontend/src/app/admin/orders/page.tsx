
"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  adminOrders,
  updateOrderStatus,
  confirmPayment,
  reviewOrderCancellation,
  staffCancelOrder,
  type ManagedOrder,
} from "@/lib/api";

const transitions: Record<string, string[]> = {
  PAID: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
};

const statusLabels: Record<string, string> = {
  PENDING: "Chờ xử lý",
  PAID: "Đã thanh toán",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng",
  COMPLETED: "Hoàn thành",
  PAYMENT_FAILED: "Thanh toán thất bại",
  CANCELLED: "Đã hủy",
};

const paymentLabels: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  SUCCEEDED: "Đã thanh toán",
  FAILED: "Thất bại",
  REFUND_PENDING: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
};

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  POINTS: "Điểm tích lũy",
  LOYALTY_POINTS: "Điểm tích lũy",
  CASH: "Tiền mặt",
  MOMO: "Ví MoMo",
  VNPAY: "Ví VNPay",
};

const externalPaymentMethods = ["BANK_TRANSFER", "VNPAY", "MOMO"];

const money = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN") + "đ";

export default function OrdersPage() {
  const { token, confirm } = useApp();

  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setError("");
      const data = await adminOrders(token);
      setOrders(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể tải đơn hàng."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();

    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const handlePaymentError = async (order: ManagedOrder) => {
    if (!token || busyId) return;

    const pendingPayment = order.payments?.find(
      (payment) =>
        payment.status === "PENDING" &&
        externalPaymentMethods.includes(payment.method)
    );

    if (order.status !== "PENDING" || !pendingPayment) {
      setError("Không tìm thấy giao dịch thanh toán đang chờ xử lý.");
      return;
    }

    const confirmed = await confirm(
      `Xác nhận ghi nhận lỗi thanh toán và hủy đơn hàng #${order.id.slice(-8)}?`,
      "Ghi nhận lỗi thanh toán"
    );

    if (!confirmed) return;

    try {
      setBusyId(order.id);
      setError("");
      setNotice("");

      await staffCancelOrder(token, order.id);

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể ghi nhận lỗi thanh toán."
      );
    } finally {
      setBusyId("");
    }
  };

  const handleConfirmPayment = async (order: ManagedOrder) => {
    if (!token || busyId) return;

    const pendingPayment = order.payments?.find(
      (payment) =>
        payment.status === "PENDING" &&
        externalPaymentMethods.includes(payment.method)
    );

    if (!pendingPayment || order.status !== "PENDING") {
      setError("Không tìm thấy giao dịch đang chờ xác nhận.");
      return;
    }

    const methodName =
      methodLabels[pendingPayment.method] || pendingPayment.method;

    const confirmed = await confirm(
      `Xác nhận đã nhận được thanh toán ${methodName} cho đơn hàng #${order.id.slice(-8)}?`,
      "Xác nhận thanh toán"
    );

    if (!confirmed) return;

    try {
      setBusyId(order.id);
      setError("");
      setNotice("");

      // API nhận ID đơn hàng, không phải ID giao dịch thanh toán.
      await confirmPayment(token, order.id);

      setNotice("Xác nhận thanh toán thành công. Đơn hàng đã được cập nhật.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể xác nhận thanh toán."
      );
    } finally {
      setBusyId("");
    }
  };

  const changeStatus = async (orderId: string, status: string) => {
    if (!token || busyId) return;

    const confirmed = await confirm(
      `Xác nhận chuyển trạng thái đơn hàng thành "${
        statusLabels[status] || status
      }"?`,
      "Cập nhật trạng thái đơn hàng"
    );

    if (!confirmed) return;

    try {
      setBusyId(orderId);
      setError("");
      setNotice("");

      await updateOrderStatus(token, orderId, status);

      setNotice("Cập nhật trạng thái đơn hàng thành công.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể cập nhật đơn."
      );
    } finally {
      setBusyId("");
    }
  };

  const handleReviewCancellation = async (
    orderId: string,
    approved: boolean
  ) => {
    if (!token || busyId) return;

    const confirmed = await confirm(
      approved
        ? "Bạn có chắc chắn muốn duyệt yêu cầu hủy đơn này?"
        : "Bạn có chắc chắn muốn từ chối yêu cầu hủy đơn này?",
      approved ? "Duyệt yêu cầu hủy" : "Từ chối yêu cầu hủy"
    );

    if (!confirmed) return;

    try {
      setBusyId(orderId);
      setError("");
      setNotice("");

      await reviewOrderCancellation(token, orderId, approved);

      setNotice(
        approved
          ? "Đã duyệt yêu cầu hủy đơn."
          : "Đã từ chối yêu cầu hủy đơn."
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể xử lý yêu cầu hủy."
      );
    } finally {
      setBusyId("");
    }
  };

  const visibleOrders = orders.filter((order) => {
    if (filter === "ALL") return true;

    if (filter === "CANCELLATION") {
      return order.cancellationRequestStatus === "PENDING";
    }

    return order.status === filter;
  });

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="admin-eyebrow">ORDER MANAGEMENT</span>
          <h1>Quản lý đơn hàng</h1>
          <p>Theo dõi, cập nhật và xử lý các đơn hàng.</p>
        </div>

        <button
          className="admin-quiet-btn"
          onClick={load}
          disabled={loading}
        >
          ↻ Làm mới
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}

      <div className="admin-filter-row">
        {[
          ["ALL", "Tất cả", orders.length],
          ["PENDING", "Chờ xử lý", orders.filter(o => o.status === "PENDING").length],
          ["PAID", "Đã thanh toán", orders.filter(o => o.status === "PAID").length],
          ["PREPARING", "Đang chuẩn bị", orders.filter(o => o.status === "PREPARING").length],
          ["READY", "Sẵn sàng", orders.filter(o => o.status === "READY").length],
          ["COMPLETED", "Hoàn thành", orders.filter(o => o.status === "COMPLETED").length],
          [
            "CANCELLATION",
            "Chờ duyệt hủy",
            orders.filter(o => o.cancellationRequestStatus === "PENDING").length,
          ],
        ].map(([value, label, count]) => (
          <button
            key={value}
            className={`admin-filter-btn ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(String(value))}
          >
            {label}
            <span className="admin-filter-count">{count}</span>
          </button>
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Danh sách đơn hàng</h2>
            <p>{visibleOrders.length} đơn hàng</p>
          </div>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Sản phẩm</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Yêu cầu hủy</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>Đang tải đơn hàng...</td>
                </tr>
              ) : visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={8}>Không có đơn hàng.</td>
                </tr>
              ) : (
                visibleOrders.map((order) => {
                  const pendingPayment = order.payments?.find(
                    (payment) =>
                      payment.status === "PENDING" &&
                      externalPaymentMethods.includes(payment.method)
                  );

                  const canReportPaymentError =
                    order.status === "PENDING" && !!pendingPayment;

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>#{order.id.slice(-8)}</strong>
                        <small>
                          {new Date(order.createdAt).toLocaleString("vi-VN")}
                        </small>
                      </td>

                      <td>
                        <strong>{order.user?.name || "Khách hàng"}</strong>
                        <small>{order.user?.email}</small>
                      </td>

                      <td>
                        {order.items?.map((item) => (
                          <div key={item.id}>
                            {item.product?.name} × {item.qty}
                          </div>
                        ))}
                      </td>

                      <td>
                        <strong>{money(order.total)}</strong>
                      </td>

                      <td>
                        {order.payments?.length ? (
                          order.payments.map((payment) => (
                            <div key={payment.id}>
                              <span>
                                {methodLabels[payment.method] || payment.method}
                              </span>
                              <small>
                                {paymentLabels[payment.status] || payment.status}
                              </small>
                            </div>
                          ))
                        ) : (
                          "Chưa có"
                        )}
                      </td>

                      <td>
                        <span className="admin-status">
                          {statusLabels[order.status] || order.status}
                        </span>
                      </td>

                      <td>
                        {order.cancellationRequestStatus === "PENDING" ? (
                          <div>
                            <span className="admin-status warning">
                              Chờ duyệt
                            </span>

                            {order.cancellationReason && (
                              <small>
                                Lý do: {order.cancellationReason}
                              </small>
                            )}

                            <div className="admin-row-actions">
                              <button
                                className="admin-primary-btn"
                                disabled={!!busyId}
                                onClick={() =>
                                  handleReviewCancellation(order.id, true)
                                }
                              >
                                Duyệt
                              </button>

                              <button
                                className="admin-delete-btn"
                                disabled={!!busyId}
                                onClick={() =>
                                  handleReviewCancellation(order.id, false)
                                }
                              >
                                Từ chối
                              </button>
                            </div>
                          </div>
                        ) : order.cancellationRequestStatus === "APPROVED" ? (
                          <span className="admin-status success">
                            Đã duyệt
                          </span>
                        ) : order.cancellationRequestStatus === "REJECTED" ? (
                          <span className="admin-status danger">
                            Đã từ chối
                          </span>
                        ) : (
                          "Không có"
                        )}
                      </td>

                      <td>
                        <div className="admin-row-actions">
                          {pendingPayment && order.status === "PENDING" && (
                            <button
                              className="admin-primary-btn"
                              disabled={!!busyId}
                              onClick={() => handleConfirmPayment(order)}
                            >
                              {busyId === order.id
                                ? "Đang xử lý..."
                                : "Xác nhận thanh toán"}
                            </button>
                          )}

                          {canReportPaymentError && (
                            <button
                              className="admin-delete-btn"
                              disabled={!!busyId}
                              onClick={() => handlePaymentError(order)}
                            >
                              {busyId === order.id
                                ? "Đang xử lý..."
                                : "Lỗi thanh toán"}
                            </button>
                          )}

                          {(transitions[order.status] || []).map((next) => (
                            <button
                              key={next}
                              className="admin-quiet-btn"
                              disabled={!!busyId}
                              onClick={() => changeStatus(order.id, next)}
                            >
                              {statusLabels[next]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
