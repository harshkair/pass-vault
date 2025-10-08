import type { NextApiRequest, NextApiResponse } from 'next';
import { pbkdf2Sync, randomBytes } from 'crypto';
import { getDb } from '../../../lib/mongo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'missing' });

  const db = await getDb();
  const users = db.collection('users');
  const user = await users.findOne({ email });
  if (!user) return res.status(404).json({ error: 'not found' });

  const { salt, hash } = user.verifier as { salt: string; hash: string };
  const check = pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  if (check !== hash) return res.status(401).json({ error: 'invalid' });

  const token = randomBytes(24).toString('hex');
  await users.updateOne({ email }, { $push: { sessions: { token, createdAt: new Date() } } });
  return res.status(200).json({ token, meta: user.meta || null });
}
