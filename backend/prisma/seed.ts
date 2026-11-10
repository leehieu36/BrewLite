
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const products = [
    { name: 'Cà phê sữa đá', description: 'Cà phê Việt Nam đậm vị, dùng cùng sữa đặc.', price: 29000, stock: 50, imageUrl: null },
    { name: 'Bạc xỉu', description: 'Sữa tươi và cà phê, vị nhẹ.', price: 32000, stock: 40, imageUrl: null },
    { name: 'Americano', description: 'Espresso pha với nước nóng hoặc đá.', price: 35000, stock: 35, imageUrl: null },
    { name: 'Trà đào cam sả', description: 'Trà trái cây thanh mát.', price: 39000, stock: 30, imageUrl: null },
    { name: 'Matcha latte', description: 'Matcha kết hợp sữa.', price: 42000, stock: 25, imageUrl: null },
  ];

  for (const p of products) {
    const id = `seed-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    await prisma.product.upsert({
      where: { id },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
      },
      create: { ...p, id },
    });
  }

  console.log(`Seeded ${products.length} products`);

  const accounts = [
    {
      email: 'khachhang@gmail.com',
      password: 'khach123456',
      name: 'Lê Ngọc Hiếu',
      role: UserRole.CUSTOMER,
    },
    {
      email: 'nhanvien@gmail.com',
      password: 'nhanvien123456',
      name: 'Nguyễn Tiến Đạt',
      role: UserRole.STAFF,
    },
    {
      email: 'admin@gmail.com',
      password: 'admin123456',
      name: 'Quản trị viên',
      role: UserRole.ADMIN,
    },
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);

    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        name: account.name,
        role: account.role,
      },
      create: {
        email: account.email,
        passwordHash,
        name: account.name,
        role: account.role,
      },
    });
  }

  console.log(`Seeded ${accounts.length} test accounts`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
