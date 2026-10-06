const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'clip-zeno-backend' });
});

async function handleClip(req, res) {
  const videoUrl = req.query.videoUrl || req.body?.videoUrl;
  const start = req.query.start || req.body?.start || '0';
  const end = req.query.end || req.body?.end;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing videoUrl parameter' });
  }

  const outputPath = path.join(os.tmpdir(), `clip-${Date.now()}.mp4`);
  const args = ['-y'];
  if (start) args.push('-ss', String(start));
  if (end) args.push('-to', String(end));
  args.push('-i', videoUrl, '-c', 'copy', '-movflags', '+faststart', outputPath);

  const ffmpeg = spawn(ffmpegPath, args);

  ffmpeg.on('close', (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="clip.mp4"');
      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
      stream.on('close', () => {
        fs.unlink(outputPath, () => {});
      });
    } else {
      res.status(500).json({ error: `FFmpeg failed with exit code ${code}` });
    }
  });

  ffmpeg.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
}

app.get('/api/clip', handleClip);
app.post('/api/clip', handleClip);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
