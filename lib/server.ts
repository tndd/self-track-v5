import { getChatGPTUser } from '@/app/chatgpt-auth';
export const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function identity(req?: Request) {
    const user = await getChatGPTUser();
    const id = user?.userId ?? (import.meta.env.DEV ? 'local-preview-only' : null);
    return id && req?.headers.get('X-Shizuku-Dataset') === 'demo' ? `${id}:demo:v2` : id;
}
export function originAllowed(req: Request) { const origin = req.headers.get('origin'); return !origin || origin === new URL(req.url).origin; }
export async function readBody(req: Request, limit = 30000) { const text = await req.text(); if (text.length > limit)
    throw new Error('記録が長すぎます'); return JSON.parse(text); }
