"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { history } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { Order } from "@/lib/types";
export default function Orders() {
  const { token } = useApp();
  const [list, L] = useState<Order[]>([]), [error, E] = useState(""), [busy, B] = useState(false);
  useEffect(() => {
    if (!token) return;
    B(true);
    history(token).then(L).catch(e => E(e instanceof Error ? e.message : "Không lấy được lịch sử")).finally(() => B(false));
  }, [token]);
  return <div className="wrap sub">
    <h1>Lịch sử <i>đơn hàng</i>
    </h1>
    <p>Các đơn hàng của bạn được hiển thị tại đây.</p>{!token ? <div className="state">Đăng nhập để xem lịch sử. <Link href="/login">Đăng nhập ↗</Link>
    </div> : busy ? <div className="state">Đang tải lịch sử...</div> : error ? <div className="error">{error}
    </div> : !list.length ? <div className="state">Chưa có đơn hàng. <Link href="/">Chọn đồ uống →</Link>
    </div> : <div className="orders">{list.map((o, i) => <article key={o.id || i}>
      <div>
        <small>ORDER #{o.id}
        </small>
        <h3>Đơn hàng BrewLite</h3>
        <p>{o.createdAt ? new Date(o.createdAt).toLocaleString("vi-VN") : ""}
        </p>
      </div>
      <b>{o.status}
      </b>
    </article>)}
    </div>}
  </div>;
}
