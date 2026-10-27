"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { useApp } from "@/context/AppContext";
export default function Login() {
  const [email, E] = useState(""), [password, P] = useState(""), [error, X] = useState(""), [loading, L] = useState(false);
  const { setToken, setName } = useApp(), router = useRouter();
  async function submit(e: FormEvent) {
    e.preventDefault();
    X("");
    if (password.length < 8) {
      X("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password.length > 72) {
      X("Mật khẩu không được vượt quá 72 ký tự.");
      return;
    }
    L(true);
    try {
      const r = await login(email, password), t = String(r.accessToken ?? r.access_token ?? r.token ?? "");
      if (!t) throw Error("API chưa trả về token.");
      setToken(t);
      setName(String(r.name ?? email.split("@")[0]));
      router.push("/checkout");
    } catch (e) {
      X(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      L(false);
    }
  } return <div className="auth">
    <form className="form" onSubmit={submit}>
      <Link href="/">← Về trang chủ</Link>
      <small>YOUR BREWLITE ACCOUNT</small>
      <h1>Đăng nhập</h1>
      <label>Email<input type="email" value={email} onChange={e => E(e.target.value)} required />
      </label>
      <label>Mật khẩu<input type="password" value={password} onChange={e => P(e.target.value)} required minLength={8} maxLength={72} />
      </label>{error && <p className="error">{error}
      </p>}
      <button className="btn wide" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập ↗"}
      </button>
      <p>Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link>
      </p>
    </form>
  </div>;
}
