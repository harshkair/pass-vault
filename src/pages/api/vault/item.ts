import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../lib/mongo';
import { Binary } from 'mongodb';

async function auth(req: NextApiRequest) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  const db = await getDb();
  const users = db.collection('users');
  const user = await users.findOne({ 'sessions.token': token });
  return user as any | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await auth(req);
  if (!user) return res.status(401).json({ error: 'unauth' });

  const db = await getDb();
  const users = db.collection('users');

  if (req.method === 'POST') {
    // add an encrypted item: { id, blobB64, ivB64, meta? }
    const { id, blobB64, ivB64, meta } = req.body as { id: string; blobB64: string; ivB64?: string; meta?: any };
    if (!id || !blobB64) return res.status(400).json({ error: 'missing' });
    const buf = Buffer.from(blobB64, 'base64');
    const entry = { id, data: new Binary(Uint8Array.from(buf)), ivB64: ivB64 || null, createdAt: new Date() };
    // if meta provided, set it atomically
    const update: any = { $push: { passwords: entry as any } };
    if (meta) update.$set = { meta };
  const result = await users.findOneAndUpdate({ _id: user._id }, update as any, { returnDocument: 'after', upsert: true });
  const updated = result.value ?? { passwords: [], meta: null };
  const passwords = (Array.isArray(updated.passwords) ? updated.passwords.map((p: any) => ({ id: p.id, blobB64: Buffer.from((p.data as any).buffer).toString('base64'), ivB64: p.ivB64, createdAt: p.createdAt })) : []);
  const respMeta = { saltB64: updated?.meta?.saltB64, iterations: updated?.meta?.iterations };
    return res.status(200).json({ ok: true, passwords, meta: respMeta });
  }

  if (req.method === 'DELETE') {
    // accept id from body or query for robustness
    const bodyId = (req.body && (req.body as any).id) as string | undefined;
    const queryId = Array.isArray(req.query.id) ? req.query.id[0] : (req.query.id as string | undefined);
    const id = (bodyId || queryId || '').toString();
    if (!id) return res.status(400).json({ error: 'missing' });

  const result = await users.findOneAndUpdate({ _id: user._id }, { $pull: { passwords: { id } } } as any, { returnDocument: 'after' });
  const updated = result.value ?? { passwords: [], meta: null };
  const passwords = (Array.isArray(updated.passwords) ? updated.passwords.map((p: any) => ({ id: p.id, blobB64: Buffer.from((p.data as any).buffer).toString('base64'), ivB64: p.ivB64, createdAt: p.createdAt })) : []);
  const respMeta = { saltB64: updated?.meta?.saltB64, iterations: updated?.meta?.iterations };
    return res.status(200).json({ ok: true, passwords, meta: respMeta });
  }

  return res.status(405).end();
}
