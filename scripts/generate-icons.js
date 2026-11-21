import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, colorFn) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = colorFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeAndData = Buffer.concat([Buffer.from(type), data]);

    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
      }
      crcTable[n] = c;
    }

    function crc32(buf) {
      let crc = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    }

    const crcVal = crc32(typeAndData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);

    return Buffer.concat([len, typeAndData, crcBuf]);
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression: Deflate
  ihdrData[11] = 0; // Filter: Standard
  ihdrData[12] = 0; // Interlace: None

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Sales Chart Icon Painter (Biểu đồ số bán / Sale Update)
function salesChartIconPainter(x, y, w, h, isMaskable = false) {
  // Normalize coordinates to 0..1
  const nx = x / w;
  const ny = y / h;

  // Masking for standard icons (Rounded container with border)
  if (!isMaskable) {
    const margin = 0.04;
    const cornerRadius = 0.22;
    if (nx < margin || nx > 1 - margin || ny < margin || ny > 1 - margin) {
      return [0, 0, 0, 0];
    }
    const qx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - margin - cornerRadius));
    const qy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - margin - cornerRadius));
    if (qx * qx + qy * qy > cornerRadius * cornerRadius) {
      return [0, 0, 0, 0];
    }
  }

  // Background Gradient: Deep Teal / Emerald #022c22 -> #064e3b -> #0d9488
  const bgT = (nx + ny) / 2;
  let r = Math.round(2 + bgT * 11);
  let g = Math.round(44 + bgT * 104);
  let b = Math.round(34 + bgT * 102);
  let a = 255;

  // Grid line at baseline (ny ~ 0.78)
  if (Math.abs(ny - 0.78) < 0.005 && nx >= 0.16 && nx <= 0.84) {
    r = Math.min(255, r + 50);
    g = Math.min(255, g + 80);
    b = Math.min(255, b + 70);
  }

  // 4 Rising Sales Bars (Biểu đồ 4 cột số bán tăng trưởng)
  // Bars definition: [left, right, top, bottom, colorTop, colorBot]
  const bars = [
    {
      left: 0.18, right: 0.29, top: 0.54, bottom: 0.78,
      topCol: [16, 185, 129], botCol: [4, 120, 87] // Emerald
    },
    {
      left: 0.35, right: 0.46, top: 0.42, bottom: 0.78,
      topCol: [45, 212, 191], botCol: [13, 148, 136] // Teal/Cyan
    },
    {
      left: 0.52, right: 0.63, top: 0.30, bottom: 0.78,
      topCol: [56, 189, 248], botCol: [2, 132, 199] // Sky Blue
    },
    {
      left: 0.69, right: 0.80, top: 0.18, bottom: 0.78,
      topCol: [251, 191, 36], botCol: [217, 119, 6] // Gold/Amber Peak
    }
  ];

  for (const bar of bars) {
    if (nx >= bar.left && nx <= bar.right && ny >= bar.top && ny <= bar.bottom) {
      // Rounded bar top
      const barCenter = (bar.left + bar.right) / 2;
      const barRadius = (bar.right - bar.left) / 2;
      if (ny < bar.top + barRadius) {
        const dx = nx - barCenter;
        const dy = ny - (bar.top + barRadius);
        if (dx * dx + dy * dy > barRadius * barRadius) {
          continue;
        }
      }

      const barT = (ny - bar.top) / (bar.bottom - bar.top);
      r = Math.round(bar.topCol[0] * (1 - barT) + bar.botCol[0] * barT);
      g = Math.round(bar.topCol[1] * (1 - barT) + bar.botCol[1] * barT);
      b = Math.round(bar.topCol[2] * (1 - barT) + bar.botCol[2] * barT);
      return [r, g, b, 255];
    }
  }

  // Trendline & Arrow connecting points (0.235, 0.50) -> (0.405, 0.38) -> (0.575, 0.26) -> (0.745, 0.14)
  const linePoints = [
    { x: 0.235, y: 0.50 },
    { x: 0.405, y: 0.38 },
    { x: 0.575, y: 0.26 },
    { x: 0.745, y: 0.14 }
  ];

  // Check proximity to line segments
  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }

  const lineThickness = 0.022;
  for (let i = 0; i < linePoints.length - 1; i++) {
    const d = distToSegment(nx, ny, linePoints[i].x, linePoints[i].y, linePoints[i + 1].x, linePoints[i + 1].y);
    if (d < lineThickness) {
      const alphaVal = 1 - d / lineThickness;
      r = 255;
      g = Math.round(240 + alphaVal * 15);
      b = Math.round(180 + alphaVal * 75);
      return [r, g, b, 255];
    }
  }

  // Check data point nodes
  for (let i = 0; i < linePoints.length; i++) {
    const pt = linePoints[i];
    const d = Math.sqrt((nx - pt.x) * (nx - pt.x) + (ny - pt.y) * (ny - pt.y));
    if (d < 0.028) {
      if (d < 0.016) {
        return [255, 255, 255, 255]; // White core
      } else {
        return [245, 158, 11, 255]; // Amber rim
      }
    }
  }

  // Arrow Head at (0.745, 0.14)
  const arrowDist1 = distToSegment(nx, ny, 0.67, 0.13, 0.76, 0.13);
  const arrowDist2 = distToSegment(nx, ny, 0.76, 0.13, 0.76, 0.22);
  if (arrowDist1 < lineThickness || arrowDist2 < lineThickness) {
    return [255, 255, 255, 255];
  }

  return [r, g, b, a];
}

const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate 192x192
const png192 = createPNG(192, 192, (x, y, w, h) => salesChartIconPainter(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), png192);

// Generate 512x512
const png512 = createPNG(512, 512, (x, y, w, h) => salesChartIconPainter(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), png512);

// Generate 512x512 Maskable
const png512Mask = createPNG(512, 512, (x, y, w, h) => salesChartIconPainter(x, y, w, h, true));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512-maskable.png'), png512Mask);

// Generate favicon 64x64
const favicon = createPNG(64, 64, (x, y, w, h) => salesChartIconPainter(x, y, w, h, false));
fs.writeFileSync(path.join(process.cwd(), 'public', 'favicon.png'), favicon);

console.log('Successfully generated Sales Chart PWA PNG and Favicon icons for "Sale Update"!');
