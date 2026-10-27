# Backend BrewLite

Backend REST API cho dự án BrewLite, sử dụng **NestJS + TypeScript + PostgreSQL + Prisma**. Tiền tố API: `/api`. Nhà cung cấp thanh toán được mô phỏng; đây là phiên bản phục vụ phát triển và đồ án, không phải hệ thống xử lý thanh toán thực tế.

## 1. Chạy bằng Docker (khuyến nghị)

1. Sao chép `.env.example` thành `.env` và đặt `JWT_SECRET` thành một chuỗi ngẫu nhiên dài, khó đoán.
2. Mở Terminal tại thư mục backend và chạy:

```bash
docker compose up --build
```

API chạy tại `http://localhost:3001/api`; PostgreSQL sử dụng cổng `5432`. Khi khởi động, container chạy migration ban đầu và tạo dữ liệu sản phẩm mẫu.

## 2. Chạy trong môi trường phát triển cục bộ

Yêu cầu: Node.js 20 trở lên, npm và PostgreSQL 16 trở lên.

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run start:dev
```

Kiểm tra tình trạng hoạt động tại `GET http://localhost:3001/api/health`.

## 3. Danh sách API

| Phương thức | Endpoint | Xác thực | Chức năng |
|---|---|---|---|
| GET | `/api/health` | Không | Kiểm tra API và kết nối cơ sở dữ liệu |
| GET | `/api/products?page=1&limit=20&q=ca%20phe` | Không | Danh sách, tìm kiếm và phân trang sản phẩm |
| GET | `/api/products/:id` | Không | Xem chi tiết sản phẩm |
| POST | `/api/auth/register` | Không | Tạo tài khoản |
| POST | `/api/auth/login` | Không | Đăng nhập và nhận JWT |
| POST | `/api/orders` | Bearer JWT | Tạo đơn hàng và trừ tồn kho trong giao dịch |
| GET | `/api/orders/me` | Bearer JWT | Xem lịch sử đơn hàng của người dùng hiện tại |
| GET | `/api/orders/:id` | Bearer JWT | Xem một đơn hàng thuộc quyền sở hữu của người dùng |
| POST | `/api/payments` | Bearer JWT + `Idempotency-Key` | Thanh toán mô phỏng và chuyển đơn hàng sang `PAID` |

### Đăng ký tài khoản

```json
{"email":"demo@example.com","password":"Password123!","name":"Demo"}
```

### Đăng nhập

```json
{"email":"demo@example.com","password":"Password123!"}
```

Dùng `accessToken` nhận được trong các yêu cầu tiếp theo qua header:

```text
Authorization: Bearer <accessToken>
```

### Tạo đơn hàng

```json
{"items":[{"productId":"seed-c-ph-s-a","qty":2,"size":"M"}]}
```

Hãy dùng `id` thực tế trả về từ `GET /api/products`; ID trong ví dụ chỉ mang tính minh họa.

### Thanh toán mô phỏng

Gửi các header:

```text
Authorization: Bearer <token>
Idempotency-Key: checkout-demo-0001
```

Dùng một khóa mới cho mỗi lần thanh toán riêng biệt. Nội dung yêu cầu:

```json
{"orderId":"<order-id-from-create-order>","method":"VNPAY"}
```

Frontend hỗ trợ `COD`, `BANK_TRANSFER`, `VNPAY` và `MOMO`. COD tạo đơn ở trạng thái `PENDING`, thanh toán khi nhận hàng. Các phương thức chuyển khoản/ví hiện chỉ hiển thị QR minh họa và được backend mô phỏng thành công; chúng chưa kết nối ngân hàng, VNPay hoặc MoMo và không nhận tiền thật. Khi thanh toán mô phỏng thành công, trạng thái đơn hàng chuyển từ `PENDING` sang `PAID`; người dùng được cộng 1 điểm tích lũy cho mỗi 10.000 VND. Khóa chống trùng được đặt duy nhất trong cơ sở dữ liệu để bảo vệ các lần gửi lại yêu cầu.

## 4. Quy trình trạng thái đơn hàng

Trạng thái thông thường: `PENDING → PAID → PREPARING → READY → COMPLETED`.

Các trạng thái ngoại lệ gồm `PAYMENT_FAILED` và `CANCELLED`. Bộ mã hiện có kiểm tra chuyển trạng thái trong `OrdersService.updateStatus`, nhưng chưa có API công khai để nhân viên/quản trị viên cập nhật trạng thái. Cần bổ sung phân quyền nhân viên trước khi mở các thao tác chuẩn bị đơn hàng.

## 5. Lưu ý và giới hạn

- Giá được lưu dưới dạng số nguyên VND, không dùng số thực dấu phẩy động.
- Tồn kho được trừ trong giao dịch cơ sở dữ liệu bằng cập nhật có điều kiện để hạn chế bán vượt số lượng khi có yêu cầu đồng thời.
- API danh sách chỉ trả về sản phẩm đang hoạt động.
- Mã khuyến mãi được lưu trong đơn hàng nhưng chưa giảm giá vì chưa xác định quy tắc khuyến mãi.
- Thanh toán chỉ được mô phỏng. Trước khi sử dụng thật, cần tích hợp nhà cung cấp thanh toán và xác minh chữ ký callback.
- Khi triển khai thực tế, nên bổ sung giới hạn tần suất yêu cầu, logging/giám sát, refresh token, xác minh email, phân quyền nhân viên/quản trị viên, nhật ký kiểm toán và quy trình migration trong CI.
- Không đưa file `.env` lên Git. Thay khóa bí mật phát triển trước khi triển khai.

## 6. Tích hợp frontend

Cấu hình URL API cơ sở của frontend Next.js thành `http://localhost:3001/api` trong môi trường phát triển cục bộ. Frontend gửi JSON với header:

```text
Content-Type: application/json
```

Các API cần xác thực phải gửi thêm:

```text
Authorization: Bearer <accessToken>
```

Đảm bảo frontend chạy đúng địa chỉ được cấu hình trong `FRONTEND_ORIGIN`; giá trị mặc định là `http://localhost:3000`.
