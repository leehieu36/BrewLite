"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Item, Product, Size } from "@/lib/types";
type C = {
  cart: Item[];
  count: number;
  total: number;
  add: (p: Product, s: Size, t: string[], q: number) => void;
  qty: (k: string, n: number) => void;
  remove: (k: string) => void;
  clear: () => void;
  token: string | null;
  setToken: (s: string | null) => void;
  name: string;
  setName: (s: string) => void;
};
const X = createContext<C | null>(null);
export function AppProvider({ children }: {
  children: ReactNode;
}) {
  const [cart, S] = useState<Item[]>([]), [token, T] = useState<string | null>(null), [name, N] = useState(""), [ready, R] = useState(false);
  useEffect(() => {
    try {
      S(JSON.parse(localStorage.getItem("bl_cart") || "[]"));
      T(localStorage.getItem("bl_token"));
      N(localStorage.getItem("bl_name") || "");
    } catch { } R(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("bl_cart", JSON.stringify(cart));
  }, [cart, ready]);
  const add = (p: Product, s: Size, t: string[], q: number) => {
    const k = p.id + s + t.slice().sort().join("");
    const unitPrice = p.price + (s === "S" ? 0 : s === "M" ? 5000 : 10000) + t.length * 7000;
    S(a => {
      const old = a.find(i => i.key === k);
      return old ? a.map(i => i.key === k ? { ...i, quantity: i.quantity + q } : i) : [...a, { key: k, productId: p.id, name: p.name, image: p.image, size: s, toppings: t, quantity: q, unitPrice }];
    });
  };
  const setToken = (v: string | null) => {
    T(v);
    v ? localStorage.setItem("bl_token", v) : localStorage.removeItem("bl_token");
  };
  const setName = (v: string) => {
    N(v);
    v ? localStorage.setItem("bl_name", v) : localStorage.removeItem("bl_name");
  };
  return <X.Provider value={{ cart, count: cart.reduce((a, i) => a + i.quantity, 0), total: cart.reduce((a, i) => a + i.unitPrice * i.quantity, 0), add, qty: (k, n) => n < 1 ? S(a => a.filter(i => i.key !== k)) : S(a => a.map(i => i.key === k ? { ...i, quantity: n } : i)), remove: k => S(a => a.filter(i => i.key !== k)), clear: () => S([]), token, setToken, name, setName }}>{children}
  </X.Provider>;
} export function useApp() {
  const c = useContext(X);
  if (!c) throw Error("AppProvider missing");
  return c;
}
