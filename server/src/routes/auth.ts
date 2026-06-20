import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireCEO } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES = '7d';

function makeToken(user: { id: string; email: string; role: string; bdoId?: string | null; name?: string | null }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, bdoId: user.bdoId ?? null, name: user.name ?? null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = makeToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, bdoId: user.bdoId, name: user.name } });
});

// POST /api/auth/invite — CEO creates an invite link for a BDO
router.post('/invite', requireCEO, async (req: Request, res: Response) => {
  const { email, bdoId, name } = req.body as { email: string; bdoId: string; name?: string };
  if (!email || !bdoId) return res.status(400).json({ error: 'email and bdoId are required' });

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Re-issue invite token for existing unactivated user
    await prisma.user.update({ where: { email }, data: { inviteToken, inviteExpiry } });
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: '',
        role: 'BDO',
        bdoId,
        name: name ?? null,
        inviteToken,
        inviteExpiry,
      },
    });
  }

  const appUrl = (process.env.CLIENT_URL ?? 'http://localhost:3000').split(',')[0].trim();
  const inviteUrl = `${appUrl}/auth/set-password?token=${inviteToken}`;

  res.json({ message: `Invite ready for ${email}`, inviteUrl });
});

// POST /api/auth/accept-invite — BDO sets their password from invite token
router.post('/accept-invite', async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user) return res.status(400).json({ error: 'Invalid or expired invite link' });
  if (user.inviteExpiry && user.inviteExpiry < new Date()) {
    return res.status(400).json({ error: 'Invite link has expired' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, inviteToken: null, inviteExpiry: null },
  });

  const jwtToken = makeToken(updated);
  res.json({ token: jwtToken, user: { id: updated.id, email: updated.email, role: updated.role, bdoId: updated.bdoId, name: updated.name } });
});

// GET /api/auth/me — returns current user from token
router.get('/me', (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.user);
});

export default router;
