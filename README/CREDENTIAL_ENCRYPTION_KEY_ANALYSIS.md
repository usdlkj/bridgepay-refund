# CREDENTIAL_ENCRYPTION_KEY Usage Analysis

## Summary

**Key Finding:** `CREDENTIAL_ENCRYPTION_KEY` appears to be **LEGACY/UNUSED** code. The application uses `bridgepay-encryptor` microservice (AWS KMS) for all encryption operations instead.

## Location of CREDENTIAL_ENCRYPTION_KEY Definition

**File:** `src/config/app.config.ts:30-31`

```typescript
credentialEncryptionKey:
  process.env.CREDENTIAL_ENCRYPTION_KEY || 'bridgepay2020',
```

- Default value: `'bridgepay2020'` (weak default)
- Configuration path: `credentialEncryptionKey` (accessed via ConfigService)

## Where It's Used

### 1. CryptoService (Legacy/Unused Code)

**File:** `src/utils/crypto.service.ts`

The `CryptoService` class uses `credentialEncryptionKey`:

```typescript
constructor(private readonly configService: ConfigService) {
  const keyString = this.configService.get<string>('credentialEncryptionKey');
  if (!keyString)
    throw new Error('Missing CREDENTIAL_ENCRYPTION_KEY in environment');

  this.key = Buffer.from(keyString, 'hex');  // ⚠️ Expects HEX format
}

encrypt(text: string): string {
  // AES-256-CBC encryption implementation
  // Returns format: `${iv}:${encrypted}` (both hex-encoded)
}

decrypt(data: string): string {
  // AES-256-CBC decryption implementation
}
```

**Important Notes:**
1. ✅ **Fail-fast behavior:** CryptoService throws error if key is missing
2. ⚠️ **Format mismatch:** Service expects HEX format (`Buffer.from(keyString, 'hex')`), but default value `'bridgepay2020'` is NOT hex
3. ❌ **Not used:** CryptoService is exported from `util.module.ts` but **NO modules or services import/use it**

### 2. CryptoService Module Export

**File:** `src/utils/util.module.ts`

```typescript
providers: [CryptoService, EncryptorClient],
exports: [CryptoService, EncryptorClient],
```

- CryptoService is exported, but no imports found in codebase
- EncryptorClient is the actual service being used

## Actual Encryption Implementation (Current)

### EncryptorClient (Active)

**File:** `src/utils/encryptor.client.ts`

The application uses `EncryptorClient` which communicates with `bridgepay-encryptor` microservice via RabbitMQ:

```typescript
@Injectable()
export class EncryptorClient implements OnModuleInit, OnModuleDestroy {
  private client: ClientProxy;

  constructor(private configService: ConfigService) {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [this.configService.getOrThrow<string>('RABBITMQ_URL')],
        queue: this.configService.get<string>('RABBITMQ_ENCRYPTOR_QUEUE') || 'bridgepay-encryptor',
        queueOptions: { durable: true },
      },
    });
  }

  async send<TInput = any, TOutput = any>(
    pattern: string,
    payload: TInput,
    timeoutMs = 5000,
  ): Promise<TOutput> {
    // Sends encryption/decryption requests to bridgepay-encryptor service
    // bridgepay-encryptor uses AWS KMS in production
  }
}
```

**Encryption Operations Using EncryptorClient:**

1. **Bank Account Number Encryption** (Primary Use Case)
   - **File:** `src/refund/refund.service.ts:567-584`
   - **File:** `src/iluma/iluma.service.ts:205-211`
   - **Purpose:** Encrypt bank account numbers before storing in database
   - **Entity:** `BankData.accountNumberEnc` (JSONB field)
   - **Pattern:** `encryptorClient.send('encrypt', { value, aad, context })`
   - **Pattern:** `encryptorClient.send('blind-index', { value, context })` (for searchable hashes)

2. **Database Schema**
   - **Table:** `payment_gateways` (migration shows `credential_encrypted` field exists but not actively used)
   - **Table:** `bank_datas` (actively uses encryption via EncryptorClient)

## Security Analysis

### CryptoService Issues (If Used)

1. **Weak Default Key:** `'bridgepay2020'` is easily guessable
2. **Format Mismatch:** Default value is not HEX, so would fail at runtime
3. **Legacy Algorithm:** Uses AES-256-CBC (not authenticated encryption)
4. **No Key Rotation:** No mechanism for key rotation

### Current Implementation (EncryptorClient) - ✅ Secure

1. **AWS KMS Integration:** Uses AWS Key Management Service in production
2. **Authenticated Encryption:** bridgepay-encryptor uses AES-256-GCM
3. **Key Rotation:** AWS KMS supports key rotation
4. **No Key in Code:** Encryption keys never exposed to application code
5. **Production Ready:** Properly managed via bridgepay-encryptor microservice

## Status: ✅ REMOVED

**Action Taken:** Legacy code has been removed:

- ✅ Removed `src/utils/crypto.service.ts`
- ✅ Removed `CryptoService` from `src/utils/util.module.ts`
- ✅ Removed `credentialEncryptionKey` from `src/config/app.config.ts`

**Benefits Achieved:**
- ✅ Eliminates confusion about which encryption method is used
- ✅ Removes weak default secret from codebase
- ✅ Reduces maintenance burden
- ✅ Clarifies that encryption is handled by bridgepay-encryptor

**Risk Assessment:**
- ✅ **No Risk:** CryptoService was not imported/used anywhere
- ✅ **Verified:** Codebase confirmed no references before removal

---

## Historical Recommendations (No Longer Applicable)

### ~~1. Remove CryptoService (Legacy Code Cleanup)~~ ✅ COMPLETED

**Status:** Legacy code has been successfully removed.

### ~~2. If Keeping CryptoService (For Future Use)~~

If there's a plan to use CryptoService in the future:

1. **Remove Default Value:** Enforce fail-fast behavior
2. **Update Documentation:** Document that it's legacy/unused
3. **Fix Format Issue:** Default value must be valid HEX (64 chars for AES-256 key)
4. **Consider Deprecation:** Mark as deprecated if not actively used

### 3. Current Production Status

**Production:** ✅ **Secure**
- Uses bridgepay-encryptor (AWS KMS)
- No dependency on `CREDENTIAL_ENCRYPTION_KEY` environment variable
- Encryption keys properly managed

**Code Quality:** ⚠️ **Should Clean Up**
- Legacy CryptoService code exists but unused
- Weak default value present (though not used)
- Potential confusion about encryption method

## Conclusion

✅ **RESOLVED:** `CREDENTIAL_ENCRYPTION_KEY` and `CryptoService` were legacy code that were not actively used. They have been successfully removed from the codebase. The application correctly uses `bridgepay-encryptor` microservice (AWS KMS) for all encryption operations.

**Removal Date:** Completed as part of security analysis cleanup  
**Impact:** No functional impact - code was unused  
**Security Improvement:** Removed weak default secret (`'bridgepay2020'`) from codebase
