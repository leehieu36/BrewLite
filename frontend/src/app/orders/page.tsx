
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  history,
  cancelOrder,
  requestOrderCancellation,
} from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { Order } from "@/lib/types";

const money = (amount: number) =>
  `${amount.toLocaleString("vi-VN")}đ`;

const orderStatuses: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng",
  COMPLETED: "Hoàn tất",
  PAYMENT_FAILED: "Thanh toán thất bại",
  CANCELLED: "Đã hủy",
};

const paymentMethods: Record<string, string> = {
  POINTS: "Điểm tích lũy",
  LOYALTY_POINTS: "Điểm tích lũy",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  VNPAY: "VNPay",
  MOMO: "MoMo",
};

const cancellationReasons = [
  "Đặt nhầm sản phẩm",
  "Muốn thay đổi đơn hàng",
  "Thời gian chờ quá lâu",
  "Không còn nhu cầu",
  "Khác",
];

type CancellationInfo = {
  cancellationRequestStatus?: string;
  cancellationReason?: string | null;
  cancellationRequestedAt?: string | null;
};

type OrderFilter =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

const filters: { key: OrderFilter; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING", label: "Chờ thanh toán" },
  { key: "PROCESSING", label: "Đang xử lý" },
  { key: "COMPLETED", label: "Hoàn tất" },
  { key: "CANCELLED", label: "Đã hủy" },
];

const matchesFilter = (order: Order, filter: OrderFilter) => {
  switch (filter) {
    case "PENDING":
      return order.status === "PENDING";

    case "PROCESSING":
      return ["PAID", "PREPARING", "READY"].includes(order.status);

    case "COMPLETED":
      return order.status === "COMPLETED";

    case "CANCELLED":
      return ["CANCELLED", "PAYMENT_FAILED"].includes(order.status);

    default:
      return true;
  }
};

