// 挖掘 Worker 线程（真实 OS 线程，非协程）
//
// 性能：搜索阶段用 Node 原生 crypto（~6000 keys/s/线程），
//       命中后用 openpgp 把同一套材料补齐成完整 OpenPGP 密钥。
import { parentPort, workerData, threadId } from 'node:worker_threads';
import * as openpgp from 'openpgp';
import { generateFastKeyMaterial, matchRules } from '../lib/pgp/fast-keygen.mjs';

const { patterns, logicOperator, groups } = workerData;

let attempts = 0;
let matchCount = 0;
let lastUpdate = Date.now();
let lastAttempts = 0;
let lastMatches = 0;
let running = true;

console.log(`[MiningWorker] 启动: threadId=${threadId}, patterns=${patterns.length}, groups=${(groups || []).length}`);

parentPort.on('message', (msg) => {
  if (msg && msg.type === 'stop') running = false;
});

/**
 * 用 openpgp 把原生材料补齐成完整密钥（UID + 自签名 + Armor）
 * keyID 与搜索阶段完全一致（因为用的是同一份材料）
 *
 * 注意：reformatKey 走 openpgp 的曲线运算（较慢，约 20-40ms/把）。
 * 命中很密集时不能同步等待，否则会拖慢搜索。
 */
async function completeKey(secretKeyBinary) {
  const priv = await openpgp.readPrivateKey({ binaryKey: secretKeyBinary });
  const fmt = await openpgp.reformatKey({
    privateKey: priv,
    userIDs: [{ name: 'PGP Vanity Miner', email: 'miner@localhost' }],
    passphrase: '',
    format: 'armored',
  });
  // 补一把加密子钥（ECDH），否则这把钥匙只能签名、不能加密。
  // addSubkey 会在子钥后追加绑定签名，主钥公钥包不变 => 长 Key ID 不变。
  let key = await openpgp.readPrivateKey({ armoredKey: fmt.privateKey });
  key = await key.addSubkey({});
  const publicKey = key.toPublic().armor();
  const privateKey = key.armor();
  const pub = await openpgp.readKey({ armoredKey: publicKey });
  return {
    publicKey,
    privateKey,
    fingerprint: pub.getFingerprint(),
    keyId: pub.getKeyID().toHex(),
  };
}

// 命中队列：搜索线程把命中材料放进来，补齐线程按序处理
const hitQueue = [];
let draining = false;

// 命中广播限流：命中可能高达每秒数千条，全部发给主线程会淹没它。
// 只把少量样本推给 SSE，其余仅计数（前端可通过 /api/keys 拉取完整列表）。
let matchBroadcastCount = 0;
// 每 N 个命中推 1 个给 SSE。命中可能每秒上千条，
// 全推会淹没浏览器（面板卡死），其余仅计数（前端可通过 /api/keys 拉取完整列表）。
const MATCH_BROADCAST_INTERVAL = 25;

async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    while (hitQueue.length > 0) {
      const item = hitQueue.shift();
      try {
        const full = await completeKey(item.secretKeyBinary);
        matchBroadcastCount++;
        const broadcast = matchBroadcastCount % MATCH_BROADCAST_INTERVAL === 0;

        parentPort.postMessage({
          type: 'match',
          broadcast,
          // 完整公钥/私钥只在被抽中的样本里附带（1/25），
          // 否则每秒数百条 × 1.5KB 会淹没主线程和浏览器。
          // 主线程据此落盘，SSR 推送时只发元数据。
          publicKey: full.publicKey,
          privateKey: full.privateKey,
          fingerprint: full.fingerprint,
          keyId: full.keyId,
          patternId: item.patternId,
          patternType: item.patternType,
          color: item.color,
          matchPosition: item.position,
          matchedText: item.matchedText,
          attempts: item.attempts,
        });
      } catch (error) {
        parentPort.postMessage({ type: 'error', message: String(error && error.message || error) });
      }
    }
  } finally {
    draining = false;
  }
}

async function mine() {
  while (running) {
    try {
      // ---------- 阶段 1：快速搜索（原生 crypto，规则只匹配 16 位长 Key ID）----------
      const material = generateFastKeyMaterial();
      attempts++;

      const result = matchRules(material.keyId, patterns, groups || [], logicOperator || 'OR');

      if (result.matched && result.hits.length > 0) {
        matchCount++;
        const best = result.hits.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];

        // ---------- 阶段 2：入队，由补齐线程异步生成完整密钥 ----------
        hitQueue.push({
          secretKeyBinary: material.secretKeyBinary,
          patternId: best.ruleId,
          patternType: best.patternType,
          color: best.color,
          position: best.position,
          matchedText: best.matchedText,
          attempts,
        });
        // 队列太长时丢弃最旧的（避免无限增长）
        if (hitQueue.length > 200) hitQueue.shift();
        drainQueue();
      }
      // 搜索循环是同步密集的，必须定期让出事件循环，
      // 否则 drainQueue 里的 await completeKey() 永远得不到执行机会
      if ((attempts & 0x3ff) === 0) {
        await new Promise(r => setImmediate(r));
      }

      const now = Date.now();
      if (now - lastUpdate >= 1000) {
        const rate = (attempts - lastAttempts) / ((now - lastUpdate) / 1000);
        console.log(`[MiningWorker] threadId=${threadId} attempts=${attempts} matches=${matchCount} rate=${rate.toFixed(1)}/s`);
        parentPort.postMessage({
          type: 'progress',
          attempts: attempts - lastAttempts,
          hashrate: rate,
          totalAttempts: attempts,
          // 本周期新增的命中数（主线程累加得到总数，避免每条命中都发消息）
          matchesDelta: matchCount - lastMatches,
        });
        lastUpdate = now;
        lastAttempts = attempts;
        lastMatches = matchCount;
      }
    } catch (error) {
      parentPort.postMessage({ type: 'error', message: String(error && error.message || error) });
      await new Promise(r => setTimeout(r, 500));
    }
  }
  parentPort.postMessage({ type: 'stopped' });
}

mine();
