# IceCream POS

IceCream POS là ứng dụng full-stack quản lý và bán hàng tại quầy cho cửa hàng kem. Dự án dùng MySQL theo cùng cách cấu hình với dự án tham chiếu `D:\project\facebook`.

## Công nghệ

- Frontend: React 18, Vite, JavaScript, Tailwind CSS với prefix `tw-`, Material UI v5, React Router, Axios, React Query, React Hook Form, Day.js, React Toastify, Recharts và Socket.IO Client.
- Backend: Node.js, Express, Prisma ORM, MySQL, JWT access/refresh token, bcrypt, Zod, Multer/Cloudinary, Socket.IO, ExcelJS và PDFKit.
- Dữ liệu: MySQL 8 với database `icecream_pos`; Prisma migration và seed được quản lý trong `server/prisma`.

## Chức năng đã triển khai

- Đăng nhập bằng username/email, refresh token bằng cookie HttpOnly, đăng xuất, đổi/quên/đặt lại mật khẩu, cập nhật hồ sơ và lịch sử đăng nhập.
- Phân quyền backend theo role/permission cho `ADMIN`, `MANAGER`, `CASHIER`, `WAREHOUSE`, `STAFF`; khóa/mở tài khoản nhân viên.
- Quản lý sản phẩm, danh mục, biến thể, hương vị, topping, ảnh, tìm kiếm, lọc, phân trang và xóa mềm.
- POS cảm ứng: chọn biến thể, số viên, từng hương vị, nhiều topping, số lượng, ghi chú, khách hàng, khuyến mãi/voucher, VAT, phí giao hàng, tiền khách đưa và tiền thừa.
- Quản lý ưu đãi: tạo, sửa, bật/tắt, chọn sản phẩm hoặc danh mục, cấu hình thời gian và giới hạn sử dụng; hỗ trợ mua 3 tặng 1 với món hợp lệ rẻ nhất được miễn phí tại POS.
- Lưu/khôi phục đơn tạm, thanh toán, in/xuất PDF, trạng thái đơn theo thời gian thực, hoàn tiền và lịch sử trạng thái.
- Backend tự tính lại toàn bộ giá, khuyến mãi và tổng thanh toán; không tin số tổng từ frontend.
- Khách hàng, điểm xếp hạng, lịch sử điểm, tự nâng hạng và voucher theo hạng.
- Hội viên trả phí: quản lý cấu hình gói/phí/thời hạn và một biến thể quà cố định; thu ngân đăng ký hoặc gia hạn, ghi nhận phương thức thu phí; POS thêm quà vào đơn và tự miễn phí đúng một đơn vị mỗi ngày, chặn dùng lặp và hỗ trợ khuyến mãi chỉ dành cho hội viên còn hạn.
- Điểm khách hàng chỉ dùng để xét và nâng hạng, không quy đổi thành tiền. Khi lên hạng, hệ thống tự cấp voucher; hạn dùng, thời gian chờ và mức hóa đơn để cấp lại được quản lý cấu hình riêng theo từng hạng.
- Voucher luôn gắn với chi nhánh phát hành và chỉ được dùng tại chi nhánh đó. Admin có thể phát hành hàng loạt cho nhiều chi nhánh; Manager chỉ được phát hành và xem voucher thuộc các chi nhánh mình quản lý.
- Kho theo chi nhánh/lô/hạn dùng, nhập–xuất–điều chỉnh–chuyển kho, cảnh báo tồn thấp/hết hạn, công thức định lượng và chặn tồn âm.
- Nhà cung cấp và phiếu nhập; chỉ tăng kho khi phiếu chuyển sang `RECEIVED`.
- Ca làm việc, tiền đầu ca, doanh thu theo phương thức, chi phí, kiểm đếm và chênh lệch cuối ca.
- Dashboard lấy dữ liệu thật từ MySQL, lọc thời gian/chi nhánh, so sánh kỳ trước và xuất Excel/PDF; quản lý có thống kê doanh thu, giá vốn theo lô, lợi nhuận và biên lợi nhuận.
- Audit log cho các thao tác quan trọng, Helmet, CORS, rate limit, validate request và xử lý lỗi tập trung.

