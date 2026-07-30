# IceCream POS

IceCream POS là ứng dụng full-stack quản lý và bán hàng tại quầy cho cửa hàng kem. Dự án dùng SQLite theo cùng hướng triển khai với dự án tham chiếu `D:\project\facebook`, vì vậy không cần PostgreSQL hoặc Docker để chạy trên máy Windows.

## Công nghệ

- Frontend: React 18, Vite, JavaScript, Tailwind CSS với prefix `tw-`, Material UI v5, React Router, Axios, React Query, React Hook Form, Day.js, React Toastify, Recharts và Socket.IO Client.
- Backend: Node.js, Express, Prisma ORM, SQLite, JWT access/refresh token, bcrypt, Zod, Multer/Cloudinary, Socket.IO, ExcelJS và PDFKit.
- Dữ liệu: SQLite lưu bền vững tại `server/prisma/dev.db`; Prisma migration và seed được quản lý trong `server/prisma`.

## Chức năng đã triển khai

- Đăng nhập bằng username/email, refresh token bằng cookie HttpOnly, đăng xuất, đổi/quên/đặt lại mật khẩu, cập nhật hồ sơ và lịch sử đăng nhập.
- Phân quyền backend theo role/permission cho `ADMIN`, `MANAGER`, `CASHIER`, `WAREHOUSE`, `STAFF`; khóa/mở tài khoản nhân viên.
- Quản lý sản phẩm, danh mục, biến thể, hương vị, topping, ảnh, tìm kiếm, lọc, phân trang và xóa mềm.
- POS cảm ứng: chọn biến thể, số viên, từng hương vị, nhiều topping, số lượng, ghi chú, khách hàng, điểm, khuyến mãi, VAT, phí giao hàng, tiền khách đưa và tiền thừa.
- Lưu/khôi phục đơn tạm, thanh toán, in/xuất PDF, trạng thái đơn theo thời gian thực, hoàn tiền và lịch sử trạng thái.
- Backend tự tính lại toàn bộ giá, khuyến mãi và tổng thanh toán; không tin số tổng từ frontend.
- Khách hàng, hạng thành viên, tích/dùng điểm, lịch sử điểm và tự nâng hạng.
- Kho theo chi nhánh/lô/hạn dùng, nhập–xuất–điều chỉnh–chuyển kho, cảnh báo tồn thấp/hết hạn, công thức định lượng và chặn tồn âm.
- Nhà cung cấp và phiếu nhập; chỉ tăng kho khi phiếu chuyển sang `RECEIVED`.
- Ca làm việc, tiền đầu ca, doanh thu theo phương thức, chi phí, kiểm đếm và chênh lệch cuối ca.
- Dashboard lấy dữ liệu thật từ SQLite, lọc thời gian/chi nhánh, so sánh kỳ trước và xuất Excel/PDF.
- Audit log cho các thao tác quan trọng, Helmet, CORS, rate limit, validate request và xử lý lỗi tập trung.

## Yêu cầu trên Windows

- Windows 10/11.
- Node.js 20 LTS trở lên, kèm npm.
- Không cần cài SQLite riêng, PostgreSQL hay Docker Desktop.

Kiểm tra:

```powershell
node --version
npm --version
```

## Cài đặt lần đầu

Mở PowerShell tại thư mục dự án:

```powershell
cd D:\project\icecream
npm install
npm run install:all
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
npm --prefix server run db:prepare
```

Lệnh `db:prepare` sẽ:

1. Sinh Prisma Client.
2. Chạy tất cả migration SQLite.
3. Seed dữ liệu mẫu nếu database đang trống.

Sau đó chạy cả frontend và backend:

```powershell
npm run dev
```

