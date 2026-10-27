"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { products } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { Product, Size } from "@/lib/types";
const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
export default function Detail() {
  const { id } = useParams<{
    id: string;
  }>(), router = useRouter(), { add } = useApp();
  const [p, P] = useState<Product | null>(null), [size, S] = useState<Size>("M"), [tops, T] = useState<string[]>([]), [q, Q] = useState(1), [msg, M] = useState(""), [loading, B] = useState(true);
  useEffect(() => {
    products().then(x => P(x.list.find(a => a.id === id) || null)).finally(() => B(false));
  }, [id]);
  if (loading) return <div className="state">Đang tải sản phẩm...</div>;
  if (!p) return <div className="wrap state">Không tìm thấy sản phẩm. <Link href="/">Quay lại menu</Link>
  </div>;
  const total = (p.price + (size === "S" ? 0 : size === "M" ? 5000 : 10000) + tops.length * 7000) * q;
  const toggle = (t: string) => T(a => a.includes(t) ? a.filter(x => x !== t) : [...a, t]);
  return <div className="wrap detail">
    <div className="detailimg">{p.image && <img src={p.image} alt={p.name} />}
    </div>
    <section>
      <Link href="/">← Quay lại thực đơn</Link>
      <small>{p.category || "OUR MENU"}
      </small>
      <h1>{p.name}
      </h1>
      <p>{p.description}
      </p>
      <h3>{money(p.price)} <small>giá size S</small>
      </h3>
      <hr />
      <h3>Chọn size</h3>
      <div className="choices">{(["S", "M", "L"] as Size[]).map(s => <button className={size === s ? "selected" : ""} onClick={() => S(s)} key={s}>{s}
        <small>{s === "S" ? "Nhỏ" : s === "M" ? "Vừa +5k" : "Lớn +10k"}
        </small>
      </button>)}
      </div>
      <hr />
      <h3>Topping thêm <small>+7.000đ / topping</small>
      </h3>{["Trân châu", "Kem cheese", "Thạch cà phê"].map(t => <label className="topping" key={t}>
        <input type="checkbox" checked={tops.includes(t)} onChange={() => toggle(t)} />{t}
        <span>+7k</span>
      </label>)}
      <hr />
      <div className="quantity">
        <b>Số lượng</b>
        <div>
          <button onClick={() => Q(a => Math.max(1, a - 1))}>−</button>{q}
          <button onClick={() => Q(a => a + 1)}>+</button>
        </div>
      </div>
      <div className="total">
        <span>Tạm tính</span>
        <b>{money(total)}
        </b>
      </div>
      <button className="btn wide" onClick={() => {
        add(p, size, tops, q);
        M("Đã thêm vào giỏ hàng.");
      }}>Thêm vào giỏ hàng ↗</button>{msg && <p className="success">{msg} <button onClick={() => router.push("/cart")}>Xem giỏ hàng</button>
      </p>}
    </section>
  </div>;
}
