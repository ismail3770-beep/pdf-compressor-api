const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Configure multer for file uploads
const upload = multer({ dest: os.tmpdir() });

app.get('/health', (req, res) => res.send('OK'));

app.post('/compress', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(os.tmpdir(), `compressed-${Date.now()}.pdf`);
  
  // Get compression level from body, default to screen (72 dpi)
  // Options: screen, ebook, printer, prepress, default
  const compressionLevel = req.body.level || 'screen';

  // Build ghostscript command
  const gsArgs = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=/${compressionLevel}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${outputPath}`,
    inputPath
  ];

  const gs = spawn('gs', gsArgs);

  let errorOutput = '';

  gs.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  gs.on('close', (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      // Send the compressed file back
      res.sendFile(outputPath, (err) => {
        // Cleanup files after sending
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      });
    } else {
      // Cleanup on failure
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      console.error(`Ghostscript error: ${errorOutput}`);
      res.status(500).json({ error: 'Compression failed', details: errorOutput });
    }
  });
});

app.listen(port, () => {
  console.log(`PDF Compressor API listening on port ${port}`);
});
