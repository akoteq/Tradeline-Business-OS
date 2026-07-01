import { Router, Request, Response } from 'express';
import multer from 'multer';
import { UploadApiResponse } from 'cloudinary';
import { ClientDocument } from '../models/ClientDocument';
import cloudinary from '../lib/cloudinary';
import { qs, param } from '../lib/query';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', async (req: Request, res: Response) => {
  try {
    const smeId = qs(req, 'smeId');
    const query: Record<string, unknown> = {};
    if (smeId) query.smeId = smeId;
    const docs = await ClientDocument.find(query).sort({ createdAt: -1 });
    res.json(docs.map((d) => d.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const smeId = req.body.smeId;
    if (!file) { res.status(400).json({ error: 'No file provided' }); return; }
    if (!smeId) { res.status(400).json({ error: 'smeId is required' }); return; }

    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'client-documents' },
        (err, result) => {
          if (err || !result) { reject(err ?? new Error('Upload failed')); return; }
          resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    const doc = await new ClientDocument({
      smeId,
      fileName: file.originalname,
      fileUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedBy: req.body.uploadedBy || null,
    }).save();

    res.status(201).json(doc.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to upload document', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await ClientDocument.findById(param(req, 'id'));
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
    try {
      await cloudinary.uploader.destroy(doc.get('publicId'), { resource_type: doc.get('resourceType') || 'raw' });
    } catch {
      // proceed with DB deletion even if the Cloudinary asset is already gone
    }
    await ClientDocument.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete document' });
  }
});

export default router;
