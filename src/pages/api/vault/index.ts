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

  if (req.method === 'GET') {
    // return meta and list of password blobs (base64) for client-side decryption
    const passwords = (Array.isArray(user.passwords) ? user.passwords.map((p: any) => ({ id: p.id, blobB64: Buffer.from((p.data as any).buffer).toString('base64'), ivB64: p.ivB64, createdAt: p.createdAt })) : []);
    return res.status(200).json({ meta: user.meta || null, passwords });
  }

  if (req.method === 'POST') {
    const { meta } = req.body as { meta?: any };
    // meta should contain vaultB64 (base64 ciphertext) and ivB64
    if (meta && meta.vaultB64) {
      const buf = Buffer.from(meta.vaultB64, 'base64');
      const entry = { data: new Binary(Uint8Array.from(buf)), ivB64: meta.ivB64 || null, createdAt: new Date() };
      // atomically push new password blob and update meta, return updated document
      const update = { $push: { passwords: entry as any }, $set: { 'meta.saltB64': meta.saltB64, 'meta.iterations': meta.iterations } };
      const result = await users.findOneAndUpdate({ _id: user._id }, update as any, { upsert: true, returnDocument: 'after' });
      const updated = result.value;
      if (!updated) return res.status(500).json({ error: 'update_failed' });
      // get latest blob
      const latest = (Array.isArray(updated.passwords) && updated.passwords.length) ? updated.passwords[updated.passwords.length - 1] : null;
      const vaultB64 = latest ? Buffer.from((latest.data as any).buffer).toString('base64') : meta.vaultB64;
      const respMeta = { saltB64: updated.meta?.saltB64, iterations: updated.meta?.iterations, ivB64: latest?.ivB64, vaultB64 };
      return res.status(200).json({ ok: true, meta: respMeta });
    }
    // fallback: store meta as-is and return updated meta
    const result = await users.findOneAndUpdate({ _id: user._id }, { $set: { meta } }, { upsert: true, returnDocument: 'after' });
    return res.status(200).json({ ok: true, meta: result.value?.meta || null });
  }

  return res.status(405).end();
}