export default function Orders() {
  const { token, confirm } = useApp();

  const [list, setList] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<OrderFilter>("ALL");

  const [actionBusyId, setActionBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [customReasons, setCustomReasons] = useState<Record<string, string>>({});
  const [openCancellationId, setOpenCancellationId] = useState("");

  useEffect(() => {
    if (!token) {
      setList([]);
      setBusy(false);
      setError("");
      return;
    }

    let active = true;

    const loadOrders = (showError = false) => {
      history(token)
        .then((orders) => {
          if (active) {
            setList(orders);
            setError("");
          }
        })
        .catch((cause: unknown) => {
          if (active && showError) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Không lấy được lịch sử đơn hàng.",
            );
          }
        })
        .finally(() => {
          if (active && showError) {
            setBusy(false);
          }
        });
    };

    setBusy(true);
    setError("");
    loadOrders(true);

    const interval = window.setInterval(() => {
      loadOrders();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token, refreshKey]);

  const counts = useMemo(() => {
    return {
      ALL: list.length,
      PENDING: list.filter((order) =>
        matchesFilter(order, "PENDING"),
      ).length,
      PROCESSING: list.filter((order) =>
        matchesFilter(order, "PROCESSING"),
      ).length,
      COMPLETED: list.filter((order) =>
        matchesFilter(order, "COMPLETED"),
      ).length,
      CANCELLED: list.filter((order) =>
        matchesFilter(order, "CANCELLED"),
      ).length,
    };
  }, [list]);

  const filteredList = useMemo(
    () => list.filter((order) => matchesFilter(order, filter)),
    [list, filter],
  );

  const getReason = (orderId: string) => {
    const selected = reasons[orderId];

    if (!selected) return "";

    if (selected === "Khác") {
      const detail = (customReasons[orderId] || "").trim();
      return detail ? `Khác: ${detail}` : "";
    }

    return selected;
  };

  const clearReason = (orderId: string) => {
    setReasons((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });

    setCustomReasons((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  };

  const closeCancellationForm = (orderId: string) => {
    setOpenCancellationId("");
    setActionError("");
  };

  const handleCancel = async (orderId: string) => {
    if (!token) return;

    const reason = getReason(orderId);

    if (!reason) {
      setActionError(
        reasons[orderId] === "Khác"
          ? "Vui lòng nhập nội dung lý do khác."
          : "Vui lòng chọn lý do hủy đơn hàng.",
      );
      return;
    }

    const confirmed = await confirm(
      `Bạn có chắc chắn muốn hủy đơn hàng này không?\nLý do: ${reason}`,
      "Xác nhận hủy đơn hàng",
    );

    if (!confirmed) return;

    try {
      setActionBusyId(orderId);
      setActionError("");
      setNotice("");

      await cancelOrder(token, orderId, reason);

      setNotice(`Đã hủy đơn hàng #${orderId}.`);
      clearReason(orderId);
      setOpenCancellationId("");
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Không thể hủy đơn hàng.",
      );
    } finally {
      setActionBusyId("");
    }
  };

  const handleCancellationRequest = async (orderId: string) => {
    if (!token) return;

    const reason = getReason(orderId);

    if (!reason) {
      setActionError(
        reasons[orderId] === "Khác"
          ? "Vui lòng nhập nội dung lý do khác."
          : "Vui lòng chọn lý do hủy đơn hàng.",
      );
      return;
    }

    const confirmed = await confirm(
      `Bạn có chắc chắn muốn gửi yêu cầu hủy đơn hàng #${orderId} không?\nLý do: ${reason}`,
      "Xác nhận yêu cầu hủy đơn",
    );

    if (!confirmed) return;

    try {
      setActionBusyId(orderId);
      setActionError("");
      setNotice("");

      await requestOrderCancellation(token, orderId, reason);

      setNotice(
        `Đã gửi yêu cầu hủy đơn hàng #${orderId}. Vui lòng chờ nhân viên xét duyệt.`,
      );

      clearReason(orderId);
      setOpenCancellationId("");
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Không thể gửi yêu cầu hủy đơn.",
      );
    } finally {
      setActionBusyId("");
    }
  };

  return (
    <div className="wrap sub orders-page">
      <div className="orders-heading">
        <div>
          <h1>
            Lịch sử <i>đơn hàng</i>
          </h1>
          <p>Theo dõi trạng thái và thông tin các đơn hàng của bạn.</p>
        </div>

        {token && (
          <button
            className="orders-refresh"
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={busy}
          >
            {busy ? "Đang tải..." : "↻ Tải lại"}
          </button>
        )}
      </div>

      {!token ? (
        <div className="state">
          Đăng nhập để xem lịch sử đơn hàng.{" "}
          <Link href="/login">Đăng nhập</Link>
        </div>
      ) : (
        <>
          {notice && (
            <div className="orders-message orders-message-success">
              {notice}
            </div>
          )}

          {actionError && (
            <div className="orders-message orders-message-error">
              {actionError}
            </div>
          )}

          {!busy && !error && list.length > 0 && (
            <div className="orders-filter">
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`orders-filter-btn ${
                    filter === item.key ? "active" : ""
                  }`}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                  <span>{counts[item.key]}</span>
                </button>
              ))}
            </div>
          )}

          {busy ? (
            <div className="state">Đang tải lịch sử đơn hàng...</div>
          ) : error ? (
            <div className="state orders-error">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                Thử tải lại
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="state">
              Bạn chưa có đơn hàng nào.{" "}
              <Link href="/">Chọn đồ uống →</Link>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="state orders-empty">
              Không có đơn hàng thuộc mục này.
            </div>
          ) : (
            <div className="orders">
              {filteredList.map((order) => {
                const payment = order.payments?.[0];
                const cancellation = order as Order & CancellationInfo;

                const requestStatus =
                  cancellation.cancellationRequestStatus || "NONE";

                const canCancelDirectly =
                  order.status === "PENDING";

                const canRequestCancellation =
                  ["PAID", "PREPARING"].includes(order.status) &&
                  requestStatus !== "PENDING" &&
                  requestStatus !== "APPROVED";

                const isProcessing = actionBusyId === order.id;
                const selectedReason = reasons[order.id] || "";
                const isCancellationOpen =
                  openCancellationId === order.id;

                const hasCancellationInfo =
                  requestStatus !== "NONE" ||
                  (order.status === "CANCELLED" &&
                    Boolean(cancellation.cancellationReason));

                return (
                  <article className="order-card" key={order.id}>
                    <header className="order-card-header">
                      <div>
                        <small>MÃ ĐƠN HÀNG</small>
                        <h2>#{order.id}</h2>
                        <p>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString("vi-VN")
                            : "Thời gian không có sẵn"}
                        </p>
                      </div>

                      <span
                        className={`order-status status-${order.status.toLowerCase()}`}
                      >
                        {orderStatuses[order.status] || order.status}
                      </span>
                    </header>

                    <div className="order-items">
                      {(order.items || []).map((item) => (
                        <div className="order-item" key={item.id}>
                          <div>
                            <strong>
                              {item.product?.name || "Sản phẩm"}
                            </strong>
                            <p>
                              Size {item.size}
                              {item.toppings?.length
                                ? ` · ${item.toppings.join(", ")}`
                                : ""}
                              {" · "}SL {item.qty}
                            </p>
                          </div>

                          <b>{money(item.lineTotal)}</b>
                        </div>
                      ))}
                    </div>

                    <footer className="order-card-footer">
                      <div>
                        <span>Phương thức thanh toán</span>
                        <strong>
                          {payment
                            ? paymentMethods[payment.method] || payment.method
                            : "Chưa có thông tin"}
                        </strong>
                      </div>

                      <div className="order-total">
                        <span>Tổng cộng</span>
                        <strong>{money(order.total || 0)}</strong>
                      </div>
                    </footer>

                    {hasCancellationInfo && (
                      <div
                        className={`orders-cancellation-info cancellation-${requestStatus.toLowerCase()}`}
                      >
                        <strong>
                          {requestStatus === "PENDING" &&
                            "Yêu cầu hủy đang chờ nhân viên xét duyệt."}
                          {requestStatus === "REJECTED" &&
                            "Yêu cầu hủy đơn đã bị từ chối."}
                          {requestStatus === "APPROVED" &&
                            "Yêu cầu hủy đơn đã được chấp thuận."}
                          {requestStatus === "NONE" &&
                            order.status === "CANCELLED" &&
                            "Đơn hàng đã được hủy."}
                        </strong>

                        {cancellation.cancellationReason && (
                          <p>
                            <b>Lý do hủy:</b>{" "}
                            {cancellation.cancellationReason}
                          </p>
                        )}

                        {cancellation.cancellationRequestedAt && (
                          <small>
                            Thời gian gửi yêu cầu:{" "}
                            {new Date(
                              cancellation.cancellationRequestedAt,
                            ).toLocaleString("vi-VN")}
                          </small>
                        )}
                      </div>
                    )}

                    {(canCancelDirectly || canRequestCancellation) && (
                      <div
                        className="order-cancellation-area"
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          width: "100%",
                        }}
                      >
                        {!isCancellationOpen ? (
                          <button
                            type="button"
                            className="order-cancel-btn"
                            disabled={isProcessing}
                            onClick={() => {
                              setActionError("");
                              setOpenCancellationId(order.id);
                            }}
                          >
                            {canCancelDirectly
                              ? "Hủy đơn"
                              : requestStatus === "REJECTED"
                                ? "Gửi lại yêu cầu hủy"
                                : "Yêu cầu hủy đơn"}
                          </button>
                        ) : (
                          <div className="order-cancellation-form">
                            <strong className="order-cancellation-title">
                              {requestStatus === "REJECTED"
                                ? "Chọn lý do gửi lại yêu cầu hủy"
                                : "Vì sao bạn muốn hủy đơn hàng?"}
                            </strong>

                            <div className="cancellation-reason-list">
                              {cancellationReasons.map((reason) => (
                                <label
                                  className="cancellation-reason-option"
                                  key={reason}
                                >
                                  <input
                                    type="radio"
                                    name={`cancel-reason-${order.id}`}
                                    value={reason}
                                    checked={selectedReason === reason}
                                    onChange={() => {
                                      setReasons((current) => ({
                                        ...current,
                                        [order.id]: reason,
                                      }));

                                      setActionError("");
                                    }}
                                  />

                                  <span>{reason}</span>
                                </label>
                              ))}
                            </div>

                            {selectedReason === "Khác" && (
                              <textarea
                                className="cancellation-custom-reason"
                                value={customReasons[order.id] || ""}
                                onChange={(event) =>
                                  setCustomReasons((current) => ({
                                    ...current,
                                    [order.id]: event.target.value.slice(0, 450),
                                  }))
                                }
                                maxLength={450}
                                rows={3}
                                placeholder="Nhập lý do cụ thể..."
                              />
                            )}

                            {selectedReason === "Khác" && (
                              <small className="cancellation-character-count">
                                {(customReasons[order.id] || "").length}/450 ký tự
                              </small>
                            )}

                            <div
                              className="order-cancellation-bottom"
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "12px",
                                flexWrap: "wrap",
                                marginTop: "20px",
                              }}
                            >
                              <button
                                type="button"
                                className="order-cancel-btn"
                                disabled={isProcessing}
                                onClick={() =>
                                  canCancelDirectly
                                    ? handleCancel(order.id)
                                    : handleCancellationRequest(order.id)
                                }
                              >
                                {isProcessing
                                  ? "Đang xử lý..."
                                  : canCancelDirectly
                                    ? "Xác nhận hủy đơn"
                                    : "Gửi yêu cầu hủy"}
                              </button>

                              <button
                                type="button"
                                className="order-cancellation-close"
                                style={{
                                  background: "#315d43",
                                  color: "#ffffff",
                                  border: "1px solid #315d43",
                                  borderRadius: "8px",
                                  padding: "10px 24px",
                                  cursor: "pointer",
                                  width: "auto",
                                  flex: "none",
                                }}
                                disabled={isProcessing}
                                onClick={() =>
                                  closeCancellationForm(order.id)
                                }
                              >
                                Đóng
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}