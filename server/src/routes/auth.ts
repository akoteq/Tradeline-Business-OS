import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { BDO } from '../models/BDO';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { param } from '../lib/query';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
  try {
    const user = await User.findOne({ email }).select('+password');
    const rawUser = user?.toObject() as { _id: unknown; password: string; role: string; bdoId?: string | null; mustChangePassword: boolean } | null;
    if (!rawUser || !(await bcrypt.compare(password, rawUser.password))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const userId = String(rawUser._id);
    const bdoId = rawUser.bdoId ?? null;
    const bdo = bdoId ? await BDO.findById(bdoId) : null;
    const token = jwt.sign(
      { userId, role: rawUser.role, bdoId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        id: userId,
        email,
        role: rawUser.role,
        bdoId,
        bdoName: bdo?.get('name') ?? null,
        mustChangePassword: rawUser.mustChangePassword,
      },
    });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const json = user.toJSON() as Record<string, unknown>;
    const bdo = json.bdoId ? await BDO.findById(json.bdoId) : null;
    res.json({ ...json, bdoName: bdo?.get('name') ?? null });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Admin: list all users
router.get('/users', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const bdoIds = [...new Set(users.map((u) => (u.toJSON() as Record<string, unknown>).bdoId as string).filter(Boolean))];
    const bdos = bdoIds.length ? await BDO.find({ _id: { $in: bdoIds } }) : [];
    const bdoMap: Record<string, string> = {};
    bdos.forEach((b) => { bdoMap[b.id] = b.get('name'); });
    res.json(users.map((u) => {
      const json = u.toJSON() as Record<string, unknown>;
      return { ...json, bdoName: json.bdoId ? bdoMap[json.bdoId as string] ?? null : null };
    }));
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: create a user (BDO or ADMIN)
router.post('/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { email, password, bdoId, role = 'BDO' } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await new User({ email, password: hashed, role, bdoId: bdoId || null, mustChangePassword: true }).save();
    const json = user.toJSON() as Record<string, unknown>;
    const bdo = json.bdoId ? await BDO.findById(json.bdoId) : null;
    res.status(201).json({ ...json, bdoName: bdo?.get('name') ?? null });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create user', detail: String(err) });
  }
});

// Admin: reset another user's password
router.put('/users/:id/password', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: 'Password required' }); return; }
  try {
    const hashed = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(param(req, 'id'), { password: hashed, mustChangePassword: true });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Failed to update password' });
  }
});

// Admin: change a user's role
router.put('/users/:id/role', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { role } = req.body;
  if (!['ADMIN', 'BDO', 'CEO'].includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  try {
    const user = await User.findByIdAndUpdate(param(req, 'id'), { role }, { new: true });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user.toJSON());
  } catch {
    res.status(400).json({ error: 'Failed to update role' });
  }
});

// Admin: change a user's linked BDO
router.put('/users/:id/bdo', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { bdoId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(param(req, 'id'), { bdoId: bdoId || null }, { new: true });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const json = user.toJSON() as Record<string, unknown>;
    const bdo = json.bdoId ? await BDO.findById(json.bdoId) : null;
    res.json({ ...json, bdoName: bdo?.get('name') ?? null });
  } catch {
    res.status(400).json({ error: 'Failed to update linked BDO' });
  }
});

// Authenticated user: change their own password (clears mustChangePassword)
router.put('/me/password', requireAuth, async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }
  try {
    const hashed = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(req.user!.userId, { password: hashed, mustChangePassword: false });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Failed to update password' });
  }
});

// Admin: delete a user
router.delete('/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await User.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete user' });
  }
});

export default router;
