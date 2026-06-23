import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URL || process.env.DATABASE_URL;
  if (!uri) throw new Error('MONGODB_URL or DATABASE_URL env var not set');
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
