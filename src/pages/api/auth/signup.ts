import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes, pbkdf2Sync } from 'crypto';
import { getDb } from '../../../lib/mongo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { email, password, meta } = req.body as { email?: string; password?: string; meta?: any };
  if (!email || !password) return res.status(400).json({ error: 'missing' });

  const db = await getDb();
  const users = db.collection('users');
  const existing = await users.findOne({ email });
  if (existing) return res.status(409).json({ error: 'exists' });

  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');

  await users.insertOne({ email, verifier: { salt, hash }, meta: meta || null, sessions: [], passwords: [] });
  return res.status(201).json({ ok: true });
}
