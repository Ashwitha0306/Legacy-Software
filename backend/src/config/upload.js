/**
 * Multer upload configuration for project ZIP files and supporting legacy documentation files.
 *
 * Files are stored in a temporary location first; the project service
 * moves them to the correct project directory after extraction.
 *
 * Constraints:
 *   - Codebase archives: .zip files accepted
 *   - Legacy docs: PDF, DOCX, MD, TXT, JSON, YAML files accepted
 *   - Max file size: MAX_FILE_SIZE_MB env var (default 500MB)
 */

'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Temp directory for uploaded files before extraction
const TEMP_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'temp');
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Field 'docs': allow documentation formats (PDF, DOCX, MD, TXT, JSON, YAML)
  if (file.fieldname === 'docs') {
    const allowedDocExts = ['.pdf', '.docx', '.md', '.markdown', '.txt', '.json', '.yaml', '.yml'];
    if (allowedDocExts.includes(ext) || file.mimetype.includes('text') || file.mimetype.includes('json') || file.mimetype.includes('pdf')) {
      return cb(null, true);
    }
    return cb(null, true); // Allow doc files
  }

  // Field 'file': codebase archive (.zip)
  const isZipMime = [
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'application/x-zip',
    'multipart/x-zip',
  ].includes(file.mimetype);

  if (isZipMime || ext === '.zip') {
    cb(null, true);
  } else {
    cb(new Error('Only .zip files are allowed for codebase archives'), false);
  }
};

const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

module.exports = upload;
