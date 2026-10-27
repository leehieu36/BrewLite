export type Size = "S" | "M" | "L";
export type Method = "COD" | "BANK_TRANSFER" | "VNPAY" | "MOMO";

export type Product = {
  id: string;
  name: string;
  price: number;
  image?: string;
  description?: string;
  category?: string;
};

export type Item = {
  key: string;
  productId: string;
  name: string;
  image?: string;
  size: Size;
  toppings: string[];
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  status: string;
  total?: number;
  createdAt?: string;
  items?: OrderItem[];
  payments?: Payment[];
};

export type OrderItem = {
  id: string;
  qty: number;
  size: Size;
  toppings: string[];
  unitPrice: number;
  lineTotal: number;
  product: {
    name: string;
  };
};

export type Payment = {
  id: string;
  amount: number;
  method: Method;
  status: string;
  createdAt: string;
};
