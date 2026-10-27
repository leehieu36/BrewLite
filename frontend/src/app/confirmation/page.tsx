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
    } catch { }
  }, []);
  const id = p.get("id") || saved?.id || "—", status = p.get("status") || saved?.status || "PENDING";
  const title = status === "PAYMENT_FAILED"
    ? "Thanh toán chưa thành công"
    : status === "PENDING"
      ? "Đơn hàng đã được tiếp nhận"
      : "Đặt hàng thành công!";
  return <div className="confirmation">
    <div className="check">✓</div>
    <small>ORDER RECEIVED</small>
    <h1>{title}
    </h1>
    <p>
      {status === "PENDING"
        ? "Cảm ơn bạn đã chọn BrewLite. Vui lòng thanh toán khi nhận đơn hàng."
        : status === "PAID" && saved?.method !== "COD"
          ? "Bạn đã xác nhận thanh toán. Vui lòng theo dõi trạng thái đơn hàng."
          : "Cảm ơn bạn đã chọn BrewLite. Vui lòng theo dõi trạng thái đơn hàng."}
    </p>
    <div className="confirmdetail">
      <p>Mã đơn hàng <b>#{id}
      </b>
      </p>
      <p>Trạng thái <b>{status}
      </b>
      </p>{saved?.total && <p>Tổng thanh toán <b>{Number(saved.total).toLocaleString("vi-VN")}đ</b>
      </p>}
    </div>
    <p>☕ Mời bạn theo dõi đơn hàng và nhận đồ uống tại quầy.</p>
    <Link className="btn" href="/orders">Xem lịch sử đơn ↗</Link> <Link className="back" href="/">Về trang chủ</Link>
  </div>;
} export default function Confirmation() {
  return <Suspense fallback={<div className="state">Đang tải...</div>}>
    <Content />
  </Suspense>;
}
