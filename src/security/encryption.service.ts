// src/security/encryption.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import { ConfigService } from '@nestjs/config';

export type KeyMetadata = Readonly<{
  kmsKeyId?: string;
  keySpec?: string;
  rotatedAt?: string;
  ver?: number;
}>;

export type AeadCiphertext = Readonly<{
  enc: Buffer; // ciphertext
  iv: Buffer; // initialization vector
  tag: Buffer; // auth tag
  edk: Buffer; // encrypted data key
  alg: 'AES-256-GCM';
  kmd: KeyMetadata;
}>;

export interface AeadCiphertextDTO {
  enc: string;
  iv: string;
  tag: string;
  edk: string;
  alg: 'AES-256-GCM';
  kmd: KeyMetadata;
}

export function serializeAead(cipher: AeadCiphertext): AeadCiphertextDTO {
  return {
    enc: cipher.enc.toString('base64'),
    iv: cipher.iv.toString('base64'),
    tag: cipher.tag.toString('base64'),
    edk: cipher.edk.toString('base64'),
    alg: cipher.alg,
    kmd: cipher.kmd,
  };
}

export function deserializeAead(dto: AeadCiphertextDTO): AeadCiphertext {
  if (
    !dto ||
    typeof dto.enc !== 'string' ||
    typeof dto.iv !== 'string' ||
    typeof dto.tag !== 'string' ||
    typeof dto.edk !== 'string' ||
    dto.alg !== 'AES-256-GCM'
  ) {
    throw new Error('Invalid AeadCiphertextDTO');
  }

  return {
    enc: Buffer.from(dto.enc, 'base64'),
    iv: Buffer.from(dto.iv, 'base64'),
    tag: Buffer.from(dto.tag, 'base64'),
    edk: Buffer.from(dto.edk, 'base64'),
    alg: dto.alg,
    kmd: dto.kmd,
  };
}

@Injectable()
export class EncryptionService {
  private kms?: KMSClient;
  private kmsKeyId?: string;
  private localKek?: Buffer; // for dev
  private defaultEncCtx = Object.freeze({ service: 'bridgepay-refund' });
  private static readonly EDK_FMT_V1 = 0x01;
  private bixSecret: Buffer;

  constructor(configService: ConfigService) {
    const mode = configService.get<string>('security.secMode');
    if (mode === 'prod') {
      this.kmsKeyId = configService.get<string>('security.kmsKeyId');
      const region = configService.get<string>('security.kmsRegion');
      this.kms = new KMSClient({ region });
    } else {
      const kekB64 = configService.get<string>('security.localKek64');
      this.localKek = Buffer.from(kekB64, 'base64');
      if (this.localKek.length !== 32)
        throw new Error('LOCAL_KEK_B64 must decode to 32 bytes');
    }

    this.bixSecret = Buffer.from(
      configService.getOrThrow<string>('security.bixSecret'),
      'base64',
    );
    if (this.bixSecret.length !== 32) {
      throw new Error('security.bixSecret must decode to 32 bytes (base64)');
    }
  }

