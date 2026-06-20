import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireCEO } from '../middleware/auth';

const router = Router();

// Invite a BDO — creates a User record and returns the invite URL
router.post('/invite-bdo', requireCEO, async (req: Request, res: Response) => {
  const { email, bdoId, bdoName } = req.body as { email: string; bdoId: string; bdoName: string };
  if (!email || !bdoId) return res.status(400).json({ error: 'email and bdoId are required' });

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { inviteToken, inviteExpiry } });
  } else {
    await prisma.user.create({
      data: { email, passwordHash: '', role: 'BDO', bdoId, name: bdoName ?? null, inviteToken, inviteExpiry },
    });
  }

  const appUrl = (process.env.CLIENT_URL ?? 'http://localhost:3000').split(',')[0].trim();
  const inviteUrl = `${appUrl}/auth/set-password?token=${inviteToken}`;

  res.json({ message: `Invite created for ${email}`, inviteUrl });
});

// List all system users
router.get('/users', requireCEO, async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      bdoId: u.bdoId,
      name: u.name,
      createdAt: u.createdAt,
      confirmed: !u.inviteToken,
    }))
  );
});

// Delete a user
router.delete('/users/:id', requireCEO, async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: String(req.params.id) } });
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete user' });
  }
});

export default router;
