
"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  createAdminPromotion,
  type CreatePromotionInput,
} from "@/lib/api";

export default function PromotionsPage() {
  const { token, role } = useApp();

  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue: "",
    minOrderValue: "0",
    maxDiscount: "",
    startAt: "",
    endAt: "",
    usageLimit: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<any>(null);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setCreated(null);

    if (!token) {
      setMessage("Phiên đăng nhập không hợp lệ.");
      return;
    }

    if (new Date(form.endAt) <= new Date(form.startAt)) {
      setMessage("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }

    const data: CreatePromotionInput = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderValue: Number(form.minOrderValue || 0),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      ...(form.maxDiscount
        ? { maxDiscount: Number(form.maxDiscount) }
        : {}),
      ...(form.usageLimit
        ? { usageLimit: Number(form.usageLimit) }
        : {}),
    };

    try {
      setLoading(true);

      const result = await createAdminPromotion(token, data);

      setCreated(result);
      setMessage("Tạo mã khuyến mãi thành công!");

      setForm({
        code: "",
        discountType: "PERCENTAGE",
        discountValue: "",
        minOrderValue: "0",
        maxDiscount: "",
        startAt: "",
        endAt: "",
        usageLimit: "",
      });
    } catch (error: any) {
      setMessage(error.message || "Không thể tạo mã khuyến mãi.");
    } finally {
      setLoading(false);
    }
  }

  if (role !== "ADMIN") {
    return <div className="admin-content">Bạn không có quyền truy cập.</div>;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    marginTop: 7,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 16,
  };

  return (
    <div className="admin-content">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>
          Quản lý khuyến mãi
        </h1>
        <p style={{ color: "#777", marginTop: 6 }}>
          Tạo mã giảm giá cho khách hàng sử dụng khi đặt hàng.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 12,
          maxWidth: 760,
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ fontSize: 19, marginBottom: 22 }}>
          Tạo mã khuyến mãi mới
        </h2>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Mã khuyến mãi
            <input
              style={inputStyle}
              value={form.code}
              onChange={(e) =>
                update("code", e.target.value.toUpperCase())
              }
              placeholder="Ví dụ: BREWLITE10"
              maxLength={40}
              required
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <label style={labelStyle}>
              Loại giảm giá
              <select
                style={inputStyle}
                value={form.discountType}
                onChange={(e) =>
                  update("discountType", e.target.value)
                }
              >
                <option value="PERCENTAGE">Theo phần trăm (%)</option>
                <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
              </select>
            </label>

            <label style={labelStyle}>
              Giá trị giảm
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={form.discountValue}
                onChange={(e) =>
                  update("discountValue", e.target.value)
                }
                placeholder={
                  form.discountType === "PERCENTAGE"
                    ? "Ví dụ: 10"
                    : "Ví dụ: 20000"
                }
                required
              />
            </label>

            <label style={labelStyle}>
              Giá trị đơn hàng tối thiểu (VNĐ)
              <input
                style={inputStyle}
                type="number"
                min="0"
                value={form.minOrderValue}
                onChange={(e) =>
                  update("minOrderValue", e.target.value)
                }
              />
            </label>

            <label style={labelStyle}>
              Giảm tối đa (VNĐ)
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={form.maxDiscount}
                onChange={(e) =>
                  update("maxDiscount", e.target.value)
                }
                placeholder="Để trống nếu không giới hạn"
              />
            </label>

            <label style={labelStyle}>
              Thời gian bắt đầu
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => update("startAt", e.target.value)}
                required
              />
            </label>

            <label style={labelStyle}>
              Thời gian kết thúc
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => update("endAt", e.target.value)}
                required
              />
            </label>
          </div>

          <label style={labelStyle}>
            Giới hạn lượt sử dụng
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={form.usageLimit}
              onChange={(e) =>
                update("usageLimit", e.target.value)
              }
              placeholder="Để trống nếu không giới hạn"
            />
          </label>

          {message && (
            <p
              style={{
                marginBottom: 16,
                color: created ? "green" : "#d32f2f",
                fontWeight: 600,
              }}
            >
              {message}
            </p>
          )}

          {created && (
            <div
              style={{
                background: "#f0faf2",
                padding: 14,
                borderRadius: 8,
                marginBottom: 18,
                color: "#237a38",
              }}
            >
              <strong>{created.code}</strong> đã được tạo thành công.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#6f4e37",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Đang tạo..." : "Tạo mã khuyến mãi"}
          </button>
        </form>
      </div>
    </div>
  );
}
