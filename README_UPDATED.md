# BrewLite - bản bổ sung quản trị và bảo mật

Bản này cập nhật cả `backend` và `frontend`.

## Cài đặt / chạy
1. Giải nén và thay thư mục `backend`, `frontend` hiện tại bằng hai thư mục trong gói này (nên sao lưu bản cũ trước).
2. Tại `backend`, cấu hình `.env` theo `.env.example`.
3. Chạy migration và sinh Prisma Client:

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start:dev
```

4. Ở terminal khác, chạy Frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định gọi API `http://localhost:3001/api`; có thể đặt `NEXT_PUBLIC_API_URL`.

## Cấp ADMIN đầu tiên
Đăng ký tài khoản thông thường trước, sau đó dùng PostgreSQL để cấp quyền ADMIN cho đúng email:

```sql
UPDATE "User"
SET "role" = 'ADMIN'
WHERE "email" = 'email-quan-tri-vien@example.com';
```

Đăng xuất rồi đăng nhập lại để Frontend nhận role mới.

## Chức năng mới
- Trang `/admin` dành cho ADMIN và STAFF.
- ADMIN quản lý tài khoản, tìm kiếm và cấp CUSTOMER / STAFF / ADMIN.
- ADMIN và STAFF xem nhật ký hoạt động, danh sách đơn hàng và cập nhật trạng thái.
- Backend kiểm tra JWT, vai trò và quyền sở hữu đơn hàng; không dựa vào việc ẩn/hiện nút ở Frontend.
- Ghi nhận đăng ký, đăng nhập thành công/thất bại, tạo đơn, thanh toán demo, truy cập danh sách khách hàng/đơn hàng, thay đổi trạng thái đơn và thay đổi vai trò.
- Không trả `passwordHash` trong API quản lý tài khoản.

Chi tiết xem `backend/SECURITY_AND_AUDIT.md`.

## Kiểm thử
- Frontend TypeScript: `npx tsc --noEmit` đã chạy thành công trong môi trường kiểm tra.
- Backend TypeScript syntax: đã kiểm tra cú pháp các file mới/sửa.
- Backend build đầy đủ cần chạy `npx prisma generate` trên máy của bạn vì môi trường kiểm tra không tải được Prisma engine tương ứng. Chạy các lệnh ở trên trước khi build.
