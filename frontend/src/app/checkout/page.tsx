
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "@/context/AppContext";
import { order, pay } from "@/lib/api";
import type { Method } from "@/lib/types";

const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
const paymentOptions: { method: Method; title: string; description: string }[] = [
  { method: "COD", title: "Thanh toán khi nhận hàng", description: "Trả tiền mặt khi nhận đồ uống." },
  { method: "BANK_TRANSFER", title: "Chuyển khoản ngân hàng", description: "Quét mã QR chuyển khoản." },
  { method: "VNPAY", title: "Ví VNPay", description: "Quét mã QR bằng ứng dụng VNPay." },
  { method: "MOMO", title: "Ví MoMo", description: "Quét mã QR bằng ứng dụng MoMo." },
];

export default function Checkout() {
  const { cart, total, token, clear } = useApp();
  const [method, M] = useState<Method>("COD");
  const [error, E] = useState("");
  const [busy, B] = useState(false);
  const router = useRouter();
  const selectedPayment = paymentOptions.find((option) => option.method === method)!;
  const qrValue = `BREWLITE|${method}|${total}|VND|PAYMENT`;

  async function place() {
    E("");

    if (!token) {
      router.push("/login");
      return;
    }

    if (!cart.length) {
      E("Giỏ hàng đang trống.");
      return;
    }

    B(true);

    try {
      const o = await order(
        cart.map((i) => ({
          productId: i.productId,
          qty: i.quantity,
          size: i.size,
          toppings: i.toppings,
        })),
        token
      );

      const id = String(o.id ?? o.orderId ?? o.order_id ?? "");

      if (!id) {
        throw Error("API tạo đơn chưa trả về id.");
      }

      const status = method === "COD" ? "PENDING" : "PAID";
      if (method !== "COD") {
        await pay(id, method, token);
      }

      localStorage.setItem(
        "bl_last_order",
        JSON.stringify({
          id,
          status,
          method,
          total: Number(o.total ?? total),
          createdAt: new Date().toISOString(),
        })
      );

      clear();
      router.push(
        `/confirmation?id=${encodeURIComponent(id)}&status=${status}`
      );
    } catch (e) {
      E(e instanceof Error ? e.message : "Đặt hàng thất bại");
    } finally {
      B(false);
    }
  }

  return (
    <div className="wrap sub">
      <h1>
        Thanh toán <i>đơn hàng</i>
      </h1>

      <p>Chọn phương thức thanh toán.</p>

      <div className="columns">
        <section className="summary">
          <h2>Phương thức thanh toán</h2>

          <div className="payment-options">
          {paymentOptions.map((option) => (
            <button
              key={option.method}
              type="button"
              className={`payoption ${method === option.method ? "selected" : ""}`}
              onClick={() => M(option.method)}
            >
              <span className="payoption-copy">
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <span aria-hidden="true">{method === option.method ? "●" : "○"}</span>
            </button>
          ))}
          </div>

          {method !== "COD" && (
            <div className="qr-panel">
              <h3>Quét mã {selectedPayment.title}</h3>
              <div className="qr-code">
                <QRCodeSVG value={qrValue} size={196} level="M" title={`Mã QR ${selectedPayment.title}`} />
              </div>
              <p className="qr-amount">Số tiền: <strong>{money(total)}</strong></p>
              <p className="payment-instruction">
                Quét mã bằng ứng dụng {selectedPayment.title}, sau đó xác nhận đã chuyển khoản.
              </p>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <button
            type="button"
            className="btn wide"
            onClick={place}
            disabled={busy || !cart.length}
          >
            {busy
              ? "Đang xử lý..."
              : method === "COD"
                ? "Đặt hàng, thanh toán khi nhận ↗"
                : "Tôi đã chuyển khoản, xác nhận ↗"}
          </button>

          {!token && (
            <p>
              Vui lòng <Link href="/login">đăng nhập</Link> trước khi đặt hàng.
            </p>
          )}
        </section>

        <aside className="summary">
          <h2>Đơn hàng của bạn</h2>

          {cart.map((i) => (
            <p key={i.key}>
              {i.name} · {i.size} × {i.quantity}
              <b>{money(i.unitPrice * i.quantity)}</b>
            </p>
          ))}

          <h3>
            Tổng thanh toán <b>{money(total)}</b>
          </h3>

          <Link className="back" href="/cart">
            ← Sửa giỏ hàng
          </Link>
        </aside>
      </div>
    </div>
  );
}
