
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "@/context/AppContext";
import {
  order,
  pay,
  getMyProfile,
  validatePromotion,
} from "@/lib/api";
import type { Method } from "@/lib/types";

const money = (n: number) => n.toLocaleString("vi-VN") + "đ";

const paymentOptions: {
  method: Method;
  title: string;
  description: string;
}[] = [
  {
    method: "LOYALTY_POINTS",
    title: "Thanh toán bằng điểm",
    description: "Sử dụng điểm tích lũy BrewLite để thanh toán.",
  },
  {
    method: "BANK_TRANSFER",
    title: "Chuyển khoản ngân hàng",
    description: "Quét mã QR chuyển khoản.",
  },
  {
    method: "VNPAY",
    title: "Ví VNPay",
    description: "Quét mã QR bằng ứng dụng VNPay.",
  },
  {
    method: "MOMO",
    title: "Ví MoMo",
    description: "Quét mã QR bằng ứng dụng MoMo.",
  },
];

export default function Checkout() {
  const { cart, total, token, clear } = useApp();
  const router = useRouter();

  const [method, M] = useState<Method>("LOYALTY_POINTS");
  const [error, E] = useState("");
  const [busy, B] = useState(false);

  const [currentPoints, setCurrentPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [pointsError, setPointsError] = useState(false);

  const [promotionCode, setPromotionCode] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState("");
  const [promotionError, setPromotionError] = useState("");
  const [checkingPromotion, setCheckingPromotion] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalTotal, setFinalTotal] = useState<number | null>(null);
  const [promotionSubtotal, setPromotionSubtotal] = useState<number | null>(
    null,
  );

  const idempotencyRef = useRef<{
    signature: string;
    key: string;
  } | null>(null);

  const items = cart.map((i) => ({
    productId: i.productId,
    qty: i.quantity,
    size: i.size,
    toppings: i.toppings,
  }));

  const cartSignature = JSON.stringify(items);

  const pointsAmount = finalTotal ?? total;
  const pointsRequired = Math.ceil(pointsAmount / 500);
  const pointsMissing = Math.max(0, pointsRequired - currentPoints);
  const enoughPoints = currentPoints >= pointsRequired;

  const selectedPayment = paymentOptions.find(
    (option) => option.method === method,
  )!;

  const payableTotal = finalTotal ?? total;
  const qrValue = `BREWLITE|${method}|${payableTotal}|VND|PAYMENT`;

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

  // Khi giỏ hàng thay đổi, phải kiểm tra lại mã khuyến mãi.
  useEffect(() => {
    setAppliedPromotion("");
    setDiscountAmount(0);
    setFinalTotal(null);
    setPromotionSubtotal(null);
    setPromotionError("");
    idempotencyRef.current = null;
  }, [cartSignature]);

  async function applyPromotion() {
    setPromotionError("");

    if (!token) {
      router.push("/login");
      return;
    }

    const normalizedCode = promotionCode.trim().toUpperCase();

    if (!normalizedCode) {
      setPromotionError("Vui lòng nhập mã khuyến mãi.");
      return;
    }

    if (!cart.length) {
      setPromotionError("Giỏ hàng đang trống.");
      return;
    }

    setCheckingPromotion(true);

    try {
      const result = await validatePromotion(
        items,
        normalizedCode,
        token,
      );

      setAppliedPromotion(result.promotionCode ?? normalizedCode);
      setPromotionSubtotal(Number(result.subtotal));
      setDiscountAmount(Number(result.discountAmount));
      setFinalTotal(Number(result.total));

      idempotencyRef.current = null;
    } catch (e) {
      setAppliedPromotion("");
      setPromotionSubtotal(null);
      setDiscountAmount(0);
      setFinalTotal(null);
      setPromotionError(
        e instanceof Error ? e.message : "Không thể áp dụng mã khuyến mãi.",
      );
    } finally {
      setCheckingPromotion(false);
    }
  }

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

    const normalizedPromotion = promotionCode.trim().toUpperCase();

    if (normalizedPromotion && appliedPromotion !== normalizedPromotion) {
      E("Vui lòng bấm Áp dụng để kiểm tra mã khuyến mãi trước.");
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
        E(
          `Bạn còn thiếu ${pointsMissing.toLocaleString("vi-VN")} điểm.`,
        );
        return;
      }
    }

    const promotionToUse = appliedPromotion || undefined;

    const signature = JSON.stringify({
      items,
      promotionCode: promotionToUse ?? "",
    });

    if (idempotencyRef.current?.signature !== signature) {
      idempotencyRef.current = {
        signature,
        key: crypto.randomUUID(),
      };
    }

    B(true);

    try {
      const o = await order(
        items,
        token,
        promotionToUse,
        idempotencyRef.current.key,
      );

      const id = String(o.id ?? o.orderId ?? o.order_id ?? "");

      if (!id) {
        throw Error("API tạo đơn chưa trả về id.");
      }

      const actualTotal = Number(o.total ?? payableTotal);
      const actualDiscount = Number(o.discountAmount ?? 0);

      if (method === "LOYALTY_POINTS") {
        const actualPointsRequired = Math.ceil(actualTotal / 500);

        if (currentPoints < actualPointsRequired) {
          throw Error(
            `Bạn cần ${actualPointsRequired.toLocaleString("vi-VN")} điểm cho đơn hàng sau giảm giá.`,
          );
        }
      }

      await pay(id, method, token);

      const status = method === "LOYALTY_POINTS" ? "PAID" : "PENDING";

      localStorage.setItem(
        "bl_last_order",
        JSON.stringify({
          id,
          status,
          method,
          total: actualTotal,
          discountAmount: actualDiscount,
          promotionCode: o.promotionCode ?? null,
          createdAt: new Date().toISOString(),
        }),
      );

      idempotencyRef.current = null;
      clear();

      router.push(
        `/confirmation?id=${encodeURIComponent(id)}&status=${status}`,
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

          <div className="qr-panel">
            <h3>Mã khuyến mãi</h3>

            <div className="promotion-input">
              <input
                type="text"
                value={promotionCode}
                onChange={(e) => {
                  setPromotionCode(e.target.value.toUpperCase());
                  setAppliedPromotion("");
                  setDiscountAmount(0);
                  setFinalTotal(null);
                  setPromotionSubtotal(null);
                  setPromotionError("");
                  idempotencyRef.current = null;
                }}
                placeholder="Nhập mã khuyến mãi"
                maxLength={40}
                disabled={busy || checkingPromotion}
              />

              <button
                type="button"
                className="btn"
                onClick={applyPromotion}
                disabled={
                  busy ||
                  checkingPromotion ||
                  !promotionCode.trim() ||
                  !cart.length
                }
              >
                {checkingPromotion ? "Đang kiểm tra..." : "Áp dụng"}
              </button>
            </div>

            {appliedPromotion && (
              <p>
                <strong>Mã {appliedPromotion} đã được áp dụng.</strong>
              </p>
            )}

            {promotionError && (
              <p className="error">{promotionError}</p>
            )}

            {!appliedPromotion && !promotionError && (
              <p className="payment-instruction">
                Nhập mã và bấm Áp dụng để kiểm tra ưu đãi.
              </p>
            )}
          </div>

          <div className="payment-options">
            {paymentOptions.map((option) => (
              <button
                key={option.method}
                type="button"
                className={`payoption ${
                  method === option.method ? "selected" : ""
                }`}
                onClick={() => M(option.method)}
              >
                <span className="payoption-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span aria-hidden="true">
                  {method === option.method ? "●" : "○"}
                </span>
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
                <strong>{money(payableTotal)}</strong>
              </p>

              <p>
                Điểm cần thanh toán:
                <strong>
                  {pointsRequired.toLocaleString("vi-VN")} điểm
                </strong>
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
                    {(currentPoints - pointsRequired).toLocaleString(
                      "vi-VN",
                    )}{" "}
                    điểm
                  </strong>
                </p>
              )}
            </div>
          )}

          {method !== "LOYALTY_POINTS" && (
            <div className="qr-panel">
              <h3>Quét mã {selectedPayment.title}</h3>

              <div className="qr-code">
                <QRCodeSVG
                  value={qrValue}
                  size={196}
                  level="M"
                  title={`Mã QR ${selectedPayment.title}`}
                />
              </div>

              <p className="qr-amount">
                Số tiền: <strong>{money(payableTotal)}</strong>
              </p>

              <p className="payment-instruction">
                Quét mã bằng ứng dụng {selectedPayment.title}, sau đó xác
                nhận đã chuyển khoản.
              </p>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <button
            type="button"
            className="btn wide"
            onClick={place}
            disabled={
              busy ||
              checkingPromotion ||
              !cart.length ||
              (method === "LOYALTY_POINTS" &&
                (loadingPoints || pointsError || !enoughPoints))
            }
          >
            {busy
              ? "Đang xử lý..."
              : method === "LOYALTY_POINTS"
                ? "Đặt hàng, sử dụng điểm ↗"
                : "Tôi đã thanh toán, gửi yêu cầu xác nhận ↗"}
          </button>

          {!token && (
            <p>
              Vui lòng <Link href="/login">đăng nhập</Link> trước khi đặt
              hàng.
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

          <p>
            Tạm tính
            <b>{money(promotionSubtotal ?? total)}</b>
          </p>

          {appliedPromotion && (
            <p>
              Giảm giá ({appliedPromotion})
              <b>-{money(discountAmount)}</b>
            </p>
          )}

          <h3>
            Tổng thanh toán <b>{money(payableTotal)}</b>
          </h3>

          <Link className="back" href="/cart">
            ← Sửa giỏ hàng
          </Link>
        </aside>
      </div>
    </div>
  );
}