- Giao diện: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:4001/api](http://localhost:4001/api)
- Health check: [http://localhost:4001/api/health](http://localhost:4001/api/health)

## Tài khoản demo

Mật khẩu chung: `IceCream@123`

| Vai trò | Tên đăng nhập | Email |
|---|---|---|
| Quản trị viên | `admin` | `admin@icecream.local` |
| Quản lý | `manager` | `manager@icecream.local` |
| Thu ngân | `cashier` | `cashier@icecream.local` |
| Nhân viên kho | `warehouse` | `warehouse@icecream.local` |

Seed tạo tổng cộng 10 nhân viên, 2 chi nhánh, 8 danh mục, 30 sản phẩm, 12 hương vị, 15 topping, 30 nguyên liệu, 50 khách hàng, 100 đơn hàng, tồn kho theo lô, công thức, khuyến mãi và ca mẫu.

## Biến môi trường

Backend dùng `server/.env`:

```dotenv
NODE_ENV=development
PORT=4001
CLIENT_URL=http://localhost:5173
DATABASE_URL=file:./dev.db
ACCESS_TOKEN_SECRET=thay_bang_chuoi_ngau_nhien_dai_it_nhat_32_ky_tu
REFRESH_TOKEN_SECRET=thay_bang_mot_chuoi_ngau_nhien_khac
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
COOKIE_SECURE=false
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
MAX_FILE_SIZE_MB=5
```

Frontend dùng `client/.env`:

```dotenv
VITE_API_URL=http://localhost:4001/api
VITE_SOCKET_URL=http://localhost:4001
```

Cloudinary là tùy chọn. Nếu không cấu hình, ảnh được lưu cục bộ trong `server/uploads`. Khi triển khai HTTPS, đặt `COOKIE_SECURE=true`, thay toàn bộ JWT secret và cấu hình đúng `CLIENT_URL`.

## Các lệnh hữu ích

```powershell
# Chạy development
npm run dev

# Kiểm tra source backend và build frontend production
npm run build

# Chạy kiểm thử tích hợp API
npm test

# Mở Prisma Studio
npm --prefix server run prisma:studio

# Tạo migration mới sau khi sửa schema
npm --prefix server run prisma:migrate -- --name ten_migration

# Seed lại dữ liệu
npm --prefix server run prisma:seed
```

## Reset database mẫu

Dừng server trước, sau đó chạy:

```powershell
Remove-Item -LiteralPath D:\project\icecream\server\prisma\dev.db
npm --prefix server run db:prepare
```

Thao tác này xóa toàn bộ dữ liệu hiện tại và tạo lại dữ liệu mẫu. Hãy sao lưu file `server/prisma/dev.db` trước khi reset nếu đang dùng dữ liệu thật.

## Cấu trúc

```text
icecream/
├─ client/
│  └─ src/
│     ├─ components/     Component dùng chung
│     ├─ features/       Luồng nghiệp vụ POS/sản phẩm
│     ├─ layouts/        Khung quản trị responsive
│     ├─ pages/          Dashboard, POS, đơn, kho...
│     ├─ routes/         Route bảo vệ theo quyền
│     ├─ services/       Axios và Socket.IO
│     ├─ store/          Auth và light/dark mode
│     └─ utils/
├─ server/
│  ├─ prisma/
│  │  ├─ migrations/
│  │  ├─ schema.prisma
│  │  └─ seed.js
│  └─ src/
│     ├─ config/
│     ├─ middlewares/
│     ├─ modules/
│     ├─ services/
│     ├─ sockets/
│     ├─ utils/
│     ├─ app.js
│     └─ server.js
└─ README.md
```

## Ghi chú khi dùng SQLite thực tế

SQLite phù hợp cho một cửa hàng hoặc một máy chủ ứng dụng duy nhất, dễ sao lưu bằng một file và không cần dịch vụ database riêng. Hãy đặt file database trên ổ đĩa cục bộ ổn định, sao lưu định kỳ và chỉ chạy một instance backend ghi vào database. Nếu sau này mở rộng nhiều máy chủ/chi nhánh truy cập đồng thời ở tải lớn, Prisma schema đã chuẩn hóa để có thể lập kế hoạch chuyển sang PostgreSQL.
