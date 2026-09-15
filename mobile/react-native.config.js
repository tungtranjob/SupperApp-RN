/**
 * Trỏ React Native CLI sang Re.Pack thay vì Metro.
 *
 * Từ file này trở đi, `react-native start` và `react-native bundle` chạy bằng
 * Rspack + Re.Pack. Đó là điều kiện để có Module Federation — Metro không hỗ trợ.
 */
module.exports = {
  commands: require('@callstack/repack/commands'),
};
