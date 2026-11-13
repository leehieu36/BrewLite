
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function Login() {
  const [email, E] = useState("");
  const [password, P] = useState("");
  const [error, X] = useState("");
  const [loading, L] = useState(false);
  const { setToken, setName, setRole } = useApp();
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    X("");

    if (password.length < 8)
      return X("Mật khẩu phải có ít nhất 8 ký tự.");

    if (password.length > 72)
      return X("Mật khẩu không được vượt quá 72 ký tự.");

    L(true);

    try {
      const r = await login(email, password);
      const t = String(
        r.accessToken ?? r.access_token ?? r.token ?? ""
      );

      if (!t) throw Error("API chưa trả về token.");

      const userRole = String(r.user?.role ?? "CUSTOMER");

      setToken(t);
      setName(String(r.user?.name ?? r.name ?? email.split("@")[0]));
      setRole(userRole);

      router.push("/");
    } catch (e) {
      X(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      L(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <form className="form" onSubmit={submit}>
          <Link href="/" className="back-home">
            ← Về trang chủ
          </Link>

          <small>YOUR BREWLITE ACCOUNT</small>
          <h1>Đăng nhập</h1>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => E(e.target.value)}
              required
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => P(e.target.value)}
              required
              minLength={8}
              maxLength={72}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="btn wide" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <p>
            Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
