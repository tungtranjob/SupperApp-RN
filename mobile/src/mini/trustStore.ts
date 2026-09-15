/**
 * TRUST STORE — khoá công khai của các đội được phép phát hành mini-app.
 *
 * FILE NÀY ĐƯỢC SINH TỰ ĐỘNG bởi `npm run keys:sync`. Đừng sửa tay.
 * Nguồn: keys/*.pem.pub
 *
 * Đây là gốc tin cậy của toàn bộ hướng B. Registry chỉ nói mini-app được ký bằng
 * `keyId` nào; khoá thật thì lấy ở đây — bên trong bản app đã phát hành. Nếu
 * khoá đến từ registry thì kẻ chiếm được registry sẽ đổi cả bundle lẫn khoá và
 * chữ ký luôn hợp lệ. Xem tools/keys-sync.mjs để biết đầy đủ lý do.
 *
 * Thêm một đội mới ở đây = phải phát hành bản app mới. Đó là chủ ý.
 */

export const TRUST_STORE: Record<string, string> = {
  'team-insurance': `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnt7QiChMPnTf8R/Me+pC
rviSDPrc5sJI3QuYoYYs8rFM9zwYHha5fQxgpFfGclGD2iXP4xNOgU0Uqaj4pAcW
RuxgC0hmZcQehNci1oHKn2j1Q14ao0SlDPNX72FNO5QndPYMKvG/h72RtL6LQ5Ce
coVsPebEu4D/w+RAWHqQrH5QRX9BKoEs7134gGnDf/sUvf7+lneHAnrDBLfS5QGD
GkNpT2Ouvxvf69HflHvcTy+x5RUEGkRtby+Y8ALY2EsA70JiWdZL0K3B7kNlSqXI
sHS8W3l1wS6VWjBKGnZuBX3DREBYV+Vk3PlPJY2ZGVraCJwk78CpDTAjLNDDQCWX
DwIDAQAB
-----END PUBLIC KEY-----`,

  'team-invest': `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApuJh4vg4s/575YWBItqZ
sB16h37+2dJpWIUrqzkRkNnJ0o4gz+w2s4SAKeyGvDyl9NvfIH4N0JJjO8U1Tjln
9v0lU5EHujofvmLlo9ffEjeto29SO7ylghoZb0coM2AsKulOoLbwLeRB3ux9gnZ2
F5Z6TrlcBpeEqmdpXThptoRUQFZRzmN4XUGXKocq2Ndr89sXkfR4RdI0l1I0htTs
AkKUzUAg1fFgcA71Vqh37SqP5VR6pJNpx2wppw2rwqv6i+0XLDopPItLvxPFiX4a
PnpvzKlhXg4RtiTC6fuCP5fs4vWoRATkfjYCLJTdIEp89bwW/8SNJOmlccQ9iGC7
0QIDAQAB
-----END PUBLIC KEY-----`,
};

/** Lấy khoá công cho một keyId, hoặc null nếu app này không tin đội đó. */
export function publicKeyFor(keyId: string): string | null {
  return TRUST_STORE[keyId] ?? null;
}
