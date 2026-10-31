// Removes metadata (EXIF with GPS, XMP, IPTC, comments, text chunks) from
// photos before they are stored. Phone photos record where they were taken.

// --- JPEG --------------------------------------------------------------------

const SOI = 0xd8;
const SOS = 0xda;
const APP1 = 0xe1; // EXIF and XMP
const APP13 = 0xed; // Photoshop / IPTC
const COM = 0xfe; // comment

// Reads the EXIF Orientation tag (1-8) from an APP1 segment body.
function readOrientation(body: Uint8Array): number | null {
  const header = "Exif\0\0";
  for (let i = 0; i < header.length; i++) if (body[i] !== header.charCodeAt(i)) return null;
  const tiff = body.subarray(6);
  if (tiff.length < 8) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return null;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

// A minimal APP1 segment that carries only the Orientation tag, so portrait
// photos keep displaying upright after the rest of EXIF is removed.
function orientationSegment(orientation: number): Uint8Array {
  const body = [
    ...[0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // "Exif\0\0"
    ...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // big-endian TIFF, IFD at 8
    ...[0x00, 0x01], // one entry
    ...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00],
    ...[0x00, 0x00, 0x00, 0x00], // no next IFD
  ];
  const length = body.length + 2;
  return Uint8Array.from([0xff, APP1, length >> 8, length & 0xff, ...body]);
}

export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input[0] !== 0xff || input[1] !== SOI) return input;
  const parts: Uint8Array[] = [input.subarray(0, 2)];
  let orientation: number | null = null;
  let pos = 2;

  while (pos + 4 <= input.length) {
    if (input[pos] !== 0xff) return input; // not a valid segment: keep the file as is
    const marker = input[pos + 1];
    if (marker === SOS) break;
    const length = (input[pos + 2] << 8) | input[pos + 3];
    const end = pos + 2 + length;
    if (length < 2 || end > input.length) return input;

    if (marker === APP1) {
      orientation ??= readOrientation(input.subarray(pos + 4, end));
    } else if (marker !== APP13 && marker !== COM) {
      parts.push(input.subarray(pos, end));
    }
    pos = end;
  }

  if (orientation !== null && orientation !== 1) parts.splice(1, 0, orientationSegment(orientation));
  parts.push(input.subarray(pos)); // image data from SOS to the end
  return concat(parts);
}

// --- PNG ---------------------------------------------------------------------

const PNG_SIGNATURE_LENGTH = 8;
const DROPPED_PNG_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

export function stripPngMetadata(input: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [input.subarray(0, PNG_SIGNATURE_LENGTH)];
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let pos = PNG_SIGNATURE_LENGTH;

  while (pos + 12 <= input.length) {
    const length = view.getUint32(pos);
    const end = pos + 12 + length; // length + type + data + CRC
    if (end > input.length) return input;
    const type = String.fromCharCode(...input.subarray(pos + 4, pos + 8));
    if (!DROPPED_PNG_CHUNKS.has(type)) parts.push(input.subarray(pos, end));
    pos = end;
    if (type === "IEND") break;
  }
  return concat(parts);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
