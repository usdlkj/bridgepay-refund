export function maskAccountNumber(accountNumber: string) {
  if (!accountNumber) {
    return accountNumber;
  }
  const visibleDigits = 4;
  if (accountNumber.length <= visibleDigits) {
    return '*'.repeat(accountNumber.length);
  }
  const maskedLength = accountNumber.length - visibleDigits;
  const maskedPart = '*'.repeat(maskedLength);
  return maskedPart + accountNumber.slice(-visibleDigits);
}
