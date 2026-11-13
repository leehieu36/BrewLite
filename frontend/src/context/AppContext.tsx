
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Item, Product, Size } from "@/lib/types";
import { getMyProfile } from "@/lib/api";

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
  role: string;
  setRole: (s: string) => void;
  logout: () => void;
  confirm: (message: string, title?: string) => Promise<boolean>;
};

const X = createContext<C | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, S] = useState<Item[]>([]);
  const [token, T] = useState<string | null>(null);
  const [name, N] = useState("");
  const [role, Q] = useState("CUSTOMER");
  const [ready, R] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const confirmResolver = useRef<((result: boolean) => void) | null>(null);

  
useEffect(() => {
  let active = true;

  const initialize = async () => {
    try {
      const savedCart = JSON.parse(
        localStorage.getItem("bl_cart") || "[]"
      );

      S(Array.isArray(savedCart) ? savedCart : []);
    } catch {
      S([]);
    }

    const savedToken = localStorage.getItem("bl_token");
    const savedName = localStorage.getItem("bl_name") || "";
    const savedRole = localStorage.getItem("bl_role") || "CUSTOMER";

    if (!savedToken) {
      T(null);
      N("");
      Q("CUSTOMER");
      R(true);
      return;
    }

    try {
      const profile = await getMyProfile(savedToken);

      if (!active) return;

      T(savedToken);
      N(profile.name || profile.email || "");
      Q(profile.role || "CUSTOMER");

      localStorage.setItem(
        "bl_name",
        profile.name || profile.email || ""
      );
      localStorage.setItem(
        "bl_role",
        profile.role || "CUSTOMER"
      );
    } catch (error) {
      if (!active) return;

      const expired =
        error instanceof Error &&
        error.message.includes("Phiên đăng nhập đã hết hạn");

      if (expired) {
        T(null);
        N("");
        Q("CUSTOMER");

        localStorage.removeItem("bl_token");
        localStorage.removeItem("bl_name");
        localStorage.removeItem("bl_role");
      } else {
        T(savedToken);
        N(savedName);
        Q(savedRole);
      }
    } finally {
      if (active) R(true);
    }
  };

  void initialize();

  return () => {
    active = false;
  };
}, []);

  useEffect(() => {
    if (ready) {
      localStorage.setItem("bl_cart", JSON.stringify(cart));
    }
  }, [cart, ready]);

  const add = (p: Product, s: Size, t: string[], q: number) => {
    const k = p.id + s + t.slice().sort().join("");
    const unitPrice =
      p.price + (s === "S" ? 0 : s === "M" ? 5000 : 10000) + t.length * 7000;

    S((a) => {
      const old = a.find((i) => i.key === k);

      return old
        ? a.map((i) =>
            i.key === k ? { ...i, quantity: i.quantity + q } : i
          )
        : [
            ...a,
            {
              key: k,
              productId: p.id,
              name: p.name,
              image: p.image,
              size: s,
              toppings: t,
              quantity: q,
              unitPrice,
            },
          ];
    });
  };

  const setToken = (v: string | null) => {
    T(v);

    if (v) {
      localStorage.setItem("bl_token", v);
    } else {
      localStorage.removeItem("bl_token");
    }
  };

  const setName = (v: string) => {
    N(v);

    if (v) {
      localStorage.setItem("bl_name", v);
    } else {
      localStorage.removeItem("bl_name");
    }
  };

  const setRole = (v: string) => {
    Q(v);
    localStorage.setItem("bl_role", v);
  };

  const logout = () => {
    T(null);
    N("");
    Q("CUSTOMER");

    localStorage.removeItem("bl_token");
    localStorage.removeItem("bl_name");
    localStorage.removeItem("bl_role");
  };

  const confirm = (message: string, title = "Xác nhận") => {
    return new Promise<boolean>((resolve) => {
      if (confirmResolver.current) {
        confirmResolver.current(false);
      }

      confirmResolver.current = resolve;
      setConfirmDialog({ title, message });
    });
  };

  const closeConfirm = (result: boolean) => {
    setConfirmDialog(null);

    const resolver = confirmResolver.current;
    confirmResolver.current = null;
    resolver?.(result);
  };

  return (
    <X.Provider
      value={{
        cart,
        count: cart.reduce((a, i) => a + i.quantity, 0),
        total: cart.reduce((a, i) => a + i.unitPrice * i.quantity, 0),
        add,
        qty: (k, n) =>
          n < 1
            ? S((a) => a.filter((i) => i.key !== k))
            : S((a) =>
                a.map((i) => (i.key === k ? { ...i, quantity: n } : i))
              ),
        remove: (k) => S((a) => a.filter((i) => i.key !== k)),
        clear: () => S([]),
        token,
        setToken,
        name,
        setName,
        role,
        setRole,
        logout,
        confirm,
      }}
    >
      {children}

      {confirmDialog && (
        <div
          className="confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirm(false);
          }}
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="confirm-icon">!</div>

            <h2 id="confirm-title">{confirmDialog.title}</h2>

            <p>{confirmDialog.message}</p>

            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => closeConfirm(false)}
              >
                Hủy
              </button>

              <button
                type="button"
                className="confirm-accept"
                onClick={() => closeConfirm(true)}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </X.Provider>
  );
}

export function useApp() {
  const c = useContext(X);

  if (!c) throw Error("AppProvider missing");

  return c;
}
