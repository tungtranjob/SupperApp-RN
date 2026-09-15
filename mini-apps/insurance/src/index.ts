/**
 * Entry point BẮT BUỘC PHẢI CÓ nhưng KHÔNG BAO GIỜ CHẠY.
 *
 * React Native CLI đòi một entry file cho lệnh `bundle`. Nhưng mini-app không
 * phải một ứng dụng độc lập — nó không tự đăng ký root component, không tự khởi
 * động. Thứ app vỏ thực sự tải về là CONTAINER do Module Federation sinh ra, và
 * container đó phơi `./App`.
 *
 * Để trống là đúng. Đặt `AppRegistry.registerComponent` ở đây sẽ tạo ra ảo giác
 * rằng mini-app chạy độc lập được, rồi ai đó sẽ thử, rồi nó hỏng theo cách khó
 * hiểu vì nửa số native module nó cần nằm ở app vỏ.
 */
export {};
