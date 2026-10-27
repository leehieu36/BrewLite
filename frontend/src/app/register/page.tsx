"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api";
import { useApp } from "@/context/AppContext";
export default function Register() {
  const [name, N] = useState(""), [email, E] = useState(""), [password, P] = useState(""), [confirm, C] = useState(""), [error, X] = useState(""), [loading, L] = useState(false);
  const { setToken, setName } = useApp(), router = useRouter();
  async function submit(e: FormEvent) {
    e.preventDefault();
    X("");
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      X("Vui lòng nhập email hợp lệ, ví dụ abc@gmail.com.");
      return;
    }
    if (password.length < 8) {
      X("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password.length > 72) {
      X("Mật khẩu không được vượt quá 72 ký tự.");
      return;
    }
    if (password !== confirm) {
      X("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    L(true);
    try {
      const r = await register(name, normalizedEmail, password), t = String(r.accessToken ?? r.access_token ?? r.token ?? "");
      setName(name);
      if (t) {
        setToken(t);
        router.push("/checkout");
      } else {
        X("Đăng ký thành công. Hãy đăng nhập.");
        router.push("/login");
      }
    } catch (e) {
      X(e instanceof Error ? e.message : "Đăng ký thất bại");
    } finally {
      L(false);
    }
  } return <div className="auth">
    <form className="form" onSubmit={submit}>
      <Link href="/">← Về trang chủ</Link>
      <small>CREATE YOUR ACCOUNT</small>
      <h1>Đăng ký</h1>
      <label>Tên hiển thị<input value={name} onChange={e => N(e.target.value)} required />
      </label>
      <label>Email<input type="email" value={email} onChange={e => E(e.target.value)} required />
      </label>
      <label>Mật khẩu<input type="password" value={password} onChange={e => P(e.target.value)} minLength={8} maxLength={72} required />
      </label>
      <label>Xác nhận mật khẩu<input type="password" value={confirm} onChange={e => C(e.target.value)} minLength={8} maxLength={72} required />
      </label>{error && <p className="error">{error}
      </p>}
      <button className="btn wide" disabled={loading}>{loading ? "Đang tạo tài khoản..." : "Tạo tài khoản ↗"}
      </button>
      <p>Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
      </p>
    </form>
  </div>;
}
