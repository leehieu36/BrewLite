# BrewLite - phân quyền và nhật ký hoạt động

## Thay đổi
- Thêm vai trò `CUSTOMER`, `STAFF`, `ADMIN`; đăng ký công khai luôn tạo `CUSTOMER`.
- Backend đọc vai trò hiện tại từ database khi xác thực JWT, vì vậy thay đổi quyền có hiệu lực ngay cả khi token cũ chưa hết hạn.
- `GET /api/admin/activity-logs`: ADMIN và STAFF được xem nhật ký.
- `GET /api/admin/users`: chỉ ADMIN; dữ liệu trả về không chứa passwordHash.
- `PATCH /api/admin/users/:id/role`: chỉ ADMIN; không cho tự đổi quyền và không cho hạ cấp quản trị viên cuối cùng.
- Ghi log đăng ký, đăng nhập thành công/thất bại, tạo đơn, thanh toán demo và thay đổi vai trò.
- Khách hàng chỉ xem đơn của chính mình; API đơn hàng và thanh toán kiểm tra quyền sở hữu ở backend.
- Bổ sung một số HTTP security headers.

## Cập nhật database
Tại thư mục `backend`, chạy:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

Nếu đang phát triển local và muốn Prisma tự áp dụng migration:

```bash
npx prisma migrate dev
npx prisma generate
npm run build
```

## Tạo quản trị viên đầu tiên
Đăng ký tài khoản bình thường trên website, sau đó chạy SQL trực tiếp trên PostgreSQL bằng email vừa đăng ký:

```sql
UPDATE "User"
SET "role" = 'ADMIN'
WHERE "email" = 'email-quan-tri-vien@example.com';
```

Không tạo API đăng ký ADMIN công khai. Chỉ người có quyền truy cập database mới được cấp ADMIN đầu tiên. Sau đó có thể cấp `STAFF` qua `PATCH /api/admin/users/:id/role` với body:

```json
{ "role": "STAFF" }
```

Các giá trị hợp lệ: `CUSTOMER`, `STAFF`, `ADMIN`.

## API quản trị
- `GET /api/orders/management`: ADMIN và STAFF; xem tối đa 50 đơn hàng gần nhất với thông tin khách hàng tối thiểu cần cho xử lý đơn. Việc truy cập được ghi log.\n- `PATCH /api/orders/:id/status`: ADMIN và STAFF; cập nhật trạng thái đơn theo luồng hợp lệ, mọi thay đổi được ghi log.\n- `GET /api/admin/summary`
- `GET /api/admin/activity-logs?page=1&limit=25`
- `GET /api/admin/users?page=1&limit=25&q=ten-hoac-email`
- `PATCH /api/admin/users/:id/role`

Các API cần header `Authorization: Bearer <accessToken>`.

## Lưu ý bảo mật
- Đặt `JWT_SECRET` dài, ngẫu nhiên và riêng cho môi trường triển khai; không dùng secret mặc định.
- Không commit `.env` hoặc đưa token/mật khẩu vào log.
- Nhật ký hiện lưu hành động xác thực, tạo đơn, thanh toán demo và đổi vai trò. Các thao tác quản trị sản phẩm/trạng thái đơn cần được bổ sung log khi các API staff tương ứng được triển khai.
- Payment online hiện vẫn là mô phỏng trong code hiện tại, không phải cổng thanh toán production.
