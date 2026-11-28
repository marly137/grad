# Thiệp mời tốt nghiệp của Đức Toàn

## Xem trước và cập nhật

Chạy `npm ci` một lần để cài Three.js và công cụ build. Sau đó chạy `npm run dev` trong thư mục dự án rồi mở `http://127.0.0.1:8712/moi/?to=MA_KHACH` với mã có trong `guests.json`. Lệnh dùng Node.js và Python. Nhấn `Ctrl+C` để dừng server.

Sửa `event.json` khi đổi nội dung, chạy lại `npm run build` rồi tải lại trang. `ceremonyAt` dùng dạng `YYYY-MM-DDTHH:mm:ss+07:00`, còn `guestFrom` và `guestUntil` dùng dạng `HH:mm`. Giữ `photoAt` là `""` để ẩn phần giờ hẹn chụp ảnh.

Khi đổi địa điểm, cập nhật `venue`, `address`, `mapsUrl` và `mapEmbedUrl` cùng nhau. Để `mapEmbedUrl` trống nếu chỉ dùng nút **Chỉ đường**. Phần đếm ngược và nút **Thêm vào lịch** dùng khung giờ gặp khách.

Để thêm nhạc nền, đặt bản beat bạn được phép chia sẻ vào cùng thư mục với `event.json`, đặt tên `nhac-nen.mp3` rồi chạy lại `npm run build`. Nhạc phát lặp khi khách bấm **Mở thiệp**. Nút tròn góc dưới bên phải dùng để tạm dừng và phát tiếp.

## Đưa thiệp lên Cloudflare Pages

1. Vào **Workers & Pages → Create application → Get started → Drag and drop your files**. Chọn tên dự án và lấy địa chỉ `https://<tên-dự-án>.pages.dev/` Cloudflare cấp.
2. Điền địa chỉ đó vào `siteUrl` trong `event.json`. Chạy `npm run build -- --publish` để dựng bản có tiêu đề và mô tả chung khi chia sẻ.
3. Tải thư mục `dist` lên và triển khai. Mở URL công khai để kiểm tra thiệp và nút chỉ đường. Sau khi cập nhật thông tin lễ, dựng lại và tải `dist` lên cùng dự án để các link đã gửi tiếp tục sử dụng được.

[Hướng dẫn Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Tạo link và lời nhắn cho nhiều khách

1. Thêm mã và tên khách vào `guests.json`. Khi dùng GitHub Pages, cập nhật GitHub Secret `GUESTS_JSON` cùng danh sách rồi triển khai lại.
2. Chạy `npm run build` và sao chép link của từng khách từ `outputs/grad-invitation/guest-links-local.txt`. Link mới dùng `/moi/?to=MA_KHACH` để ứng dụng chat lấy ảnh bìa chung. Link cũ dùng `#to=MA_KHACH` vẫn mở được.
3. Gửi đúng link cho từng khách. Ai có link đều có thể mở thiệp của khách đó. Ứng dụng chat và dịch vụ lưu trữ có thể thấy mã trong link mới. Tên khách hiển thị khi mở thiệp.
