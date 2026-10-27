"use client";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
export default function Cart() {
  const { cart, total, qty, remove } = useApp();
  return <div className="wrap sub">
    <h1>Giỏ hàng <i>của bạn</i>
    </h1>
    <p>Kiểm tra món uống trước khi tiếp tục nhé.</p>{!cart.length ? <div className="state">Giỏ hàng đang trống. <Link href="/">Đến thực đơn →</Link>
    </div> : <div className="columns">
      <section>{cart.map(i => <article className="cartrow" key={i.key}>
        <div className="thumb">{i.image && <img src={i.image} alt={i.name} />}
        </div>
        <div>
          <h3>{i.name}
          </h3>
          <p>Size {i.size} · {i.toppings.join(", ") || "Không topping"}
          </p>
          <b>{money(i.unitPrice)}
          </b>
          <button className="textbtn" onClick={() => remove(i.key)}>Xóa</button>
        </div>
        <div className="qctrl">
          <button onClick={() => qty(i.key, i.quantity - 1)}>−</button>{i.quantity}
          <button onClick={() => qty(i.key, i.quantity + 1)}>+</button>
        </div>
        <b>{money(i.unitPrice * i.quantity)}
        </b>
      </article>)}
      </section>
      <aside className="summary">
        <h2>Tóm tắt đơn hàng</h2>
        <p>Số lượng món <b>{cart.reduce((a, i) => a + i.quantity, 0)}
        </b>
        </p>
        <p>Tạm tính <b>{money(total)}
        </b>
        </p>
        <h3>Tổng cộng <b>{money(total)}
        </b>
        </h3>
        <Link className="btn wide" href="/checkout">Tiếp tục thanh toán ↗</Link>
        <Link className="back" href="/">← Chọn thêm món</Link>
      </aside>
    </div>}
  </div>;
}
