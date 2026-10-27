import type { Product, Order, Method } from "@/lib/types";
const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
async function req<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  let r: Response;
  try {
    r = await fetch(base + path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  } catch {
    throw Error("Không kết nối được backend. Kiểm tra backend và NEXT_PUBLIC_API_URL.");
  } const raw = await r.text();
  let d: any;
  try {
    d = raw ? JSON.parse(raw) : {};
  } catch {
    d = { message: raw };
  }
  if (!r.ok) {
    const message = Array.isArray(d.message)
      ? d.message[0]
      : typeof d.message === 'string'
        ? d.message
        : '';

    if (r.status === 401) {
      throw Error('Email hoặc mật khẩu không đúng.');
    }
    if (r.status === 409) {
      throw Error('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');
    }
    if (r.status === 400) {
      throw Error(message || 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra lại.');
    }
    if (r.status >= 500) {
      throw Error('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
    }

    throw Error(message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.');
  }
  return d as T;
}
const arr = <T,>(x: any): T[] => Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : Array.isArray(x?.items) ? x.items : [];
const catalog: Product[] = [{ id: "1", name: "Cà phê sữa", price: 35000, category: "Cà phê", description: "Cà phê đậm vị cùng sữa thơm béo.", image: "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=80" }, { id: "2", name: "Americano", price: 40000, category: "Cà phê", description: "Espresso pha với nước nóng.", image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80" }, { id: "3", name: "Cappuccino", price: 45000, category: "Cà phê", description: "Espresso, sữa nóng và bọt sữa mịn.", image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=900&q=80" }, { id: "4", name: "Trà đào", price: 39000, category: "Trà", description: "Trà thơm mát cùng vị đào dịu ngọt.", image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=80" }];

export async function products() {
  const p = arr<any>(await req("/products"));

  return {
    list: p.map((x: any, i: number) => ({
      id: String(x.id ?? i + 1),
      name: String(x.name ?? x.title ?? "Sản phẩm"),
      price: Number(x.price ?? 0),
      image:
        x.image ??
        x.imageUrl ??
        ({
          "Americano":
            "https://images.openai.com/static-rsc-4/Ri2HMExjAhuwRO-Gawi6oYhicFfQQIaFpi9a1sFBhR1pd_vLI1m5Uu2APTFQO30sPBZtGWxbvTia1C-yTdfs83RJdNqyZD_nt_qLEHTRAEMuKvMq-yastNvaK-pqzSsLzLSzcMJ91_Xw1_Je8NkX7mXe6lMoPpwWf73deLQgpwN-tLtKSXxwWGmYna_F4_pD?purpose=fullsize",

          "Bạc xỉu":
            "https://chaosuonbebu.com/cdn/shop/files/cafe-sua-tuoi-bac-siu_2.jpg?v=1738581102",

          "Cà phê sữa đá":
            "https://www.coffeebrewhub.com/uploads/images/engine_images/master-authentic-vietnamese-iced-coffee-ca-phe-sua-da-at-hom-2026-04-11.webp",

          "Matcha latte":
            "https://images.openai.com/static-rsc-4/2GMalk9B0h3H8-L0EKjsy2P2D6u6jER9f8vcIHS9HsFkDPzvr23QDryQEPba0yaiHcc0XHnj8m5x2fiyJfveBDwnjPttEj57b6EBy5xePKX3oT3_okQGsGmVGjXO31lZ5hzhvmOIG9OfDOIOKYo4tdlkGx7Dg0OkwXpy9686CaC_Go20bIjuEnIDWT6OetIx?purpose=fullsize",

          "Trà đào cam sả":
            "https://images.openai.com/static-rsc-4/byUp2mcw_xQHltNxqPxWdgZTyYuqacZvnua0uqMm6GfcwiWA51bTlwElVOfUO5nGR98W5IUgNJp_wJ-klkExtM_YhyOzQYFUDBkY6QbkqiaQvuSt_obxO849P2TPJ6BtMVysbpgUuirOJJz7ygeZHWVYExBQ5ig8NzIG1RaIhWSYyWqZwWtqpvu63cAmmmTA?purpose=fullsize",
        } as Record<string, string>)[String(x.name ?? x.title ?? "")] ??
        undefined,
      description: x.description ?? "",
      category: x.category ?? "Đồ uống",
    })) as Product[],
    demo: false,
    error: "",
  };
}

export const login = (email: string, password: string) => req<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const register = (name: string, email: string, password: string) => req<any>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
export const order = (items: unknown[], token: string) => req<any>("/orders", { method: "POST", body: JSON.stringify({ items }) }, token);
export const pay = (orderId: string, method: Method, token: string) =>
  req<any>(
    "/payments",
    {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ orderId, method }),
    },
    token
  );
export async function history(token: string) {
  return arr<Order>(await req("/orders/me", {}, token));
}
