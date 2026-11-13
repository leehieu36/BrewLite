
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function Header() {
  const {
    count,
    token,
    name,
    role,
    logout: logoutApp,
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const roleLabel =
    role === "ADMIN"
      ? "Quản trị viên"
      : role === "STAFF"
      ? "Nhân viên"
      : "Khách hàng";

  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "U";

  const logout = () => {
    setOpen(false);
    logoutApp();
    router.replace("/");
    router.refresh();
  };

  return (
    <header className={`header ${pathname.startsWith("/admin") ? "admin-header" : ""}`}>
      {pathname.startsWith("/admin") ? (
        <Link href="/" className="admin-header-home">
          ← Quay về trang chủ
        </Link>
      ) : (
        <Link className="brand" href="/">
          ☕ Brew<span>Lite</span>
        </Link>
      )}

      <div className="account-wrapper" ref={accountRef}>
        {token ? (
          <>
            <button
              type="button"
              className={`account-trigger ${open ? "active" : ""}`}
              onClick={() => setOpen(!open)}
              aria-expanded={open}
            >
              <span className="account-avatar">{initial}</span>
              <span className="account-trigger-info">
                <strong>{name || "Tài khoản"}</strong>
                <small>{roleLabel}</small>
              </span>
              <span className={`account-chevron ${open ? "rotated" : ""}`}>
                ▾
              </span>
            </button>

            {open && (
              <div className="account-dropdown">
                <div className="account-dropdown-header">
                  <span className="account-avatar large">{initial}</span>
                  <div className="account-user-info">
                    <strong>{name || "Người dùng"}</strong>
                    <span className={`account-role ${role?.toLowerCase()}`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <div className="account-divider" />

                <Link
                  href="/profile"
                  className="account-menu-item"
                  onClick={() => setOpen(false)}
                >
                  <span>👤</span>
                  Thông tin cá nhân
                </Link>

                {role === "CUSTOMER" && (
                  <>
                    <Link
                      href="/orders"
                      className="account-menu-item"
                      onClick={() => setOpen(false)}
                    >
                      <span>▤</span>
                      Lịch sử đơn hàng
                    </Link>

                    <Link
                      href="/cart"
                      className="account-menu-item"
                      onClick={() => setOpen(false)}
                    >
                      <span>🛒</span>
                      Giỏ hàng
                      <b className="account-cart-count">{count}</b>
                    </Link>
                  </>
                )}

                {(role === "ADMIN" || role === "STAFF") && (
                  <Link
                    href="/admin/inventory"
                    className="account-menu-item"
                    onClick={() => setOpen(false)}
                  >
                    <span>⚙</span>
                    Trang quản trị
                  </Link>
                )}

                <div className="account-divider" />

                <button
                  type="button"
                  className="account-menu-item logout-item"
                  onClick={logout}
                >
                  <span>↪</span>
                  Đăng xuất
                </button>
              </div>
            )}
          </>
        ) : pathname !== "/login" ? (
          <Link href="/login" className="login-link">
            Đăng nhập
          </Link>
        ) : null}
      </div>
    </header>
  );
}
