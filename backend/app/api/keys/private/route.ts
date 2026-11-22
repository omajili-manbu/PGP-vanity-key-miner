// 下载私钥
//
// GET /api/keys/private?keyId=<16位长KeyID>
//
// 本机运行场景：私钥持久化保存在 data/private-keys.jsonl，可重复下载。
import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKey } from '../../../lib/db/queries';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    const keyId = (request.nextUrl.searchParams.get('keyId') || '').trim().toLowerCase();

    if (!/^[0-9a-f]{16}$/.test(keyId)) {
      return NextResponse.json(
        { success: false, error: '无效的 keyId（应为 16 位十六进制）' },
        { status: 400, headers: corsHeaders }
      );
    }

    const entry = getPrivateKey(keyId);

    if (!entry) {
      return NextResponse.json(
        { success: false, error: '未找到该私钥，可能来自更早的挖掘批次或已被清理' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        keyId: entry.keyId,
        fingerprint: entry.fingerprint,
        privateKeyArmored: entry.privateKeyArmored,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Get private key error:', error);
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
