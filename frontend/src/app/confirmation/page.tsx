
"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function Content() {
  const p = useSearchParams();
  const [saved, S] = useState<any>(null);

  useEffect(() => {
    try {
      S(JSON.parse(localStorage.getItem("bl_last_order") || "null"));
    } catch {
      S(null);
    }
  }, []);

  const id = p.get("id") || saved?.id || "—";
  const status = p.get("status") || saved?.status || "PENDING";
  const method = saved?.method;

  const title =
    status === "PAYMENT_FAILED"
      ? "Thanh toán chưa thành công"
      : status === "PENDING"
        ? "Đơn hàng đang chờ xác nhận thanh toán"
        : status === "PAID"
          ? "Đặt hàng thành công!"
          : "Đơn hàng đã được tiếp nhận";

  const description =
    status === "PENDING"
      ? method === "LOYALTY_POINTS"
        ? "Đơn hàng của bạn đang chờ xử lý."
        : "Yêu cầu thanh toán đã được gửi. Nhân viên sẽ kiểm tra và xác nhận sau khi nhận được tiền."
      : status === "PAYMENT_FAILED"
        ? "Thanh toán chưa hoàn tất. Vui lòng liên hệ nhân viên để được hỗ trợ."
        : "Thanh toán thành công! Vui lòng theo dõi trạng thái đơn hàng.";

  const statusLabel =
    status === "PENDING"
      ? "Đang chờ xác nhận thanh toán"
      : status === "PAID"
        ? "Đã thanh toán"
        : status === "PAYMENT_FAILED"
          ? "Thanh toán thất bại"
          : status;

  return (
    <div className="confirmation">
      <div className="check">✓</div>

      <small>ORDER RECEIVED</small>

      <h1>{title}</h1>

      <p>{description}</p>

      <div className="confirmdetail">
        <p>
          Mã đơn hàng <b>#{id}</b>
        </p>

        <p>
          Trạng thái <b>{statusLabel}</b>
        </p>

        {saved?.total != null && (
          <p>
            Tổng thanh toán{" "}
            <b>{Number(saved.total).toLocaleString("vi-VN")}đ</b>
          </p>
        )}

        {method && (
          <p>
            Phương thức thanh toán{" "}
            <b>
              {method === "LOYALTY_POINTS"
                ? "Điểm tích lũy"
                : method === "BANK_TRANSFER"
                  ? "Chuyển khoản ngân hàng"
                  : method === "VNPAY"
                    ? "VNPay"
                    : method === "MOMO"
                      ? "MoMo"
                      : method}
            </b>
          </p>
        )}
      </div>

      <p>☕ Mời bạn theo dõi đơn hàng và nhận đồ uống tại quầy.</p>

      <Link className="btn" href="/orders">
        Xem lịch sử đơn ↗
      </Link>

      <Link className="back" href="/">
        Về trang chủ
      </Link>
    </div>
  );
}

export default function Confirmation() {
  return (
    <Suspense fallback={<div className="state">Đang tải...</div>}>
      <Content />
    </Suspense>
  );
}
