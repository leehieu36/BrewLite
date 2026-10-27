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
  return <div className="confirmation">
    <div className="check">✓</div>
    <small>ORDER RECEIVED</small>
    <h1>{status === "PAYMENT_FAILED" ? "Thanh toán chưa thành công" : "Đặt hàng thành công!"}
    </h1>
    <p>Cảm ơn bạn đã chọn BrewLite. Vui lòng theo dõi trạng thái đơn hàng.</p>
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
