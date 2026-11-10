
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import {
  getMyProfile,
  updateMyProfile,
  type UserProfile,
} from "@/lib/api";

export default function ProfilePage() {
  const { token, setName } = useApp();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setNameValue] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getMyProfile(token)
      .then((data) => {
        setProfile(data);
        setNameValue(data.name || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
      })
      .catch((err) => {
        setError(err.message || "Không thể tải thông tin tài khoản");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const updated = await updateMyProfile(token, {
        name,
        phone,
        address,
      });

      setProfile(updated);
      setNameValue(updated.name || "");
      setName(updated.name || "");
      setMessage("Cập nhật thông tin thành công!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Cập nhật thất bại",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="profile-page">Đang tải thông tin...</main>;
  }

  if (!token) {
    return (
      <main className="profile-page">
        <div className="profile-card">
          <h2>Vui lòng đăng nhập</h2>
          <p>Bạn cần đăng nhập để xem thông tin khách hàng.</p>
          <Link href="/login">Đăng nhập</Link>
        </div>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="profile-page">
        <div className="profile-card">
          <p className="profile-error">{error}</p>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="profile-page">
      <div className="profile-container">
        <div className="profile-heading">
          <div>
            <p className="profile-subtitle">TÀI KHOẢN CỦA BẠN</p>
            <h1>Thông tin khách hàng</h1>
            <p>Quản lý thông tin cá nhân và tài khoản BrewLite.</p>
          </div>
          <Link href="/" className="profile-back">
            ← Về trang chủ
          </Link>
        </div>

        <div className="profile-layout">
          <aside className="profile-summary">
            <div className="profile-avatar">
              {(profile.name || profile.email).charAt(0).toUpperCase()}
            </div>
            <h2>{profile.name || "Khách hàng"}</h2>
            <p>{profile.email}</p>
            <span className="profile-role">
              {profile.role === "ADMIN"
                ? "Quản trị viên"
                : profile.role === "STAFF"
                ? "Nhân viên"
                : "Khách hàng"}
            </span>

            <div className="profile-points">
              <span>Điểm tích lũy</span>
              <strong>{profile.loyaltyPoints}</strong>
            </div>

            <Link href="/orders" className="profile-order-link">
              Lịch sử đơn hàng →
            </Link>
          </aside>

          <section className="profile-card">
            <h2>Thông tin cá nhân</h2>
            <p className="profile-description">
              Cập nhật thông tin để thuận tiện cho việc đặt hàng và giao hàng.
            </p>

            <form onSubmit={handleSave}>
              <div className="profile-field">
                <label>Họ và tên</label>
                <input
                  value={name}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder="Nhập họ và tên"
                  maxLength={100}
                />
              </div>

              <div className="profile-field">
                <label>Email</label>
                <input value={profile.email} disabled />
                <small>Email tài khoản không thể thay đổi.</small>
              </div>

              <div className="profile-field">
                <label>Số điện thoại</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  maxLength={20}
                />
              </div>

              <div className="profile-field">
                <label>Địa chỉ giao hàng</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Nhập địa chỉ giao hàng"
                  rows={3}
                  maxLength={255}
                />
              </div>

              {message && <p className="profile-success">{message}</p>}
              {error && <p className="profile-error">{error}</p>}

              <button type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
