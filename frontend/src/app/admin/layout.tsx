
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/context/AppContext";

const navItems = [
  { href: "/admin/inventory", label: "Tình trạng tồn kho" },
  { href: "/admin/orders", label: "Quản lý đơn hàng" },
  { href: "/admin/menu", label: "Quản lý thực đơn" },
  { href: "/admin/customers", label: "Quản lý khách hàng", adminOnly: true },
  { href: "/admin/activity", label: "Nhật ký hoạt động" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, role, name } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (role && role !== "ADMIN" && role !== "STAFF") {
      router.replace("/");
    }
  }, [token, role, router]);

  if (!token || (role !== "ADMIN" && role !== "STAFF")) {
    return (
      <div className="admin-loading">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-logo">☕</div>
          <div className="admin-brand-text">
            BrewLite
            <br />
            Management
          </div>
        </div>

        <div className="admin-sidebar-label">QUẢN LÝ</div>

        <nav className="admin-nav">
          {navItems
            .filter((item) => !item.adminOnly || role === "ADMIN")
            .map((item) => {
              const active = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-link ${active ? "active" : ""}`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-account">
            <div className="admin-avatar">
              {(name || "U").charAt(0).toUpperCase()}
            </div>

            <div className="admin-account-info">
              <strong>{name || "Người dùng"}</strong>
              <span>
                {role === "ADMIN" ? "Quản trị viên" : "Nhân viên"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
