
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { products } from "@/lib/api";
import type { Product } from "@/lib/types";

const money = (n: number) => n.toLocaleString("vi-VN") + "đ";

export default function Home() {
  const [list, L] = useState<Product[]>([]);
  const [loading, B] = useState(true);

  const [cat, C] = useState("Tất cả");

  useEffect(() => {
    products()
      .then((x) => {
        L(x.list);

      })
      .finally(() => B(false));
  }, []);

  const cats = [
    "Tất cả",
    ...new Set(list.map((p) => p.category || "Đồ uống")),
  ];

  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <small>SIP SLOW · LIVE WELL</small>

          <h1>
            Một ngụm nhỏ,
            <br />
            <i>ngày dịu dàng.</i>
          </h1>

          <p>
            Cà phê thơm, trà mát và những khoảng nghỉ vừa đủ dành riêng cho bạn.
          </p>

          <a className="btn" href="#menu">
            Khám phá thực đơn ↘
          </a>
        </div>

        <img
          src="https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85"
          alt="Không gian quán cà phê"
        />
      </section>

      <section id="menu">
        <div className="section-title">
          <div>
            <small>MADE WITH CARE</small>
            <h2>
              Thực đơn <i>hôm nay</i>
            </h2>
          </div>

          <p>
            Chọn món bạn yêu thích,
            <br />
            chúng mình chuẩn bị ngay.
          </p>
        </div>

        {!loading && (
          <div className="chips">
            {cats.map((c) => (
              <button
                className={c === cat ? "active" : ""}
                key={c}
                onClick={() => C(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="state">Đang tải thực đơn...</div>
        ) : list.filter((p) => cat === "Tất cả" || p.category === cat)
          .length === 0 ? (
          <div className="state">Chưa có sản phẩm trong danh mục này.</div>
        ) : (
          <div className="grid">
            {list
              .filter((p) => cat === "Tất cả" || p.category === cat)
              .map((p) => (
                <article className="card" key={p.id}>
                  <Link href={"/menu/" + p.id}>
                    {p.image ? (
                      <img src={p.image} alt={p.name} />
                    ) : (
                      <div className="placeholder">☕</div>
                    )}
                  </Link>

                  <div className="cardbody">
                    <small>{p.category || "BrewLite selection"}
                    </small>
                    <h3>{p.name}
                    </h3>
                    <p>
                      {p.description || "Thức uống pha chế tươi mỗi ngày."}
                    </p>

                    <div className="price">
                      {money(p.price)}
                      <Link href={"/menu/" + p.id}>↗</Link>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
