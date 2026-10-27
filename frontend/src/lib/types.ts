export type Size = "S" | "M" | "L";
export type Method = "MOCK" | "COD";

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
};
