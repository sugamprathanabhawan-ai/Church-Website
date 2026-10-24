const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const inputMov = path.join(__dirname, '..', 'public', 'vid.mov');
const outputWebm = path.join(__dirname, '..', 'public', 'vid.webm');
const outputMp4 = path.join(__dirname, '..', 'public', 'vid.mp4');

console.log('Using ffmpeg from:', ffmpeg.path);
console.log('Input file:', inputMov);

if (!fs.existsSync(inputMov)) {
  console.error('Input file does not exist:', inputMov);
  process.exit(1);
}

const stat = fs.statSync(inputMov);
console.log(`Original size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

// 1. Convert to WebM (VP9, CRF 32, muted, 720p or 1080p, optimized for hero background)
// -an strips audio since it's an auto-playing muted hero video anyway! That saves tons of MBs!
console.log('\n--- Converting to WebM (target 3-5MB) ---');
const webmArgs = [
  '-i', inputMov,
  '-an', // remove audio track for background video
  '-vf', 'scale=-2:720', // scale height to 720p (crisp and efficient for hero loop)
  '-c:v', 'libvpx-vp9',
  '-b:v', '800k',
  '-crf', '34',
  '-deadline', 'good',
  '-cpu-used', '3',
  '-y', outputWebm
];

const webmResult = spawnSync(ffmpeg.path, webmArgs, { stdio: 'inherit' });
if (webmResult.error) {
  console.error('WebM conversion error:', webmResult.error);
} else {
  if (fs.existsSync(outputWebm)) {
    const webmStat = fs.statSync(outputWebm);
    console.log(`WebM generated: ${(webmStat.size / (1024 * 1024)).toFixed(2)} MB`);
  }
}

// 2. Also convert to MP4 (H.264, universally compatible fallback for Safari / iOS)
console.log('\n--- Converting to MP4 Fallback (H.264, target 3-5MB) ---');
const mp4Args = [
  '-i', inputMov,
  '-an',
  '-vf', 'scale=-2:720',
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '26',
  '-movflags', '+faststart',
  '-pix_fmt', 'yuv420p',
  '-y', outputMp4
];

const mp4Result = spawnSync(ffmpeg.path, mp4Args, { stdio: 'inherit' });
if (mp4Result.error) {
  console.error('MP4 conversion error:', mp4Result.error);
} else {
  if (fs.existsSync(outputMp4)) {
    const mp4Stat = fs.statSync(outputMp4);
    console.log(`MP4 generated: ${(mp4Stat.size / (1024 * 1024)).toFixed(2)} MB`);
  }
}

console.log('\nConversion complete!');
