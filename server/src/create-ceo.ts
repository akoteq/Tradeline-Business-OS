import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

async function main() {
  const email = 'tiisusharif1@gmail.com';
  const password = 'TradelineBAPX#2025';
  const name = 'Tiisu Sharif';

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({ where: { email }, data: { passwordHash, role: 'CEO', name } });
    console.log('CEO user updated:', email);
  } else {
    await prisma.user.create({ data: { email, passwordHash, role: 'CEO', name } });
    console.log('CEO user created:', email);
  }

  console.log('Password:', password);
  console.log('→ Change this password after first login.');
  await prisma.$disconnect();
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
