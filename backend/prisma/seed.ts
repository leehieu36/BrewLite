import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const products = [
    { name: 'Cà phê sữa đá', description: 'Cà phê Việt Nam đậm vị, dùng cùng sữa đặc.', price: 29000, stock: 50, imageUrl: null },
    { name: 'Bạc xỉu', description: 'Sữa tươi và cà phê, vị nhẹ.', price: 32000, stock: 40, imageUrl: null },
    { name: 'Americano', description: 'Espresso pha với nước nóng hoặc đá.', price: 35000, stock: 35, imageUrl: null },
    { name: 'Trà đào cam sả', description: 'Trà trái cây thanh mát.', price: 39000, stock: 30, imageUrl: null },
    { name: 'Matcha latte', description: 'Matcha kết hợp sữa.', price: 42000, stock: 25, imageUrl: null },
  ];
  for (const p of products) await prisma.product.upsert({
    where: { id: `seed-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }, update: {
      name: p.name,
      description: p.description,
      price: p.price,
    }, create: { ...p, id: `seed-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }
  });
  console.log(`Seeded ${products.length} products`);
}
main().finally(() => prisma.$disconnect());
