
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "@/context/AppContext";
import { order, pay, getMyProfile } from "@/lib/api";
import type { Method } from "@/lib/types";

const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
const paymentOptions: { method: Method; title: string; description: string }[] = [
  { method: "LOYALTY_POINTS", title: "Thanh toán bằng điểm", description: "Sử dụng điểm tích lũy BrewLite để thanh toán." },
  { method: "BANK_TRANSFER", title: "Chuyển khoản ngân hàng", description: "Quét mã QR chuyển khoản." },
  { method: "VNPAY", title: "Ví VNPay", description: "Quét mã QR bằng ứng dụng VNPay." },
  { method: "MOMO", title: "Ví MoMo", description: "Quét mã QR bằng ứng dụng MoMo." },
];

export default function Checkout() {
  const { cart, total, token, clear } = useApp();
  const [method, M] = useState<Method>("LOYALTY_POINTS");
  const [error, E] = useState("");
  const [busy, B] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [pointsError, setPointsError] = useState(false);

  const pointsRequired = Math.ceil(total / 500);
  const pointsMissing = Math.max(0, pointsRequired - currentPoints);
  const enoughPoints = currentPoints >= pointsRequired;

  const router = useRouter();
  const selectedPayment = paymentOptions.find((option) => option.method === method)!;
  const qrValue = `BREWLITE|${method}|${total}|VND|PAYMENT`;

  useEffect(() => {
    if (!token) {
      setLoadingPoints(false);
      return;
    }

    let active = true;

    setLoadingPoints(true);
    setPointsError(false);

    getMyProfile(token)
      .then((profile) => {
        if (active) {
          setCurrentPoints(profile.loyaltyPoints);
        }
      })
      .catch(() => {
        if (active) {
          setPointsError(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingPoints(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

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

    if (method === "LOYALTY_POINTS") {
      if (loadingPoints) {
        E("Đang tải thông tin điểm.");
        return;
      }

      if (pointsError) {
        E("Không thể tải thông tin điểm. Vui lòng tải lại trang.");
        return;
      }

      if (!enoughPoints) {
        E(`Bạn còn thiếu ${pointsMissing} điểm để thanh toán.`);
        return;
      }
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

      const status = method === "LOYALTY_POINTS" ? "PAID" : "PENDING";

      await pay(id, method, token);

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

          {method === "LOYALTY_POINTS" && (
            <div className="qr-panel">
              <h3>Thông tin điểm thưởng</h3>

              <p>
                Điểm hiện có:
                <strong>
                  {loadingPoints
                    ? "Đang tải..."
                    : pointsError
                      ? "Không tải được"
                      : `${currentPoints.toLocaleString("vi-VN")} điểm`}
                </strong>
              </p>

              <p>
                Tổng đơn hàng:
                <strong>{money(total)}</strong>
              </p>

              <p>
                Điểm cần thanh toán:
                <strong>{pointsRequired.toLocaleString("vi-VN")} điểm</strong>
              </p>

              {!loadingPoints && !pointsError && !enoughPoints && (
                <p className="error">
                  Bạn còn thiếu {pointsMissing.toLocaleString("vi-VN")} điểm.
                </p>
              )}

              {!loadingPoints && !pointsError && enoughPoints && (
                <p>
                  Điểm còn lại sau thanh toán:
                  <strong>
                    {(currentPoints - pointsRequired).toLocaleString("vi-VN")} điểm
                  </strong>
                </p>
              )}
            </div>
          )}

          {method !== "LOYALTY_POINTS" && (
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
            disabled={ busy || !cart.length || (method === "LOYALTY_POINTS" && (loadingPoints || pointsError || !enoughPoints))}
          >
            {busy
              ? "Đang xử lý..."
              : method === "LOYALTY_POINTS"
                ? "Đặt hàng, sử dụng điểm ↗"
                : "Tôi đã thanh toán, gửi yêu cầu xác nhận ↗"}
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
