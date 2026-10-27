"use client";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
export default function Header() {
  const { count, token, name, setToken, setName } = useApp();
  return <header className="header">
    <Link className="brand" href="/">☕ Brew<span>Lite</span>
    </Link>
    <nav>
      <Link href="/">Thực đơn</Link>
      <Link href="/orders">Lịch sử đơn hàng</Link>
      <Link href="/cart">Giỏ hàng <b>{count}
      </b>
      </Link>{token ? <button onClick={() => {
        setToken(null);
        setName("");
      }}>Thoát{name ? ` (${name})` : ""}
      </button> : <Link href="/login">Đăng nhập</Link>}
    </nav>
  </header>;
}