## Chính sách điểm và voucher theo hạng

Tài khoản `ADMIN` hoặc `MANAGER` mở menu **Hạng & voucher** (`/loyalty`) để cấu hình riêng cho từng hạng:

- Mốc điểm lên hạng và số điểm nhận trên mỗi `10.000đ`.
- Bật/tắt voucher, loại giảm tiền/phần trăm, giá trị giảm, mức giảm tối đa và giá trị đơn tối thiểu để dùng.
- Số ngày voucher còn hiệu lực, số ngày chờ sau khi dùng và giá trị hóa đơn tối thiểu để được cấp lại.
- Phát hành voucher thủ công cho khách hàng: Admin chọn được nhiều chi nhánh, Manager chỉ chọn được chi nhánh thuộc quyền quản lý. Hệ thống sinh một mã riêng cho từng chi nhánh.

Mặc định voucher có hạn `15 ngày`, thời gian chờ sau khi dùng là `15 ngày` và hóa đơn cấp lại tối thiểu là `200.000đ`. Backend tự cấp voucher trong transaction hoàn tất đơn, kiểm tra đúng chủ sở hữu và đúng chi nhánh khi áp dụng, sau đó khóa voucher ngay khi thanh toán; client không được tự gửi số tiền giảm.

## Yêu cầu trên Windows

- Windows 10/11.
- Node.js 20 LTS trở lên, kèm npm.
- MySQL 8 hoặc MySQL đi kèm XAMPP, chạy tại cổng `3306`.
- Không yêu cầu PostgreSQL hoặc Docker Desktop.

Kiểm tra:

```powershell
node --version
npm --version
```

Khởi động MySQL, sau đó tạo database và tài khoản bằng MySQL Workbench,
phpMyAdmin hoặc MySQL CLI:

```sql
CREATE DATABASE icecream_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'icecream_app'@'localhost'
  IDENTIFIED BY 'MAT_KHAU_CUA_ANH';
GRANT ALL PRIVILEGES ON icecream_pos.* TO 'icecream_app'@'localhost';
FLUSH PRIVILEGES;
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
2. Chạy tất cả migration MySQL.
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

Seed tạo tổng cộng 10 nhân viên, 2 chi nhánh, 8 danh mục, 30 sản phẩm, 12 hương vị, 15 topping, 30 nguyên liệu, 50 khách hàng, 100 đơn hàng, tồn kho theo lô, công thức, khuyến mãi, gói hội viên 30 ngày và ca mẫu.

## Biến môi trường

Backend dùng `server/.env`:

```dotenv
NODE_ENV=development
PORT=4001
CLIENT_URL=http://localhost:5173
DATABASE_URL=mysql://icecream_app:MAT_KHAU_CUA_ANH@localhost:3306/icecream_pos
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

Nếu dùng tài khoản `root` giống dự án ConnectHub, có thể dùng:

```dotenv
DATABASE_URL=mysql://root:MAT_KHAU_MYSQL@localhost:3306/icecream_pos
```

Nếu mật khẩu chứa ký tự như `@`, `#`, `/` hoặc `:`, cần URL-encode mật khẩu.

## Reset database mẫu

Dừng server trước, sao lưu dữ liệu cần thiết rồi chạy:

```powershell
cd D:\project\icecream\server
npx prisma migrate reset
```

Thao tác này xóa toàn bộ bảng trong database `icecream_pos`, chạy lại migration
và seed dữ liệu mẫu. Không dùng lệnh này với database đang chứa dữ liệu thật
mà chưa sao lưu.

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

## Ghi chú khi dùng MySQL thực tế

Sao lưu database `icecream_pos` định kỳ bằng MySQL Workbench, phpMyAdmin hoặc
`mysqldump`. Khi triển khai production, tạo tài khoản database riêng chỉ có
quyền trên `icecream_pos`, dùng mật khẩu mạnh và không commit file `.env`.
File SQLite cũ `server/prisma/dev.db` không còn được ứng dụng sử dụng và chỉ
được giữ cục bộ như một bản sao lưu dữ liệu trước khi chuyển đổi.
