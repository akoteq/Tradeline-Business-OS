import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, USER_ROLES, UserRole } from '../models/User';
import { BDO } from '../models/BDO';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { param } from '../lib/query';
import { generateTempPassword } from '../lib/password';
import { sendInviteEmail } from '../lib/inviteEmail';

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
      { userId, role: rawUser.role, bdoId, bdoCompany: bdo?.get('company') ?? null },
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
        bdoCompany: bdo?.get('company') ?? null,
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
    res.json({ ...json, bdoName: bdo?.get('name') ?? null, bdoCompany: bdo?.get('company') ?? null });
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
  if (!USER_ROLES.includes(role as UserRole)) { res.status(400).json({ error: 'Invalid role' }); return; }
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

// Admin: onboard a team member in one shot — creates the staff profile AND a login
// account with an auto-generated temporary password, then emails them the invite.
router.post('/onboard', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { name, email, phone, company, role, accessRole = 'BDO', managerId } = req.body;
  if (!name || !email) { res.status(400).json({ error: 'Name and email are required' }); return; }
  if (!company) { res.status(400).json({ error: 'Company is required' }); return; }
  if (!USER_ROLES.includes(accessRole as UserRole)) { res.status(400).json({ error: 'Invalid access role' }); return; }
  try {
    const existing = await User.findOne({ email });
    if (existing) { res.status(400).json({ error: 'A login with this email already exists' }); return; }

    const bdo = await new BDO({ name, email, phone: phone || null, company, role: role || null, managerId: managerId || null }).save();

    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    const user = await new User({ email, password: hashed, role: accessRole, bdoId: bdo.id, mustChangePassword: true }).save();

    const emailResult = await sendInviteEmail({ to: email, name, password: tempPassword });

    res.status(201).json({
      bdo: bdo.toJSON(),
      user: { ...(user.toJSON() as Record<string, unknown>), bdoName: bdo.get('name') },
      tempPassword,
      emailSent: emailResult.sent,
      emailError: emailResult.sent ? undefined : (emailResult.error ?? 'Email not sent'),
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to onboard team member', detail: String(err) });
  }
});

// Admin: create a login for an EXISTING staff profile (one that has no account yet) and
// email them the invite. Used to onboard the profiles that pre-date the login system.
router.post('/bdos/:id/invite', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const bdo = await BDO.findById(param(req, 'id'));
    if (!bdo) { res.status(404).json({ error: 'Staff profile not found' }); return; }
    const email = (req.body.email || bdo.get('email') || '').trim();
    if (!email) { res.status(400).json({ error: 'This profile has no email — add one to invite them.' }); return; }
    const accessRole = (req.body.accessRole || 'BDO') as UserRole;
    if (!USER_ROLES.includes(accessRole)) { res.status(400).json({ error: 'Invalid access role' }); return; }

    const existing = await User.findOne({ email });
    if (existing) { res.status(400).json({ error: 'A login with this email already exists' }); return; }

    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    const user = await new User({ email, password: hashed, role: accessRole, bdoId: bdo.id, mustChangePassword: true }).save();
    if (!bdo.get('email')) { bdo.set('email', email); await bdo.save(); }

    const emailResult = await sendInviteEmail({ to: email, name: bdo.get('name'), password: tempPassword });
    res.status(201).json({
      user: { ...(user.toJSON() as Record<string, unknown>), bdoName: bdo.get('name') },
      tempPassword,
      emailSent: emailResult.sent,
      emailError: emailResult.sent ? undefined : (emailResult.error ?? 'Email not sent'),
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to invite staff profile', detail: String(err) });
  }
});

// Admin: regenerate a user's temporary password and re-send the invite email.
router.post('/users/:id/resend-invite', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(param(req, 'id'));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const tempPassword = generateTempPassword();
    user.set('password', await bcrypt.hash(tempPassword, 10));
    user.set('mustChangePassword', true);
    await user.save();
    const bdo = user.get('bdoId') ? await BDO.findById(user.get('bdoId')) : null;
    const emailResult = await sendInviteEmail({ to: user.get('email'), name: bdo?.get('name') ?? null, password: tempPassword, resend: true });
    res.json({ tempPassword, emailSent: emailResult.sent, emailError: emailResult.sent ? undefined : (emailResult.error ?? 'Email not sent') });
  } catch (err) {
    res.status(400).json({ error: 'Failed to resend invite', detail: String(err) });
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
  if (!USER_ROLES.includes(role as UserRole)) { res.status(400).json({ error: 'Invalid role' }); return; }
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
