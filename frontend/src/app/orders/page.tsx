"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { history } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { Order } from "@/lib/types";

const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

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
  COD: "Thanh toán khi nhận hàng",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  VNPAY: "VNPay",
  MOMO: "MoMo",
};

export default function Orders() {
  const { token } = useApp();
  const [list, setList] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setList([]);
      setBusy(false);
      setError("");
      return;
    }

    let active = true;
    setBusy(true);
    setError("");

    history(token)
      .then((orders) => {
        if (active) setList(orders);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Không lấy được lịch sử đơn hàng.");
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [token, refreshKey]);

  return <div className="wrap sub">
    <div className="orders-heading">
      <div>
        <h1>Lịch sử <i>đơn hàng</i></h1>
        <p>Theo dõi các đơn hàng đã được lưu theo tài khoản của bạn.</p>
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
        Đăng nhập để xem lịch sử đơn hàng. <Link href="/login">Đăng nhập ↗</Link>
      </div>
    ) : busy ? (
      <div className="state">Đang tải lịch sử đơn hàng...</div>
    ) : error ? (
      <div className="state orders-error">
        <p>{error}</p>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>
          Thử tải lại
        </button>
      </div>
    ) : list.length === 0 ? (
      <div className="state">
        Bạn chưa có đơn hàng nào. <Link href="/">Chọn đồ uống →</Link>
      </div>
    ) : (
      <div className="orders">
        {list.map((order) => {
          const payment = order.payments?.[0];
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
                <span className={`order-status status-${order.status.toLowerCase()}`}>
                  {orderStatuses[order.status] || order.status}
                </span>
              </header>

              <div className="order-items">
                {(order.items || []).map((item) => (
                  <div className="order-item" key={item.id}>
                    <div>
                      <strong>{item.product?.name || "Sản phẩm"}</strong>
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
                  <span>Thanh toán</span>
                  <strong>
                    {payment
                      ? paymentMethods[payment.method] || payment.method
                      : "Thanh toán khi nhận hàng"}
                  </strong>
                </div>
                <div className="order-total">
                  <span>Tổng cộng</span>
                  <strong>{money(order.total || 0)}</strong>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    )}
  </div>;
}
