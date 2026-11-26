# Thiệp mời tốt nghiệp của Đức Toàn

## Xem trước và cập nhật

Chạy `npm ci` một lần để cài Three.js và công cụ build. Sau đó chạy `npm run dev` trong thư mục dự án rồi mở `http://127.0.0.1:8712/`. Lệnh dùng Node.js và Python. Nhấn `Ctrl+C` để dừng server. Để thử tên người nhận, mở trang với `#to=Minh%20Anh` ở cuối địa chỉ. Mở địa chỉ gốc để xem lời chào chung.

Sửa `event.json` khi đổi nội dung, chạy lại `npm run build` rồi tải lại trang. `ceremonyAt` dùng dạng `YYYY-MM-DDTHH:mm:ss+07:00`, còn `guestFrom` và `guestUntil` dùng dạng `HH:mm`. Giữ `photoAt` là `""` để ẩn phần giờ hẹn chụp ảnh.

Khi đổi địa điểm, cập nhật `venue`, `address`, `mapsUrl` và `mapEmbedUrl` cùng nhau. Để `mapEmbedUrl` trống nếu chỉ dùng nút **Chỉ đường**. Phần đếm ngược và nút **Thêm vào lịch** dùng khung giờ gặp khách.

Để thêm nhạc nền, đặt bản beat bạn được phép chia sẻ vào cùng thư mục với `event.json`, đặt tên `nhac-nen.mp3` rồi chạy lại `npm run build`. Nhạc phát lặp khi khách bấm **Mở thiệp**. Nút tròn góc dưới bên phải dùng để tạm dừng và phát tiếp.

## Đưa thiệp lên Cloudflare Pages

1. Vào **Workers & Pages → Create application → Get started → Drag and drop your files**. Chọn tên dự án và lấy địa chỉ `https://<tên-dự-án>.pages.dev/` Cloudflare cấp.
2. Điền địa chỉ đó vào `siteUrl` trong `event.json`. Chạy `npm run build -- --publish` để dựng bản có tiêu đề và mô tả chung khi chia sẻ.
3. Tải thư mục `dist` lên và triển khai. Mở URL công khai để kiểm tra thiệp và nút chỉ đường. Sau khi cập nhật thông tin lễ, dựng lại và tải `dist` lên cùng dự án để các link đã gửi tiếp tục sử dụng được.

[Hướng dẫn Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Tạo link và lời nhắn cho nhiều khách

1. Mở [Google Sheet khách mời riêng tư](https://docs.google.com/spreadsheets/d/1iihYx4RbvWqVOpboYR0hD4yvGG6I-SjdxzIjCv8kxco/edit) rồi điền URL công khai của thiệp tại ô `B2`.
2. Dán tên hoặc cách xưng hô từ `A5` trở xuống. Cột B tạo link, cột C tạo lời nhắn để sao chép. Đánh dấu cột D khi đã gửi.
3. Gửi URL gốc nếu muốn mời cả nhóm. Ai có link cá nhân hóa đều có thể đọc tên xuất hiện trên thiệp, kể cả khi link được chuyển tiếp.
