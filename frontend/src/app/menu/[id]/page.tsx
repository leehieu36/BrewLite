
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { products } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { Product, Size } from "@/lib/types";

const money = (n: number) => n.toLocaleString("vi-VN") + "đ";

const toppings = [
  "Trân châu",
  "Kem cheese",
  "Thạch cà phê",
];

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { add, role } = useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [size, setSize] = useState<Size>("M");
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    products()
      .then((result) => {
        if (active) {
          setProduct(result.list.find((item) => item.id === id) || null);
        }
      })
      .catch(() => {
        if (active) setProduct(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const toggleTopping = (topping: string) => {
    setSelectedToppings((current) =>
      current.includes(topping)
        ? current.filter((item) => item !== topping)
        : [...current, topping]
    );
  };

  if (loading) {
    return (
      <div className="wrap">
        <p className="state">Đang tải sản phẩm...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="wrap state">
        Không tìm thấy sản phẩm.
        {" "}
        <Link href="/">Quay lại thực đơn</Link>
      </div>
    );
  }

  const isCustomer = role === "CUSTOMER";
  const sizeExtra = size === "S" ? 0 : size === "M" ? 5000 : 10000;
  const total =
    (product.price + sizeExtra + selectedToppings.length * 7000) *
    quantity;

  return (
    <div className="wrap detail">
      <div className="detailimg">
        {product.image && (
          <img src={product.image} alt={product.name} />
        )}
      </div>

      <section>
        <Link href="/" className="detail-back">
          ← Quay lại thực đơn
        </Link>

        <small className="detail-category">
          {product.category || "ĐỒ UỐNG"}
        </small>

        <h1>{product.name}</h1>

        <p>{product.description}</p>

        <h3>
          {money(product.price)}
          <small> · Giá size S</small>
        </h3>

        {isCustomer ? (
          <>
            <hr />

            <h3>Chọn kích cỡ</h3>

            <div className="choices">
              {(["S", "M", "L"] as Size[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={size === item ? "selected" : ""}
                  onClick={() => setSize(item)}
                >
                  {item}
                  <small>
                    {item === "S"
                      ? "Nhỏ"
                      : item === "M"
                        ? "+5.000đ"
                        : "+10.000đ"}
                  </small>
                </button>
              ))}
            </div>

            <hr />

            <h3>Thêm topping</h3>
            <p className="detail-hint">7.000đ cho mỗi loại topping</p>

            {toppings.map((topping) => (
              <label className="topping" key={topping}>
                <input
                  type="checkbox"
                  checked={selectedToppings.includes(topping)}
                  onChange={() => toggleTopping(topping)}
                />
                {topping}
                <span>+7.000đ</span>
              </label>
            ))}

            <hr />

            <div className="quantity">
              <b>Số lượng</b>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                >
                  −
                </button>

                {quantity}

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => current + 1)
                  }
                >
                  +
                </button>
              </div>
            </div>

            <div className="total">
              <span>Tạm tính</span>
              <b>{money(total)}</b>
            </div>

            <button
              type="button"
              className="btn wide"
              onClick={() => {
                add(product, size, selectedToppings, quantity);
                setMessage("Đã thêm sản phẩm vào giỏ hàng.");
              }}
            >
              Thêm vào giỏ hàng
            </button>

            {message && (
              <p className="success">
                {message}
                {" "}
                <button
                  type="button"
                  onClick={() => router.push("/cart")}
                >
                  Xem giỏ hàng
                </button>
              </p>
            )}
          </>
        ) : (
          <div className="detail-view-only">
            <hr />
            <p>
              {role === "ADMIN" || role === "STAFF"
                ? "Sản phẩm đang được hiển thị ở chế độ xem."
                : "Đăng nhập bằng tài khoản khách hàng để đặt món."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
