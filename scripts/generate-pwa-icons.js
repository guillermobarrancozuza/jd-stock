import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const publicDir = path.resolve('public');
  const sourceImage = path.join(publicDir, 'assets', 'logo_jd_square.png');

  if (!fs.existsSync(sourceImage)) {
    console.error('Source logo does not exist:', sourceImage);
    return;
  }

  // 1. Generate 512x512 with dark background
  const bg512 = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="64" fill="#0d1117"/>
      <circle cx="256" cy="256" r="230" fill="#161b22" stroke="#30363d" stroke-width="4"/>
    </svg>
  `);

  const innerLogo512 = await sharp(sourceImage)
    .resize(360, 204, { fit: 'contain' })
    .toBuffer();

  const icon512 = await sharp(bg512)
    .composite([{ input: innerLogo512, top: 154, left: 76 }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), icon512);
  console.log('Generated pwa-512x512.png');

  // 2. Generate 192x192
  const icon192 = await sharp(icon512)
    .resize(192, 192)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), icon192);
  console.log('Generated pwa-192x192.png');

  // 3. Generate Apple Touch Icon 180x180 (no alpha, solid background)
  const iconApple = await sharp(icon512)
    .resize(180, 180)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), iconApple);
  console.log('Generated apple-touch-icon.png');

  // 4. Generate Maskable 512x512 (logo smaller with safe margins ~70% of canvas)
  const innerLogoMaskable = await sharp(sourceImage)
    .resize(300, 170, { fit: 'contain' })
    .toBuffer();

  const maskable512 = await sharp(bg512)
    .composite([{ input: innerLogoMaskable, top: 171, left: 106 }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskable512);
  console.log('Generated pwa-maskable-512x512.png');

  // 5. Generate SVG icon
  const svgIcon = `
  <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="128" fill="#0D1117"/>
    <rect x="24" y="24" width="464" height="464" rx="104" stroke="#F59E0B" stroke-width="8" stroke-dasharray="16 16"/>
    <text x="256" y="270" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="140" fill="#F59E0B" text-anchor="middle">JD</text>
    <text x="256" y="360" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="44" fill="#E6EDF3" text-anchor="middle" letter-spacing="4">STOCK</text>
  </svg>
  `;
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon.trim());
  console.log('Generated icon.svg');
}

generateIcons().catch(console.error);
