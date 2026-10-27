
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { order, pay } from "@/lib/api";
import type { Method } from "@/lib/types";

const money = (n: number) => n.toLocaleString("vi-VN") + "đ";

export default function Checkout() {
  const { cart, total, token, clear } = useApp();
  const [method, M] = useState<Method>("MOCK");
  const [error, E] = useState("");
  const [busy, B] = useState(false);
  const router = useRouter();

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

      const p = await pay(id, method, token);
      const status = String(p.status ?? "PAID");

      localStorage.setItem(
        "bl_last_order",
        JSON.stringify({
          id,
          status,
          total,
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

          {(["MOCK", "COD"] as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`payoption ${method === m ? "selected" : ""}`}
              onClick={() => M(m)}
            >
              {m === "MOCK"
                ? "◈ Thanh toán thử nghiệm"
                : "▤ Thanh toán khi nhận hàng"}
              <span>{method === m ? "●" : "○"}</span>
            </button>
          ))}

          {error && <p className="error">{error}</p>}

          <button
            type="button"
            className="btn wide"
            onClick={place}
            disabled={busy || !cart.length}
          >
            {busy ? "Đang xử lý..." : "Đặt hàng & thanh toán ↗"}
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
