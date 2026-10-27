import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import Header from "@/components/Header";
export const metadata: Metadata = { title: "BrewLite — Coffee & Tea", description: "Đặt đồ uống với BrewLite" };
export default function Layout({ children }: {
  children: React.ReactNode;
}) {
  return <html lang="vi">
    <body>
      <AppProvider>
        <Header />
        <main>{children}
        </main>
        <footer>BrewLite · Một chút nhẹ nhàng trong ngày của bạn.</footer>
      </AppProvider>
    </body>
  </html>;
}
