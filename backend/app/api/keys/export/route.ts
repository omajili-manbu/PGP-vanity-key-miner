// 批量导出挖掘结果
//
// GET /api/keys/export?format=zip|json
//   - format=zip  打包所有密钥对（私钥 + 公钥 + 索引清单）
//   - format=json 导出结构化 JSON
//
// 可选参数：
//   - taskId   仅导出指定任务
//   - limit    最多导出多少条（默认全部）
//   - withPrivate=true/false  是否包含私钥（默认包含）
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getKeys, getPrivateKeys } from '../../../lib/db/queries';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const format = (params.get('format') || 'zip').toLowerCase();
    const taskId = params.get('taskId') || '';
    const withPrivate = params.get('withPrivate') !== 'false';
    const limitParam = params.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // 取全部密钥（分页拉取）
    const all: any[] = [];
    const pageSize = 500;
    let page = 1;
    let total = 0;
    for (;;) {
      const res = getKeys(page, pageSize);
      total = res.total;
      all.push(...res.keys);
      if (all.length >= total || res.keys.length === 0) break;
      page++;
    }

    let keys = all;
    if (taskId) keys = keys.filter(k => k.taskId === taskId);
    if (limit && limit > 0) keys = keys.slice(0, limit);

    // 私钥索引
    const privMap = new Map<string, any>();
    if (withPrivate) {
      for (const p of getPrivateKeys()) {
        privMap.set(p.keyId, p);
      }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json') {
      const payload = {
        exportedAt: new Date().toISOString(),
        total,
        exported: keys.length,
        withPrivate,
        keys: keys.map(k => {
          const base = {
            fingerprint: k.fingerprint,
            keyId: k.keyId,
            patternType: k.patternType,
            matchedText: k.matchedText,
            matchPosition: k.matchPosition,
            attemptsToFind: k.attemptsToFind,
            createdAt: k.createdAt,
            taskId: k.taskId,
            publicKeyArmored: k.publicKeyArmored,
          };
          if (!withPrivate) return base;
          const p = privMap.get(k.keyId);
          return { ...base, privateKeyArmored: p?.privateKeyArmored || null };
        }),
      };

      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="pgp-vanity-keys-${stamp}.json"`,
        },
      });
    }

    // ZIP 打包
    const zip = new JSZip();
    const privFolder = zip.folder('private')!;
    const pubFolder = zip.folder('public')!;

    const index: any[] = [];
    let withPrivCount = 0;

    for (const k of keys) {
      const fp = k.fingerprint;
      const kid = k.keyId || '';
      const p = privMap.get(kid);

      // 私钥文件（包含公钥+私钥，可直接导入密钥管理器）
      if (withPrivate && p?.privateKeyArmored) {
        privFolder.file(`pgp-private-${fp}.asc`, p.privateKeyArmored);
        withPrivCount++;
      }
      // 公钥文件
      if (k.publicKeyArmored) {
        pubFolder.file(`pgp-public-${fp}.asc`, k.publicKeyArmored);
      }

      index.push({
        fingerprint: fp,
        keyId: kid,
        patternType: k.patternType,
        matchedText: k.matchedText,
        attemptsToFind: k.attemptsToFind,
        createdAt: k.createdAt,
        taskId: k.taskId,
        privateKeyFile: withPrivate && p?.privateKeyArmored ? `private/pgp-private-${fp}.asc` : null,
        publicKeyFile: k.publicKeyArmored ? `public/pgp-public-${fp}.asc` : null,
      });
    }

    zip.file('index.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      total,
      exported: keys.length,
      withPrivateCount: withPrivCount,
      keys: index,
    }, null, 2));

    // 人类可读的清单
    const lines = [
      'PGP Vanity Key Miner - 导出清单',
      `导出时间: ${new Date().toISOString()}`,
      `密钥总数: ${keys.length}（含私钥 ${withPrivCount}）`,
      '',
      ...index.map(i =>
        `${i.fingerprint}  keyId=${i.keyId}  [${i.patternType}/${i.matchedText}]` +
        (i.privateKeyFile ? `  私钥:${i.privateKeyFile}` : '  私钥:无')
      ),
    ];
    zip.file('README.txt', lines.join('\n'));

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="pgp-vanity-keys-${stamp}.zip"`,
      },
    });
  } catch (error) {
    console.error('Export keys error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
