# Tủ đồ của tôi

Web app tiếng Việt giúp bạn phối trang phục từ những món mình đang có.
Viết bằng HTML, CSS và JavaScript thuần — không cần cài thư viện, không gọi API,
ảnh chỉ nằm trong trình duyệt của bạn (IndexedDB).

## Các tệp

| Tệp | Nội dung |
|---|---|
| `index.html` | Khung trang: 3 mục Tủ đồ, Phối đồ, Bộ đã lưu |
| `styles.css` | Giao diện lookbook (nền kem, chữ đen, điểm nhấn đỏ rượu vang) |
| `app.js` | Toàn bộ xử lý: lưu dữ liệu, tải ảnh, thuật toán phối đồ |

## Cách chạy

Máy cần có **Python 3** (kiểm tra bằng lệnh `python3 --version`; trên Windows là `py --version`).
Nếu chưa có, tải tại https://www.python.org/downloads/ (Windows: nhớ tích “Add Python to PATH”).

1. Giải nén thư mục `tu-do-cua-toi` vào nơi bạn muốn giữ lâu dài.
2. Mở Terminal (macOS) hoặc PowerShell (Windows) **ngay trong thư mục đó**.
   - macOS: chuột phải vào thư mục trong Finder → *New Terminal at Folder*.
   - Windows: mở thư mục trong File Explorer, gõ `powershell` vào thanh địa chỉ rồi Enter.
3. Chạy lệnh:

   ```bash
   python3 -m http.server 8000
   ```

   (Trên Windows, nếu lệnh trên báo lỗi, dùng: `py -m http.server 8000`)

4. Mở Chrome và vào địa chỉ:

   **http://localhost:8000**

5. Dùng xong, quay lại cửa sổ Terminal và bấm `Ctrl + C` để tắt máy chủ.
   Lần sau chỉ cần lặp lại bước 2–4.

## Lưu ý để không mất dữ liệu

Chrome lưu dữ liệu theo **địa chỉ** và **hồ sơ Chrome**. Vì vậy hãy luôn:

- Mở đúng `http://localhost:8000` (cùng số cổng `8000`).
  `http://127.0.0.1:8000` hay `http://localhost:8001` được Chrome coi là nơi khác → sẽ thấy tủ đồ trống.
- Dùng cùng một hồ sơ Chrome, không dùng cửa sổ ẩn danh (ẩn danh xóa dữ liệu khi đóng).
- Không bấm “Xóa dữ liệu duyệt web → Cookie và dữ liệu trang web” cho localhost.

Tủ đồ **không** tự đồng bộ sang máy hay trình duyệt khác.

## Cách dùng nhanh

1. **Tủ đồ** → `+ Thêm ảnh` → chọn nhiều ảnh một lúc (mỗi ảnh một món).
   Điền tên, loại, màu chính, độ ấm, độ trang trọng cho từng món rồi bấm `Lưu món` hoặc `Lưu tất cả`.
   Món chưa lưu sẽ không được dùng để phối.
2. **Phối đồ** → chọn dịp, thời tiết, (tùy chọn) một món muốn mặc → `Gợi ý trang phục`.
   Nút “Phối quanh món này” trên từng thẻ món trong Tủ đồ cũng đưa bạn tới đây.
3. Bấm `Lưu bộ này`, đặt tên → xem lại trong **Bộ đã lưu** (mở, đổi tên, xóa).

## App phối đồ theo quy tắc nào?

- **Dịp mặc → độ trang trọng:** Đi làm: lịch sự/trang trọng · Sự kiện: lịch sự/trang trọng (ưu tiên trang trọng) ·
  Cuối tuần & Du lịch: thoải mái/lịch sự.
- **Thời tiết → độ ấm:** Nóng: mỏng/vừa, không thêm áo khoác · Mát: mọi mức, áo khoác tùy chọn ·
  Lạnh: vừa/ấm và ưu tiên thêm áo khoác (có áo khoác thì món bên trong được phép mỏng hơn).
- **Màu sắc:** nền trung tính (đen, trắng, kem, xám, nâu, navy, denim) + tối đa một màu nổi là đẹp nhất;
  hai màu nổi khác tông, nhiều món họa tiết hoặc quá nhiều màu sẽ bị loại.
- Mỗi bộ = váy liền **hoặc** áo + quần/chân váy; thêm giày, áo khoác, túi, phụ kiện khi hợp và có trong tủ.
- Khi chọn “Phối quanh món này”, món đó luôn có trong bộ; nếu nó không hợp dịp/thời tiết, app vẫn phối nhưng ghi chú rõ.
- Nếu không đủ món hoặc ít hơn 3 bộ hợp, app nói rõ thiếu gì và chỉ hiện những bộ tạo được.

## Gặp sự cố?

- **Ảnh iPhone (.HEIC) không thêm được:** Chrome không đọc HEIC. Trên iPhone vào
  *Cài đặt → Camera → Định dạng → Tương thích nhất*, hoặc đổi ảnh sang JPG.
- **Báo “Address already in use”:** cổng 8000 đang bị dùng. Tắt cửa sổ Terminal cũ đang chạy app rồi thử lại
  (đổi sang cổng khác sẽ làm Chrome coi là địa chỉ mới, không thấy dữ liệu cũ).
- **Trang trắng / không đổi sau khi sửa code:** bấm `Ctrl + Shift + R` (macOS: `Cmd + Shift + R`).
