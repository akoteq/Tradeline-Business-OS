import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from './lib/db';
import { User } from './models/User';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: pnpm tsx src/create-admin.ts <email> <password>');
  process.exit(1);
}

async function main() {
  await connectDB();
  const hashed = await bcrypt.hash(password, 10);
  const existing = await User.findOne({ email });
  if (existing) {
    await User.findByIdAndUpdate(existing.id, { password: hashed, role: 'ADMIN', mustChangePassword: false });
    console.log(`Password updated for existing admin: ${email}`);
  } else {
    await User.create({ email, password: hashed, role: 'ADMIN', mustChangePassword: false });
    console.log(`Admin created: ${email}`);
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