  // --- Internal KMS helper with retry, backoff, and timeout ---
  private static async kmsCallWithRetry<T>(
    opName: string,
    invoke: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const timeoutMs = 2500;
    const maxRetries = 5;
    const baseDelay = 100; // ms
    const maxDelay = 2000;
    const retryableErrors = new Set([
      'ThrottlingException',
      'TooManyRequestsException',
      'InternalException',
      'InternalError',
      'ServiceUnavailableException',
      'RequestTimeout',
      'TimeoutError',
      'NetworkingError',
      'ECONNRESET',
    ]);

    let attempt = 0;

    while (true) {
      attempt++;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);

      try {
        const res = await invoke(ac.signal);
        clearTimeout(timer);
        return res;
      } catch (err: any) {
        clearTimeout(timer);

        const code = err?.name || err?.Code || err?.code || 'UnknownError';

        const isRetryable =
          retryableErrors.has(code) || err?.name === 'AbortError';

        if (!isRetryable || attempt >= maxRetries) {
          throw new Error(
            `[KMS:${opName}] failed after ${attempt} attempts (${code})`,
          );
        }

        // exponential backoff with full jitter
        const delay = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1));
        const sleep = Math.floor(Math.random() * delay);
        await new Promise((r) => setTimeout(r, sleep));
      }
    }
  }

  private async generateDek(encCtx: Record<string, string>): Promise<{
    dekPlain: Buffer;
    edk: Buffer;
    kmd: any;
  }> {
    if (this.kms) {
      const out = await EncryptionService.kmsCallWithRetry(
        'GenerateDataKey',
        (signal) =>
          this.kms!.send(
            new GenerateDataKeyCommand({
              KeyId: this.kmsKeyId!,
              KeySpec: 'AES_256',
              EncryptionContext: encCtx,
            }),
            { abortSignal: signal } as any,
          ),
      );

      return {
        dekPlain: Buffer.from(out.Plaintext as Uint8Array),
        edk: Buffer.from(out.CiphertextBlob as Uint8Array),
        kmd: { kmsKeyId: out.KeyId, keySpec: 'AES_256' },
      };
    }

    // --- Dev mode ---
    const dekPlain = crypto.randomBytes(32);
    const edk = this.wrapWithLocalKek(dekPlain);
    return { dekPlain, edk, kmd: { kmsKeyId: 'local-dev-kek' } };
  }

  private wrapWithLocalKek(dek: Buffer): Buffer {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.localKek!, iv);
    const enc = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    // [1 byte ver][12 iv][16 tag][N enc]
    return Buffer.concat([
      Buffer.from([EncryptionService.EDK_FMT_V1]),
      iv,
      tag,
      enc,
    ]);
  }

  private unwrapWithLocalKek(edk: Buffer): Buffer {
    const ver = edk[0];
    if (ver !== EncryptionService.EDK_FMT_V1)
      throw new Error(`Unsupported EDK version: ${ver}`);
    const iv = edk.subarray(1, 13);
    const tag = edk.subarray(13, 29);
    const enc = edk.subarray(29);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.localKek!, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  private async decryptDek(
    edk: Buffer,
    kmd?: any,
    encCtx?: Record<string, string>,
  ): Promise<Buffer> {
    if (this.kms) {
      const out = await EncryptionService.kmsCallWithRetry(
        'Decrypt',
        (signal) =>
          this.kms!.send(
            new DecryptCommand({
              CiphertextBlob: edk,
              EncryptionContext: encCtx,
            }),
            { abortSignal: signal } as any,
          ),
      );
      return Buffer.from(out.Plaintext as Uint8Array);
    }
    return this.unwrapWithLocalKek(edk);
  }

  async encryptAead(
    plain: Buffer,
    aad: Buffer,
    encCtxExtra?: Record<string, string>,
  ): Promise<AeadCiphertext> {
    const encCtx = this.buildEncCtx(encCtxExtra);
    const { dekPlain, edk, kmd } = await this.generateDek(encCtx);

    // 🔒 Combine the caller-provided AAD and kmd to bind metadata integrity
    // Serialize deterministically (no random fields like timestamps in kmd)
    const aadSafe = aad && aad.length > 0 ? aad : Buffer.alloc(0);
    const combinedAad = Buffer.concat([
      aadSafe,
      Buffer.from('|', 'utf8'),
      Buffer.from(JSON.stringify(kmd), 'utf8'),
    ]);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dekPlain, iv);
    cipher.setAAD(combinedAad);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();

    dekPlain.fill(0); // zeroize DEK in memory

    return {
      enc,
      iv,
      tag,
      edk,
      alg: 'AES-256-GCM',
      kmd,
    };
  }

  async decryptAead(
    data: AeadCiphertext,
    aad: Buffer,
    encCtxExtra?: Record<string, string>,
  ): Promise<Buffer> {
    const encCtx = this.buildEncCtx(encCtxExtra);
    const dek = await this.decryptDek(data.edk, data.kmd, encCtx);

    // Rebuild the exact same AAD
    const aadSafe = aad && aad.length > 0 ? aad : Buffer.alloc(0);
    const combinedAad = Buffer.concat([
      aadSafe,
      Buffer.from('|', 'utf8'),
      Buffer.from(JSON.stringify(data.kmd), 'utf8'),
    ]);

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, data.iv);
    decipher.setAAD(combinedAad);
    decipher.setAuthTag(data.tag);
    const plain = Buffer.concat([decipher.update(data.enc), decipher.final()]);
    dek.fill(0);
    return plain;
  }

  async rewrapEdk(
    oldEdk: Buffer,
    encCtx: Record<string, string>,
  ): Promise<{ edk: Buffer; kmd: any }> {
    if (!this.kms) return { edk: oldEdk, kmd: { kmsKeyId: 'local-dev-kek' } };
    // Decrypt with old key (ctx), then re-encrypt with new key
    await this.kms.send(
      new DecryptCommand({ CiphertextBlob: oldEdk, EncryptionContext: encCtx }),
    );
    const gen = await this.kms.send(
      new GenerateDataKeyCommand({
        KeyId: this.kmsKeyId!,
        KeySpec: 'AES_256',
        // NOTE: This generates a new DEK. For true "re-wrap" of an existing DEK,
        // prefer the KMS ReEncrypt API if available in your region.
        // Decrypt-then-Encrypt should be avoided unless absolutely necessary.
      }),
    );
    // Prefer KMS ReEncrypt API if available in your SDK/region to avoid plaintext DEK in app memory.
    return {
      edk: Buffer.from(gen.CiphertextBlob as Uint8Array),
      kmd: { kmsKeyId: gen.KeyId, keySpec: 'AES_256' },
    };
  }

  blindIndex(value: string, context: string): Buffer {
    const mac = crypto.createHmac('sha256', this.bixSecret);
    mac.update('v1'); // pepper/version tag
    mac.update('\x00');
    mac.update(context); // e.g., 'payment_gateways.credential'
    mac.update('\x00');
    mac.update(value.normalize('NFKC'));
    return mac.digest();
  }

  private buildEncCtx(extra?: Record<string, string>) {
    return { ...this.defaultEncCtx, ...(extra || {}) };
  }
}
