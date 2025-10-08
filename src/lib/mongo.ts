import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
if (!uri) {
  console.warn('MONGODB_URI not set; database calls will fail in runtime');
}

let cached: { client: MongoClient | null } = { client: null };

export async function getDb() {
  if (!uri) throw new Error('MONGODB_URI not configured');
  if (cached.client) return cached.client.db();
  const client = new MongoClient(uri);
  await client.connect();
  cached.client = client;
  return client.db();
}
