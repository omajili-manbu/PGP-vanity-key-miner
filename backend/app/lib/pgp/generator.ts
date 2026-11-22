// PGP 密钥生成核心逻辑
import * as openpgp from 'openpgp';
import type { KeyPair } from './types';

/**
 * 从 40 位指纹中取出长 Key ID（后 16 位 hex）
 * OpenPGP 规定：长 Key ID = 指纹的低 64 位
 */
export function extractKeyId(fingerprint: string): string {
  const fp = fingerprint.toLowerCase().replace(/\s+/g, '');
  return fp.slice(-16);
}

/**
 * 生成 PGP 密钥对（使用 ECC 曲线，比 RSA 快 10-50 倍）
 * @returns 包含公钥、私钥、指纹和长 Key ID 的密钥对
 */
export async function generateKeyPair(): Promise<KeyPair> {
  try {
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'ecc',
      // openpgp 6 的 EllipticCurveName 类型未收录 'curve25519'，
      // 但运行时支持（见 openpgp.d.ts 的 GenerateKeyOptions）
      curve: 'curve25519' as openpgp.EllipticCurveName,
      userIDs: [{ name: 'PGP Vanity Miner', email: 'miner@localhost' }],
      passphrase: '', // 无密码，便于自动化
      format: 'armored',
    });

    // 读取公钥以获取指纹
    const key = await openpgp.readKey({ armoredKey: publicKey });
    const fingerprint = key.getFingerprint();

    return {
      publicKey,
      privateKey,
      fingerprint,
      keyId: extractKeyId(fingerprint),
    };
  } catch (error) {
    console.error('Key generation error:', error);
    throw new Error('Failed to generate PGP key pair');
  }
}

/**
 * 批量生成密钥对（用于性能测试）
 * @param count 要生成的密钥对数量
 */
export async function batchGenerateKeys(count: number): Promise<KeyPair[]> {
  const keys: KeyPair[] = [];
  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    try {
      const keyPair = await generateKeyPair();
      keys.push(keyPair);
    } catch (error) {
      console.error(`Error generating key ${i + 1}:`, error);
    }
  }

  const endTime = Date.now();
  console.log(`Generated ${keys.length}/${count} keys in ${(endTime - startTime) / 1000}s`);
  console.log(`Average time per key: ${(endTime - startTime) / keys.length}ms`);

  return keys;
}
