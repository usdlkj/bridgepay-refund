# Rencana Refaktor Lengkap: Mengganti `process.env` dengan `ConfigService`

Rencana ini merinci langkah-langkah untuk mengganti penggunaan `process.env` di `Helper` dan `RefundService` agar menggunakan NestJS `ConfigService`.

## 1. Perbarui File Konfigurasi
Modifikasi `src/config/refund.config.ts` untuk menyertakan pengaturan biaya dan pajak dengan konversi tipe data yang benar.

### Perubahan pada `src/config/refund.config.ts`:
```typescript
export default () => ({
  refund: {
    // ... existing configs
    disbursementFeeFix: parseInt(process.env.DISBURSEMENT_FEE_FIX || '0'),
    ppnValue: parseInt(process.env.PPN_VALUE || '0'),
  },
});
```

## 2. Perbarui `Helper` Class
Modifikasi metode `totalAmountDisbursement` di `src/utils/helper.ts`.

### Target Implementasi di `src/utils/helper.ts`:
```typescript
async totalAmountDisbursement(amount: any) {
  const feeFix = this.configService.get<number>('refund.disbursementFeeFix') || 0;
  const ppnValue = this.configService.get<number>('refund.ppnValue') || 0;

  const amountAndFee = parseInt(amount) + feeFix;
  const ppn = (feeFix * ppnValue) / 100;
  const totalAmount = amountAndFee + Math.ceil(ppn);

  return {
    amount: parseInt(amount),
    fee: feeFix,
    AmountAfterFee: amountAndFee,
    tax: Math.ceil(ppn),
    totalAmount: totalAmount,
  };
}
```

## 3. Perbarui `RefundService` Class
Modifikasi metode `status` di `src/refund/refund.service.ts` agar konsisten.

### Perubahan pada `src/refund/refund.service.ts` (sekitar baris 430):
```typescript
// Ganti:
// invoice['fee'] = process.env.DISBURSEMENT_FEE_FIX;
// Menjadi:
invoice['fee'] = this.configService.get<number>('refund.disbursementFeeFix');

// Ganti:
// invoice['rate'] = process.env.DISBURSEMENT_FEE_FIX;
// Menjadi:
invoice['rate'] = this.configService.get<number>('refund.disbursementFeeFix');
```

## 4. Keuntungan
- **Konsistensi**: Semua akses env variable melalui satu pintu (`ConfigService`).
- **Tipe Data**: Penggunaan tipe data `number` yang konsisten mengurangi risiko kesalahan kalkulasi.
- **Maintenance**: Memudahkan perubahan nama variabel di masa depan karena hanya perlu diubah di satu tempat (`refund.config.ts`).

---
**Status**: Selesai (Sudah Diimplementasi)
**Penulis**: Antigravity
