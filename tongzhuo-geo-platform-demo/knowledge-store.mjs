import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync, inflateRawSync, inflateSync } from "node:zlib";
import { aiProviderStore } from "./ai-provider-store.mjs";
import { appendAuditLog } from "./production-audit.mjs";
import { createVectorStore } from "./knowledge-vector-store.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 2_000_000;
const DEFAULT_CHUNK_CHARS = 1_200;
const DEFAULT_CHUNK_OVERLAP = 160;
const LOCAL_EMBEDDING_DIMENSIONS = 256;
const MAX_PARSED_FILE_ENTRIES = 2_000;
const MAX_PDF_EMBEDDED_IMAGES = 500;
const MAX_BATCH_ASSETS = 500;
const MAX_BATCH_ASSET_BYTES = 100 * 1024 * 1024;
const MAX_BATCH_DOCUMENTS = 100;
const MAX_BATCH_DOCUMENT_BYTES = 100 * 1024 * 1024;

export class KnowledgeError extends Error {
  constructor(message, status = 422, code = "KNOWLEDGE_ERROR", details = undefined) {
    super(message);
    this.name = "KnowledgeError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function text(value, field, max = 500, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new KnowledgeError(`${field} 不能为空。`, 422, "INVALID_KNOWLEDGE_INPUT");
  if (result.length > max) throw new KnowledgeError(`${field} 不能超过 ${max} 个字符。`, 422, "INVALID_KNOWLEDGE_INPUT");
  return result;
}

function json(value, fallback = {}) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function metadataObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return json(value, {});
}

function knowledgeVisibility(metadata) {
  return String(metadataObject(metadata).visibility || "public").trim().toLowerCase() === "internal" ? "internal" : "public";
}

function evidenceMatchText(value) {
  // Quotes copied into an article may end at a sentence boundary while the
  // indexed chunk continues with another clause (for example `。` vs `；`).
  // Compare the substantive text rather than formatting punctuation so a
  // legacy citation can be resolved without weakening its exact hierarchy.
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

function isLegacyKnowledgeChunkId(value) {
  return /^KC-[A-Za-z0-9][A-Za-z0-9_-]{1,177}$/.test(String(value || ""));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function normalizeContent(value) {
  const result = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!result) throw new KnowledgeError("知识正文不能为空。", 422, "KNOWLEDGE_CONTENT_REQUIRED");
  if (result.length > MAX_DOCUMENT_CHARS) throw new KnowledgeError(`知识正文不能超过 ${MAX_DOCUMENT_CHARS} 个字符。`, 413, "KNOWLEDGE_CONTENT_TOO_LARGE");
  return result;
}

function decodeBase64(value) {
  const encoded = String(value || "").trim().replace(/^data:[^;,]+;base64,\s*/i, "");
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new KnowledgeError("contentBase64 格式无效。", 422, "KNOWLEDGE_CONTENT_INVALID");
  }
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length) throw new KnowledgeError("contentBase64 不能为空。", 422, "KNOWLEDGE_CONTENT_REQUIRED");
  if (buffer.length > MAX_DOCUMENT_BYTES) throw new KnowledgeError("知识文件超过 20 MB 限制。", 413, "KNOWLEDGE_CONTENT_TOO_LARGE");
  return buffer;
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: " " };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (named[lower]) return named[lower];
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16) || 0xfffd);
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10) || 0xfffd);
    return match;
  });
}

function htmlToText(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(p|div|section|article|header|footer|main|aside|li|tr|h[1-6]|br|hr|table|ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToText(value) {
  return String(value || "")
    .replace(/^```[^\n]*\n?|```$/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(^|\s)[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}(?=\s|$)/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .trim();
}

function zipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new KnowledgeError("Office 文件压缩包无效。", 422, "KNOWLEDGE_FILE_INVALID");
  let eocd = -1;
  for (let cursor = Math.min(buffer.length - 22, 0xffff + 22); cursor >= 0; cursor -= 1) {
    if (buffer.readUInt32LE(cursor) === 0x06054b50) { eocd = cursor; break; }
  }
  if (eocd < 0) throw new KnowledgeError("Office 文件压缩包结构无效。", 422, "KNOWLEDGE_FILE_INVALID");
  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  let uncompressedBytes = 0;
  let cursor = centralOffset;
  for (let index = 0; index < count && index < MAX_PARSED_FILE_ENTRIES; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString((flags & 0x800) ? "utf8" : "latin1");
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/") || (flags & 1)) continue;
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    let content;
    try { content = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null; } catch { content = null; }
    if (content) {
      uncompressedBytes += content.length;
      if (content.length <= MAX_DOCUMENT_BYTES && uncompressedBytes <= MAX_DOCUMENT_BYTES) entries.set(name, content);
      else throw new KnowledgeError("Office 文件解压后超过 20 MB 限制。", 413, "KNOWLEDGE_CONTENT_TOO_LARGE");
    }
  }
  return entries;
}

function parseDocx(buffer) {
  const entries = zipEntries(buffer);
  const xml = entries.get("word/document.xml");
  if (!xml) throw new KnowledgeError("Word 文件缺少正文。", 422, "KNOWLEDGE_FILE_UNSUPPORTED");
  const source = xml.toString("utf8").replace(/<w:tab[^>]*\/>/gi, "\t").replace(/<w:(?:br|cr)[^>]*\/>/gi, "\n").replace(/<w:p[ >][^>]*>/gi, "\n");
  return htmlToText(source.replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n");
}

function parseXlsx(buffer) {
  const entries = zipEntries(buffer);
  const shared = [];
  const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") || "";
  for (const match of sharedXml.matchAll(/<si\b[\s\S]*?<\/si>/gi)) shared.push(htmlToText(match[0].replace(/<[^>]+>/g, " ")));
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") || "";
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";
  const relationMap = new Map([...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi)].map((match) => [match[1], match[2].replace(/^\//, "")]));
  const sheetPaths = [...workbook.matchAll(/<sheet\b[^>]*r:id="([^"]+)"[^>]*>/gi)].map((match) => relationMap.get(match[1]) || "");
  const paths = sheetPaths.length ? sheetPaths : [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
  const rows = [];
  for (const path of paths) {
    const xml = entries.get(path.startsWith("xl/") ? path : `xl/${path}`)?.toString("utf8");
    if (!xml) continue;
    for (const row of xml.matchAll(/<row\b[\s\S]*?<\/row>/gi)) {
      const cells = [];
      for (const cell of row[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
        const attrs = cell[1]; const body = cell[2]; const type = attrs.match(/\bt="([^"]+)"/i)?.[1];
        const value = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] || body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i)?.[1] || "";
        const decoded = type === "s" ? shared[Number(value)] || "" : htmlToText(value.replace(/<[^>]+>/g, " "));
        if (decoded) cells.push(decoded);
      }
      if (cells.length) rows.push(cells.join(" | "));
    }
  }
  if (!rows.length) throw new KnowledgeError("Excel 文件没有可读取的单元格。", 422, "KNOWLEDGE_FILE_EMPTY");
  return rows.join("\n");
}

function pdfString(value) {
  const source = String(value || "");
  if (/^<[0-9a-f\s]+>$/i.test(source)) {
    const bytes = Buffer.from(source.slice(1, -1).replace(/\s+/g, ""), "hex");
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      let output = ""; for (let index = 2; index + 1 < bytes.length; index += 2) output += String.fromCharCode(bytes.readUInt16BE(index)); return output;
    }
    return bytes.toString("latin1");
  }
  return source.slice(1, -1).replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function parsePdf(buffer) {
  const source = buffer.toString("latin1");
  const pieces = [];
  const extractOperators = (text) => {
    for (const match of text.matchAll(/(\([^()\\]*(?:\\.[^()\\]*)*\)|<[0-9a-f\s]+>)\s*(?:Tj|TJ|['"])/gi)) pieces.push(pdfString(match[1]));
    for (const array of text.matchAll(/\[([\s\S]*?)\]\s*TJ/gi)) {
      for (const match of array[1].matchAll(/(\([^()\\]*(?:\\.[^()\\]*)*\)|<[0-9a-f\s]+>)/gi)) pieces.push(pdfString(match[1]));
    }
  };
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;
  while ((streamMatch = streamPattern.exec(source))) {
    let stream = Buffer.from(streamMatch[1], "latin1");
    try { stream = inflateSync(stream); } catch { try { stream = inflateRawSync(stream); } catch { /* uncompressed stream */ } }
    extractOperators(stream.toString("latin1"));
  }
  if (!pieces.length) extractOperators(source);
  if (!pieces.length) throw new KnowledgeError("PDF 文件没有可提取的文字（可能是扫描件，请先 OCR）。", 422, "KNOWLEDGE_FILE_OCR_REQUIRED");
  return pieces.join(" ").replace(/\s{2,}/g, " ").trim();
}

function pdfObjects(buffer) {
  const source = buffer.toString("latin1");
  const objects = [];
  const pattern = /(\d+)\s+(\d+)\s+obj\b/g;
  let match;
  while ((match = pattern.exec(source))) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = source.indexOf("endobj", bodyStart);
    if (bodyEnd < 0) break;
    const body = source.slice(bodyStart, bodyEnd);
    const streamMatch = /stream(?:\r\n|\n|\r)/.exec(body);
    let stream = null;
    let dictionary = body;
    if (streamMatch) {
      dictionary = body.slice(0, streamMatch.index);
      const streamStart = bodyStart + streamMatch.index + streamMatch[0].length;
      const streamMarkerEnd = source.indexOf("endstream", streamStart);
      if (streamMarkerEnd >= 0 && streamMarkerEnd <= bodyEnd) {
        let streamEnd = streamMarkerEnd;
        while (streamEnd > streamStart && [0x0a, 0x0d].includes(buffer[streamEnd - 1])) streamEnd -= 1;
        stream = buffer.subarray(streamStart, streamEnd);
      }
    }
    objects.push({ number: Number(match[1]), generation: Number(match[2]), dictionary, body, stream });
    pattern.lastIndex = bodyEnd + 6;
  }
  return objects;
}

function pdfFilters(dictionary = "") {
  const value = String(dictionary).match(/\/Filter\s*(\[[\s\S]*?\]|\/[A-Za-z0-9]+)/i)?.[1] || "";
  return [...value.matchAll(/\/([A-Za-z0-9]+)/g)].map((match) => match[1]);
}

function decodeAsciiHex(buffer) {
  const source = buffer.toString("latin1").replace(/\s+/g, "").replace(/>.*$/s, "");
  const normalized = source.length % 2 ? `${source}0` : source;
  return Buffer.from(normalized, "hex");
}

function decodeAscii85(buffer) {
  const source = buffer.toString("latin1").replace(/^\s*<~/, "").replace(/~>\s*$/, "").replace(/\s+/g, "");
  const output = [];
  let group = [];
  for (const char of source) {
    if (char === "z" && !group.length) { output.push(0, 0, 0, 0); continue; }
    const code = char.charCodeAt(0);
    if (code < 33 || code > 117) continue;
    group.push(code - 33);
    if (group.length !== 5) continue;
    let value = 0;
    group.forEach((digit) => { value = value * 85 + digit; });
    output.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
    group = [];
  }
  if (group.length) {
    const originalLength = group.length;
    while (group.length < 5) group.push(84);
    let value = 0;
    group.forEach((digit) => { value = value * 85 + digit; });
    const tail = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    output.push(...tail.slice(0, originalLength - 1));
  }
  return Buffer.from(output);
}

function inflatePdfStream(buffer) {
  try { return inflateSync(buffer); } catch { return inflateRawSync(buffer); }
}

function decodePdfOperatorStream(object) {
  if (!object?.stream) return Buffer.alloc(0);
  let output = Buffer.from(object.stream);
  try {
    for (const filter of pdfFilters(object.dictionary)) {
      if (["ASCIIHexDecode", "AHx"].includes(filter)) output = decodeAsciiHex(output);
      else if (["ASCII85Decode", "A85"].includes(filter)) output = decodeAscii85(output);
      else if (["FlateDecode", "Fl"].includes(filter)) output = inflatePdfStream(output);
      else return Buffer.alloc(0);
    }
    return output;
  } catch {
    return Buffer.alloc(0);
  }
}

function pdfImagePageMap(objects) {
  const byNumber = new Map(objects.map((object) => [object.number, object]));
  const pageMap = new Map();
  const pages = objects.filter((object) => /\/Type\s*\/Page\b/i.test(object.dictionary) && !/\/Type\s*\/Pages\b/i.test(object.dictionary));
  const collectXObjects = (dictionary) => {
    let scope = String(dictionary || "");
    const resourcesRef = scope.match(/\/Resources\s+(\d+)\s+\d+\s+R/i)?.[1];
    if (resourcesRef && byNumber.has(Number(resourcesRef))) scope += `\n${byNumber.get(Number(resourcesRef)).dictionary}`;
    const xObjectRef = scope.match(/\/XObject\s+(\d+)\s+\d+\s+R/i)?.[1];
    if (xObjectRef && byNumber.has(Number(xObjectRef))) scope += `\n${byNumber.get(Number(xObjectRef)).dictionary}`;
    const mapping = new Map();
    for (const match of scope.matchAll(/\/([A-Za-z0-9_.-]+)\s+(\d+)\s+\d+\s+R/g)) {
      const target = byNumber.get(Number(match[2]));
      if (target && /\/Subtype\s*\/Image\b/i.test(target.dictionary)) mapping.set(match[1], target.number);
    }
    return mapping;
  };
  pages.forEach((page, index) => {
    const xObjects = collectXObjects(page.dictionary);
    if (!xObjects.size) return;
    const contentRefs = [...page.dictionary.matchAll(/(\d+)\s+\d+\s+R/g)].map((match) => Number(match[1]));
    const usedNames = new Set();
    contentRefs.forEach((reference) => {
      const content = decodePdfOperatorStream(byNumber.get(reference)).toString("latin1");
      for (const match of content.matchAll(/\/([A-Za-z0-9_.-]+)\s+Do\b/g)) usedNames.add(match[1]);
    });
    for (const [name, objectNumber] of xObjects) {
      if (usedNames.size && !usedNames.has(name)) continue;
      const pageNumbers = pageMap.get(objectNumber) || [];
      pageNumbers.push(index + 1);
      pageMap.set(objectNumber, pageNumbers);
    }
  });
  return pageMap;
}

let crcTable = null;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const value of buffer) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([size, name, data, checksum]);
}

function paethPredictor(left, up, upperLeft) {
  const prediction = left + up - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  return leftDistance <= upDistance && leftDistance <= upperLeftDistance ? left : upDistance <= upperLeftDistance ? up : upperLeft;
}

function undoPngPredictor(data, rowBytes, rows, bytesPerPixel, predictor) {
  const hasRowFilter = data.length >= (rowBytes + 1) * rows;
  const output = Buffer.alloc(rowBytes * rows);
  let cursor = 0;
  for (let row = 0; row < rows; row += 1) {
    const filter = hasRowFilter ? data[cursor++] : Math.max(0, Math.min(4, predictor - 10));
    const previousOffset = (row - 1) * rowBytes;
    const outputOffset = row * rowBytes;
    for (let column = 0; column < rowBytes; column += 1) {
      const raw = data[cursor++] ?? 0;
      const left = column >= bytesPerPixel ? output[outputOffset + column - bytesPerPixel] : 0;
      const up = row > 0 ? output[previousOffset + column] : 0;
      const upperLeft = row > 0 && column >= bytesPerPixel ? output[previousOffset + column - bytesPerPixel] : 0;
      const value = filter === 1 ? raw + left : filter === 2 ? raw + up : filter === 3 ? raw + Math.floor((left + up) / 2) : filter === 4 ? raw + paethPredictor(left, up, upperLeft) : raw;
      output[outputOffset + column] = value & 0xff;
    }
  }
  return output;
}

function encodePng(raw, { width, height, colors, bitsPerComponent = 8, predictor = 1 } = {}) {
  if (![1, 2, 3, 4].includes(colors) || bitsPerComponent !== 8 || width < 1 || height < 1) return null;
  const rowBytes = width * colors;
  let pixels = raw;
  if (predictor >= 10) pixels = undoPngPredictor(raw, rowBytes, height, colors, predictor);
  if (pixels.length < rowBytes * height) return null;
  const scanlines = Buffer.alloc((rowBytes + 1) * height);
  for (let row = 0; row < height; row += 1) pixels.copy(scanlines, row * (rowBytes + 1) + 1, row * rowBytes, (row + 1) * rowBytes);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = bitsPerComponent;
  header[9] = colors === 1 ? 0 : colors === 2 ? 4 : colors === 3 ? 2 : 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function extractPdfImages(buffer, sourceName = "document.pdf") {
  const objects = pdfObjects(buffer);
  const pageMap = pdfImagePageMap(objects);
  const images = [];
  const baseName = String(sourceName || "document.pdf").replace(/\.pdf$/i, "") || "document";
  for (const object of objects) {
    if (images.length >= MAX_PDF_EMBEDDED_IMAGES || !object.stream || !/\/Subtype\s*\/Image\b/i.test(object.dictionary)) continue;
    const width = Number(object.dictionary.match(/\/Width\s+(\d+)/i)?.[1] || 0);
    const height = Number(object.dictionary.match(/\/Height\s+(\d+)/i)?.[1] || 0);
    const bitsPerComponent = Number(object.dictionary.match(/\/BitsPerComponent\s+(\d+)/i)?.[1] || 8);
    const colorSpace = object.dictionary.match(/\/ColorSpace\s*\/?([A-Za-z0-9]+)/i)?.[1] || "DeviceRGB";
    const filters = pdfFilters(object.dictionary);
    let data = Buffer.from(object.stream);
    let mimeType = "application/octet-stream";
    let extension = "bin";
    try {
      for (const filter of filters) {
        if (["ASCIIHexDecode", "AHx"].includes(filter)) data = decodeAsciiHex(data);
        else if (["ASCII85Decode", "A85"].includes(filter)) data = decodeAscii85(data);
        else if (["DCTDecode", "DCT"].includes(filter)) { mimeType = "image/jpeg"; extension = "jpg"; break; }
        else if (filter === "JPXDecode") { mimeType = "image/jp2"; extension = "jp2"; break; }
        else if (["FlateDecode", "Fl"].includes(filter)) {
          data = inflatePdfStream(data);
          const predictor = Number(object.dictionary.match(/\/Predictor\s+(\d+)/i)?.[1] || 1);
          const colorsFromParms = Number(object.dictionary.match(/\/Colors\s+(\d+)/i)?.[1] || 0);
          const colors = colorsFromParms || (colorSpace === "DeviceGray" ? 1 : colorSpace === "DeviceRGB" ? 3 : 0);
          const png = encodePng(data, { width, height, colors, bitsPerComponent, predictor });
          if (!png) { data = Buffer.alloc(0); break; }
          data = png; mimeType = "image/png"; extension = "png";
        } else { data = Buffer.alloc(0); break; }
      }
    } catch { data = Buffer.alloc(0); }
    if (!data.length || !mimeType.startsWith("image/")) continue;
    const pages = pageMap.get(object.number) || [];
    const pageNumber = pages[0] || null;
    const ordinal = images.length + 1;
    images.push({
      buffer: data,
      mimeType,
      sourceName: `${baseName}${pageNumber ? `-p${pageNumber}` : ""}-image-${ordinal}.${extension}`,
      altText: `${baseName}${pageNumber ? ` 第 ${pageNumber} 页` : ""}图片`,
      metadata: { derivedFrom: "pdf", sourcePdfName: sourceName, pageNumber, pageNumbers: pages, pdfObjectNumber: object.number, width, height, bitsPerComponent, colorSpace, filters }
    });
  }
  const pageCount = objects.filter((object) => /\/Type\s*\/Page\b/i.test(object.dictionary) && !/\/Type\s*\/Pages\b/i.test(object.dictionary)).length;
  return { images, pageCount };
}

export function parseKnowledgePdf(buffer, { sourceName = "document.pdf" } = {}) {
  let content = "";
  try { content = parsePdf(buffer); } catch (error) {
    if (!(error instanceof KnowledgeError) || error.code !== "KNOWLEDGE_FILE_OCR_REQUIRED") throw error;
  }
  const extracted = extractPdfImages(buffer, sourceName);
  return { content, images: extracted.images, pageCount: extracted.pageCount };
}

export function inferDocumentFormat(mimeType = "", sourceName = "") {
  const mime = String(mimeType || "").toLowerCase().split(";", 1)[0].trim();
  const extension = String(sourceName || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"].includes(extension)) return "image";
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (mime.includes("wordprocessingml") || mime === "application/msword" || ["docx", "doc"].includes(extension)) return "docx";
  if (mime.includes("spreadsheetml") || mime === "application/vnd.ms-excel" || ["xlsx", "xls"].includes(extension)) return "xlsx";
  if (mime === "text/html" || ["html", "htm"].includes(extension)) return "html";
  if (mime === "text/markdown" || ["md", "markdown"].includes(extension)) return "markdown";
  if (mime === "application/json" || extension === "json") return "json";
  return "text";
}

export function parseKnowledgeFile(buffer, { mimeType = "", sourceName = "" } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new KnowledgeError("知识文件内容无效。", 422, "KNOWLEDGE_FILE_INVALID");
  if (buffer.length > MAX_DOCUMENT_BYTES) throw new KnowledgeError("知识文件超过 20 MB 限制。", 413, "KNOWLEDGE_CONTENT_TOO_LARGE");
  const format = inferDocumentFormat(mimeType, sourceName);
  if (format === "image") throw new KnowledgeError("图片知识需要通过 OCR / 多模态解析后入库。", 422, "KNOWLEDGE_FILE_OCR_REQUIRED", { mimeType, sourceName });
  if (["docx", "xlsx"].includes(format) && /\.(doc|xls)$/i.test(sourceName)) throw new KnowledgeError("仅支持 .docx / .xlsx，请将旧版 Office 文件另存为新版格式。", 422, "KNOWLEDGE_FILE_UNSUPPORTED");
  let parsed;
  if (format === "pdf") parsed = parsePdf(buffer);
  else if (format === "docx") parsed = parseDocx(buffer);
  else if (format === "xlsx") parsed = parseXlsx(buffer);
  else {
    parsed = buffer.toString("utf8");
    if (format === "html") parsed = htmlToText(parsed);
    else if (format === "markdown") parsed = markdownToText(parsed);
  }
  return normalizeContent(parsed);
}

function decodeContent(body = {}) {
  if (body.content !== undefined && body.content !== null) return normalizeContent(body.content);
  const encoded = String(body.contentBase64 || "").trim();
  if (!encoded) throw new KnowledgeError("请提供 content 或 contentBase64。", 422, "KNOWLEDGE_CONTENT_REQUIRED");
  return parseKnowledgeFile(decodeBase64(encoded), { mimeType: body.mimeType, sourceName: body.sourceName });
}

function tokenise(value) {
  const source = String(value || "").toLocaleLowerCase("zh-CN");
  const tokens = [];
  const latin = source.match(/[a-z0-9][a-z0-9._+-]*/g) || [];
  tokens.push(...latin);
  const cjk = [...source].filter((char) => /[\u3400-\u9fff]/u.test(char));
  tokens.push(...cjk);
  for (let index = 0; index + 1 < cjk.length; index += 1) tokens.push(cjk[index] + cjk[index + 1]);
  return tokens;
}

function hash32(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function localEmbedding(value, dimensions = LOCAL_EMBEDDING_DIMENSIONS) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenise(value);
  tokens.forEach((token, index) => {
    const hash = hash32(token);
    const bucket = hash % dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    const weight = 1 / Math.sqrt(1 + index);
    vector[bucket] += sign * weight;
    if (token.length > 2) vector[(bucket + 17) % dimensions] += sign * weight * 0.35;
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm ? vector.map((value) => value / norm) : vector;
}

function lexicalScore(query, content) {
  const queryTokens = tokenise(query);
  if (!queryTokens.length) return 0;
  const contentTokens = new Set(tokenise(content));
  const hits = queryTokens.reduce((sum, token) => sum + (contentTokens.has(token) ? 1 : 0), 0);
  return Math.min(1, hits / Math.max(1, new Set(queryTokens).size));
}

function cosine(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]) || 0;
    const b = Number(right[index]) || 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return leftNorm && rightNorm ? Math.max(0, dot / Math.sqrt(leftNorm * rightNorm)) : 0;
}

function headingFor(block) {
  const first = String(block || "").split("\n", 1)[0].trim();
  if (/^#{1,6}\s+/.test(first)) return first.replace(/^#{1,6}\s+/, "").slice(0, 200);
  if (first.length <= 80 && /[：:]$/.test(first)) return first.slice(0, 200);
  return "";
}

export function chunkKnowledgeText(content, options = {}) {
  const maxChars = Math.max(400, Math.min(4_000, Number(options.maxChars) || DEFAULT_CHUNK_CHARS));
  const overlap = Math.max(0, Math.min(Math.floor(maxChars / 3), Number(options.overlap) || DEFAULT_CHUNK_OVERLAP));
  const paragraphs = normalizeContent(content).split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  const push = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    const previous = chunks.at(-1)?.contentText || "";
    chunks.push({
      ordinal: chunks.length,
      heading: headingFor(trimmed),
      contentText: trimmed,
      locator: `第 ${chunks.length + 1} 个知识片段`,
      tokenCount: tokenise(trimmed).length,
      overlapFromPrevious: previous ? previous.slice(Math.max(0, previous.length - overlap)) : ""
    });
  };
  const splitLong = (value) => {
    let cursor = 0;
    while (cursor < value.length) {
      const end = Math.min(value.length, cursor + maxChars);
      push(value.slice(cursor, end));
      if (end >= value.length) break;
      cursor = Math.max(cursor + 1, end - overlap);
    }
  };
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) { push(current); current = ""; }
      splitLong(paragraph);
      continue;
    }
    if (!current) current = paragraph;
    else if ((current.length + paragraph.length + 2) <= maxChars) current += `\n\n${paragraph}`;
    else { push(current); current = paragraph; }
  }
  if (current) push(current);
  return chunks;
}

function endpoint(baseUrl, suffix) {
  const parsed = new URL(String(baseUrl || ""));
  let pathname = parsed.pathname.replace(/\/+$/, "");
  if (!pathname.endsWith(suffix)) pathname += pathname.endsWith("/v1") ? suffix : `/v1${suffix}`;
  parsed.pathname = pathname;
  parsed.search = "";
  return parsed.toString();
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
    if (!response.ok) throw new KnowledgeError(`Embedding 服务返回 HTTP ${response.status}。`, 502, "EMBEDDING_PROVIDER_ERROR", { providerStatus: response.status, body: String(body?.message || body?.error || "").slice(0, 300) });
    return body;
  } catch (error) {
    if (error instanceof KnowledgeError) throw error;
    throw new KnowledgeError("Embedding 服务请求失败。", 502, "EMBEDDING_PROVIDER_UNAVAILABLE", { cause: error.message });
  } finally {
    clearTimeout(timer);
  }
}

export class KnowledgeStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("KnowledgeStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.workspaceId = String(options.workspaceId || DEFAULT_WORKSPACE_ID);
    this.embeddingTimeoutMs = Math.max(1_000, Math.min(120_000, Number(options.embeddingTimeoutMs || process.env.TZ_EMBEDDING_TIMEOUT_MS) || 30_000));
    this.localEmbeddingDimensions = LOCAL_EMBEDDING_DIMENSIONS;
    this.vectorStore = options.vectorStore || createVectorStore(options.vectorStoreOptions || {});
    this.vectorStoreRequired = String(options.vectorStoreRequired ?? process.env.TZ_VECTOR_STORE_REQUIRED ?? "0") === "1";
    this.ocrEndpoint = String(options.ocrEndpoint || process.env.TZ_OCR_ENDPOINT || "").trim().replace(/\/+$/, "");
    this.ocrApiKey = String(options.ocrApiKey || process.env.TZ_OCR_API_KEY || "").trim();
    this.ocrTimeoutMs = Math.max(5_000, Math.min(180_000, Number(options.ocrTimeoutMs || process.env.TZ_OCR_TIMEOUT_MS) || 60_000));
    this.ocrFetchImpl = options.ocrFetchImpl || globalThis.fetch;
    this.asyncIndexAll = String(options.asyncIndexAll ?? process.env.TZ_KNOWLEDGE_ASYNC_INDEX ?? "0") === "1";
    this.asyncIndexChars = Math.max(20_000, Math.min(2_000_000, Number(options.asyncIndexChars || process.env.TZ_KNOWLEDGE_ASYNC_INDEX_CHARS) || 100_000));
    this.assetRoot = path.resolve(options.assetRoot || process.env.TZ_KNOWLEDGE_ASSET_ROOT || path.join(path.dirname(database.databasePath), "knowledge-assets"));
    mkdirSync(this.assetRoot, { recursive: true });
  }

  assetStoragePath(storageKey) {
    const target = path.resolve(this.assetRoot, String(storageKey || ""));
    const relative = path.relative(this.assetRoot, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new KnowledgeError("知识资产存储路径无效。", 500, "KNOWLEDGE_ASSET_STORAGE_INVALID");
    return target;
  }

  persistAssetBuffer(buffer, contentHash) {
    const storageKey = `${contentHash.slice(0, 2)}/${contentHash.slice(2, 4)}/${contentHash}`;
    const target = this.assetStoragePath(storageKey);
    if (!existsSync(target)) {
      mkdirSync(path.dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
      writeFileSync(temporary, buffer, { mode: 0o600 });
      try { renameSync(temporary, target); } catch (error) {
        if (!existsSync(target)) throw error;
      }
    }
    return storageKey;
  }

  assetBuffer(row) {
    if (row?.storage_key) {
      const target = this.assetStoragePath(row.storage_key);
      if (existsSync(target)) return readFileSync(target);
    }
    const legacy = Buffer.from(row?.data_base64 || "", "base64");
    if (legacy.length) {
      const contentHash = row?.content_hash || crypto.createHash("sha256").update(legacy).digest("hex");
      const storageKey = this.persistAssetBuffer(legacy, contentHash);
      if (row?.id) this.connection.prepare("UPDATE knowledge_assets SET storage_key = ?, data_base64 = '' WHERE id = ? AND storage_key = ''").run(storageKey, row.id);
      return legacy;
    }
    throw new KnowledgeError("知识资产原文件不存在。", 404, "KNOWLEDGE_ASSET_CONTENT_MISSING");
  }

  async callOcr(buffer, { mimeType = "application/octet-stream", sourceName = "" } = {}) {
    if (!this.ocrEndpoint) throw new KnowledgeError("尚未配置 OCR 服务。", 409, "KNOWLEDGE_OCR_NOT_CONFIGURED");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.ocrTimeoutMs);
    try {
      const headers = { "Content-Type": "application/json", Accept: "application/json" };
      if (this.ocrApiKey) headers.Authorization = `Bearer ${this.ocrApiKey}`;
      const response = await this.ocrFetchImpl(this.ocrEndpoint, { method: "POST", headers, body: JSON.stringify({ contentBase64: buffer.toString("base64"), mimeType, sourceName }), signal: controller.signal });
      const raw = await response.text();
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { throw new KnowledgeError("OCR 服务返回了无效 JSON。", 502, "KNOWLEDGE_OCR_INVALID_RESPONSE"); }
      if (!response.ok) throw new KnowledgeError(body.message || body.error || `OCR HTTP ${response.status}`, 502, "KNOWLEDGE_OCR_HTTP_ERROR");
      const resultText = normalizeContent(body.text || body.content || body.result?.text || "");
      return { text: resultText, provider: body.provider || "configured", confidence: Number(body.confidence ?? body.result?.confidence) || null, blocks: Array.isArray(body.blocks) ? body.blocks : [], metadata: body.metadata || {} };
    } catch (error) {
      if (error instanceof KnowledgeError) throw error;
      if (error?.name === "AbortError") throw new KnowledgeError("OCR 处理超时。", 504, "KNOWLEDGE_OCR_TIMEOUT");
      throw new KnowledgeError(error?.message || "OCR 服务连接失败。", 502, "KNOWLEDGE_OCR_CONNECTION_ERROR");
    } finally { clearTimeout(timer); }
  }

  async decodeIncoming({ content, contentBase64, mimeType = "text/plain", sourceName = "" } = {}) {
    const providedContent = content !== undefined && content !== null && String(content).trim() ? normalizeContent(content) : "";
    const encoded = String(contentBase64 || "").trim();
    if (!encoded) {
      if (!providedContent) throw new KnowledgeError("请提供文字内容或上传文件。", 422, "KNOWLEDGE_CONTENT_REQUIRED");
      return { content: providedContent, extractionStatus: "complete", extractionMethod: "text", buffer: null, ocr: null, embeddedAssets: [] };
    }
    const buffer = decodeBase64(contentBase64);
    const format = inferDocumentFormat(mimeType, sourceName);
    if (format === "pdf") {
      const pdf = parseKnowledgePdf(buffer, { sourceName });
      if (providedContent || pdf.content) {
        return {
          content: providedContent || normalizeContent(pdf.content),
          extractionStatus: "complete",
          extractionMethod: "pdf",
          buffer,
          ocr: null,
          embeddedAssets: pdf.images,
          extractionMetadata: { pageCount: pdf.pageCount, embeddedImageCount: pdf.images.length }
        };
      }
      if (!this.ocrEndpoint) {
        throw new KnowledgeError(
          "PDF 没有可提取文字，且系统尚未配置 OCR。请先配置 TZ_OCR_ENDPOINT，再重新上传。",
          409,
          "KNOWLEDGE_OCR_NOT_CONFIGURED",
          { sourceName, mimeType, format: "pdf", scannedDocument: true }
        );
      }
      return {
        content: `PDF 资料正在提取文字：${sourceName || "未命名 PDF"}`,
        extractionStatus: "queued",
        extractionMethod: "ocr",
        buffer,
        ocr: null,
        embeddedAssets: pdf.images,
        extractionMetadata: { pageCount: pdf.pageCount, embeddedImageCount: pdf.images.length, scannedDocument: true }
      };
    }
    if (format === "image") {
      if (!providedContent && !this.ocrEndpoint) {
        throw new KnowledgeError(
          "图片没有随附文字说明，且系统尚未配置 OCR。请配置 TZ_OCR_ENDPOINT 或填写资料正文。",
          409,
          "KNOWLEDGE_OCR_NOT_CONFIGURED",
          { sourceName, mimeType, format: "image" }
        );
      }
      return {
        content: providedContent || `图片资料正在识别：${sourceName || "未命名图片"}`,
        extractionStatus: providedContent ? "complete" : "queued",
        extractionMethod: providedContent ? "description" : "ocr",
        buffer,
        ocr: null,
        embeddedAssets: []
      };
    }
    if (providedContent) return { content: providedContent, extractionStatus: "complete", extractionMethod: "provided_text", buffer, ocr: null, embeddedAssets: [] };
    try {
      return { content: parseKnowledgeFile(buffer, { mimeType, sourceName }), extractionStatus: "complete", extractionMethod: inferDocumentFormat(mimeType, sourceName), buffer, ocr: null };
    } catch (error) {
      if (!(error instanceof KnowledgeError) || error.code !== "KNOWLEDGE_FILE_OCR_REQUIRED") throw error;
      if (!this.ocrEndpoint) {
        throw new KnowledgeError(
          "该文件必须经过 OCR 才能入库，但系统尚未配置 OCR。请先配置 TZ_OCR_ENDPOINT，再重新上传。",
          409,
          "KNOWLEDGE_OCR_NOT_CONFIGURED",
          { sourceName, mimeType, format }
        );
      }
      const ocr = await this.callOcr(buffer, { mimeType, sourceName });
      return { content: ocr.text, extractionStatus: "complete", extractionMethod: "ocr", buffer, ocr };
    }
  }

  insertAsset({ workspaceId = this.workspaceId, libraryId = null, documentId = null, versionId = null, assetType = "file", sourceName = "", mimeType = "application/octet-stream", buffer, extractedText = "", altText = "", ocrStatus = "not_required", reviewStatus = "approved", metadata = {}, actor = null, timestamp = now() } = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new KnowledgeError("知识资产文件不能为空。", 422, "KNOWLEDGE_ASSET_REQUIRED");
    if (buffer.length > MAX_DOCUMENT_BYTES) throw new KnowledgeError("知识资产超过 20 MB 限制。", 413, "KNOWLEDGE_CONTENT_TOO_LARGE");
    const assetId = id("KASSET");
    const persistedHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const storageKey = this.persistAssetBuffer(buffer, persistedHash);
    const normalizedReviewStatus = reviewStatus === "archived" ? "archived" : "approved";
    const normalizedOcrStatus = ["not_required", "queued", "processing", "succeeded", "failed"].includes(ocrStatus) ? ocrStatus : "not_required";
    ocrStatus = normalizedOcrStatus;
    reviewStatus = normalizedReviewStatus;
    this.connection.prepare(`
      INSERT INTO knowledge_assets (id, workspace_id, library_id, document_id, version_id, asset_type, source_name, mime_type, content_hash, data_base64, storage_key, extracted_text, alt_text, ocr_status, review_status, metadata_json, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(assetId, workspaceId, libraryId || null, documentId || null, versionId || null, ["image", "table", "file", "attachment"].includes(assetType) ? assetType : "file", text(sourceName, "资产名称", 500), text(mimeType, "MIME 类型", 120) || "application/octet-stream", persistedHash, storageKey, String(extractedText || "").slice(0, MAX_DOCUMENT_CHARS), text(altText, "图片说明", 2_000), ocrStatus, reviewStatus, JSON.stringify(metadata || {}), timestamp, timestamp, actor?.userId || null);
    return assetId;
  }

  insertOcrJob({ workspaceId = this.workspaceId, versionId = null, assetId, buffer, provider = "configured", status = "queued", resultText = "", result = {}, actor = null, timestamp = now() } = {}) {
    const jobId = id("KOCR");
    this.connection.prepare(`
      INSERT INTO knowledge_ocr_jobs (id, workspace_id, version_id, asset_id, provider, status, attempts, max_attempts, input_hash, result_text, result_json, created_at, started_at, completed_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 3, ?, ?, ?, ?, ?, ?, ?)
    `).run(jobId, workspaceId, versionId || null, assetId, provider, status, status === "succeeded" ? 1 : 0, crypto.createHash("sha256").update(buffer).digest("hex"), resultText, JSON.stringify(result || {}), timestamp, status === "succeeded" ? timestamp : null, status === "succeeded" ? timestamp : null, actor?.userId || null);
    return jobId;
  }

  insertImageDocumentShell({ workspaceId = this.workspaceId, libraryId, sourceName = "", mimeType = "application/octet-stream", altText = "", extractedText = "", requiresOcr = Boolean(this.ocrEndpoint), metadata = {}, actor = null, timestamp = now() } = {}) {
    if (!libraryId) return null;
    this.library(workspaceId, libraryId);
    const documentId = id("KD");
    const versionId = id("KV");
    const title = text(String(sourceName || altText || "企业图片资料").replace(/\.[^.]+$/, ""), "图片资料标题", 300, true);
    const description = normalizeContent(extractedText || altText || title);
    const content = requiresOcr ? `图片 OCR 待处理：${sourceName || title}` : description;
    const contentHash = sha256(content);
    const documentMetadata = {
      ...(metadataObject(metadata)),
      visibility: knowledgeVisibility(metadata),
      sourceRole: metadataObject(metadata).sourceRole || "image_asset",
      imageKnowledgeDocument: true,
      ...(requiresOcr ? {} : { ocrUnavailable: true })
    };
    this.connection.prepare(`
      INSERT INTO knowledge_documents (id, library_id, title, source_type, source_name, source_url, mime_type, content_hash, metadata_json, status, created_at, updated_at, created_by)
      VALUES (?, ?, ?, 'file', ?, '', ?, ?, ?, 'active', ?, ?, ?)
    `).run(documentId, libraryId, title, text(sourceName, "图片名称", 500), text(mimeType, "MIME 类型", 120), contentHash, JSON.stringify(documentMetadata), timestamp, timestamp, actor?.userId || null);
    this.connection.prepare(`
      INSERT INTO knowledge_document_versions (id, document_id, version, content_text, content_hash, metadata_json, review_status, index_status, extraction_status, extraction_method, approved_at, approved_by, created_at, updated_at, created_by)
      VALUES (?, ?, 1, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(versionId, documentId, content, contentHash, JSON.stringify(documentMetadata), requiresOcr ? "not_indexed" : "queued", requiresOcr ? "queued" : "complete", requiresOcr ? "ocr" : "description", timestamp, actor?.userId || null, timestamp, timestamp, actor?.userId || null);
    if (!requiresOcr) {
      this.connection.prepare("INSERT INTO knowledge_index_jobs (id, version_id, job_type, status, attempts, created_at, created_by) VALUES (?, ?, 'index', 'queued', 0, ?, ?)").run(id("KJOB"), versionId, timestamp, actor?.userId || null);
    }
    return { documentId, versionId, requiresOcr };
  }

  libraryRow(row) {
    if (!row) return null;
    const counts = this.connection.prepare(`
      SELECT COUNT(DISTINCT d.id) AS documents,
             COUNT(DISTINCT CASE WHEN v.review_status = 'approved' THEN v.id END) AS approved_versions,
             COUNT(DISTINCT CASE WHEN v.index_status = 'indexed' THEN v.id END) AS indexed_versions
      FROM knowledge_documents d
      LEFT JOIN knowledge_document_versions v ON v.document_id = d.id
      WHERE d.library_id = ? AND d.status = 'active'
    `).get(row.id);
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      businessLineId: row.business_line_id || null,
      name: row.name,
      kind: row.kind,
      scope: row.scope,
      description: row.description,
      status: row.status,
      documents: Number(counts?.documents || 0),
      approvedVersions: Number(counts?.approved_versions || 0),
      indexedVersions: Number(counts?.indexed_versions || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  library(workspaceId, libraryId, includeArchived = false) {
    const row = this.connection.prepare("SELECT * FROM knowledge_libraries WHERE workspace_id = ? AND id = ?").get(workspaceId, libraryId);
    if (!row || (!includeArchived && row.status === "archived")) throw new KnowledgeError("知识库不存在或已归档。", 404, "KNOWLEDGE_LIBRARY_NOT_FOUND");
    return row;
  }

  listLibraries({ workspaceId = this.workspaceId, businessLineId = "", includeArchived = false } = {}) {
    const rows = this.connection.prepare(`
      SELECT * FROM knowledge_libraries
      WHERE workspace_id = ?
        AND (? = '' OR business_line_id = ? OR scope = 'enterprise')
        AND (? = 1 OR status = 'active')
      ORDER BY updated_at DESC
    `).all(workspaceId, String(businessLineId || ""), String(businessLineId || ""), includeArchived ? 1 : 0);
    return rows.map((row) => this.libraryRow(row));
  }

  archiveLibrary({ workspaceId = this.workspaceId, libraryId, actor = null, request = null } = {}) {
    const library = this.library(workspaceId, libraryId, true);
    if (library.status === "archived") return this.libraryRow(library);
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("UPDATE knowledge_libraries SET status = 'archived', updated_at = ? WHERE workspace_id = ? AND id = ?").run(timestamp, workspaceId, libraryId);
      this.connection.prepare("UPDATE knowledge_documents SET status = 'archived', updated_at = ? WHERE library_id = ?").run(timestamp, libraryId);
      this.connection.prepare("UPDATE knowledge_assets SET review_status = 'archived', updated_at = ? WHERE workspace_id = ? AND library_id = ?").run(timestamp, workspaceId, libraryId);
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.library.archive", entityType: "knowledge_library", entityId: libraryId, details: { workspaceId }, request, createdAt: timestamp });
    });
    return this.libraryRow(this.library(workspaceId, libraryId, true));
  }

  createLibrary({ workspaceId = this.workspaceId, businessLineId = null, name, kind = "document", scope = "business_line", description = "", actor = null, request = null } = {}) {
    const normalizedName = text(name, "知识库名称", 120, true);
    const normalizedKind = ["document", "qa"].includes(kind) ? kind : "document";
    const normalizedScope = scope === "enterprise" ? "enterprise" : "business_line";
    const lineId = normalizedScope === "enterprise" ? null : text(businessLineId, "业务线", 160, true);
    const libraryId = id("KB");
    const timestamp = now();
    try {
      this.database.transaction(() => {
        this.connection.prepare(`
          INSERT INTO knowledge_libraries (id, workspace_id, business_line_id, name, kind, scope, description, status, created_at, updated_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
        `).run(libraryId, workspaceId, lineId, normalizedName, normalizedKind, normalizedScope, text(description, "知识库说明", 1_000), timestamp, timestamp, actor?.userId || null);
        appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.library.create", entityType: "knowledge_library", entityId: libraryId, details: { workspaceId, businessLineId: lineId, kind: normalizedKind, scope: normalizedScope }, request, createdAt: timestamp });
      });
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE")) throw new KnowledgeError("同名知识库已经存在。", 409, "KNOWLEDGE_LIBRARY_EXISTS");
      throw error;
    }
    return this.library(workspaceId, libraryId, true);
  }

  listDocuments({ workspaceId = this.workspaceId, libraryId, businessLineId = "", includeArchived = false, limit = 100 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(1_000, Number(limit) || 100));
    const params = [workspaceId];
    let query = `
      SELECT d.*, l.name AS library_name, l.kind AS library_kind, l.scope AS library_scope,
             l.business_line_id AS library_business_line_id,
             v.id AS latest_version_id, v.version AS latest_version, v.review_status, v.index_status, v.extraction_status, v.extraction_method, v.updated_at AS version_updated_at
      FROM knowledge_documents d
      JOIN knowledge_libraries l ON l.id = d.library_id
      LEFT JOIN knowledge_document_versions v ON v.id = (
        SELECT v2.id FROM knowledge_document_versions v2 WHERE v2.document_id = d.id ORDER BY v2.version DESC LIMIT 1
      )
      WHERE l.workspace_id = ?
    `;
    if (libraryId) { query += " AND d.library_id = ?"; params.push(libraryId); }
    if (businessLineId) { query += " AND (l.scope = 'enterprise' OR l.business_line_id = ?)"; params.push(businessLineId); }
    if (!includeArchived) query += " AND d.status = 'active' AND l.status = 'active'";
    query += " ORDER BY d.updated_at DESC LIMIT ?";
    params.push(normalizedLimit);
    return this.connection.prepare(query).all(...params).map((row) => ({
      id: row.id,
      libraryId: row.library_id,
      libraryName: row.library_name,
      libraryKind: row.library_kind,
      title: row.title,
      sourceType: row.source_type,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      mimeType: row.mime_type,
      contentHash: row.content_hash,
      visibility: knowledgeVisibility(row.metadata_json),
      metadata: metadataObject(row.metadata_json),
      status: row.status,
      latestVersionId: row.latest_version_id,
      latestVersion: Number(row.latest_version || 0),
      reviewStatus: row.review_status || null,
      indexStatus: row.index_status || null,
      extractionStatus: row.extraction_status || "complete",
      extractionMethod: row.extraction_method || "text",
      updatedAt: row.version_updated_at || row.updated_at,
      createdAt: row.created_at
    }));
  }

  archiveDocument({ workspaceId = this.workspaceId, documentId, actor = null, request = null } = {}) {
    const row = this.connection.prepare("SELECT d.id, d.library_id, l.workspace_id FROM knowledge_documents d JOIN knowledge_libraries l ON l.id = d.library_id WHERE d.id = ? AND l.workspace_id = ?").get(documentId, workspaceId);
    if (!row) throw new KnowledgeError("知识文档不存在。", 404, "KNOWLEDGE_DOCUMENT_NOT_FOUND");
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("UPDATE knowledge_documents SET status = 'archived', updated_at = ? WHERE id = ?").run(timestamp, documentId);
      this.connection.prepare("UPDATE knowledge_assets SET review_status = 'archived', updated_at = ? WHERE workspace_id = ? AND document_id = ?").run(timestamp, workspaceId, documentId);
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.document.archive", entityType: "knowledge_document", entityId: documentId, details: { workspaceId, libraryId: row.library_id }, request, createdAt: timestamp });
    });
    return this.listDocuments({ workspaceId, libraryId: row.library_id, includeArchived: true, limit: 1000 }).find((item) => item.id === documentId);
  }

  documentVersion(workspaceId, versionId) {
    const row = this.connection.prepare(`
      SELECT v.*, d.library_id, d.title, d.source_type, d.source_name, d.source_url, d.mime_type,
             l.workspace_id, l.business_line_id, l.scope, l.name AS library_name, l.kind AS library_kind
      FROM knowledge_document_versions v
      JOIN knowledge_documents d ON d.id = v.document_id
      JOIN knowledge_libraries l ON l.id = d.library_id
      WHERE l.workspace_id = ? AND v.id = ?
    `).get(workspaceId, versionId);
    if (!row) throw new KnowledgeError("知识版本不存在。", 404, "KNOWLEDGE_VERSION_NOT_FOUND");
    return row;
  }

  async createDocument({ workspaceId = this.workspaceId, libraryId, title, content, contentBase64, sourceType = "text", sourceName = "", sourceUrl = "", mimeType = "text/plain", metadata = {}, actor = null, request = null, reviewStatus = "approved" } = {}) {
    const library = this.library(workspaceId, libraryId);
    const normalizedTitle = text(title, "文档标题", 300, true);
    const extracted = await this.decodeIncoming({ content, contentBase64, mimeType, sourceName });
    const normalizedContent = extracted.content;
    const normalizedSourceType = ["text", "file", "url", "qa"].includes(sourceType) ? sourceType : (library.kind === "qa" ? "qa" : "text");
    const documentId = id("KD");
    const versionId = id("KV");
    const contentHash = sha256(normalizedContent);
    const timestamp = now();
    const documentMetadata = { ...metadataObject(metadata), visibility: knowledgeVisibility(metadata), ...(extracted.extractionMetadata ? { extraction: extracted.extractionMetadata } : {}) };
    const normalizedReviewStatus = reviewStatus === "archived" ? "archived" : "approved";
    this.database.transaction(() => {
      this.connection.prepare(`
        INSERT INTO knowledge_documents (id, library_id, title, source_type, source_name, source_url, mime_type, content_hash, metadata_json, status, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).run(documentId, libraryId, normalizedTitle, normalizedSourceType, text(sourceName, "来源名称", 500), text(sourceUrl, "来源 URL", 2_000), text(mimeType, "MIME 类型", 120), contentHash, JSON.stringify(documentMetadata), timestamp, timestamp, actor?.userId || null);
      this.connection.prepare(`
        INSERT INTO knowledge_document_versions (id, document_id, version, content_text, content_hash, metadata_json, review_status, index_status, extraction_status, extraction_method, created_at, updated_at, created_by)
        VALUES (?, ?, 1, ?, ?, ?, ?, 'not_indexed', ?, ?, ?, ?, ?)
      `).run(versionId, documentId, normalizedContent, contentHash, JSON.stringify(documentMetadata), normalizedReviewStatus, extracted.extractionStatus, extracted.extractionMethod, timestamp, timestamp, actor?.userId || null);
      if (extracted.buffer) {
        const assetType = inferDocumentFormat(mimeType, sourceName) === "image" ? "image" : "file";
        const assetId = this.insertAsset({ workspaceId, libraryId, documentId, versionId, assetType, sourceName, mimeType, buffer: extracted.buffer, extractedText: extracted.content, ocrStatus: extracted.extractionStatus === "queued" ? "queued" : "succeeded", reviewStatus: "approved", metadata: { ...metadata, sourceRole: "original", processingState: extracted.extractionStatus === "queued" ? "processing" : "available" }, actor, timestamp });
        if (extracted.extractionStatus === "queued") this.insertOcrJob({ workspaceId, versionId, assetId, buffer: extracted.buffer, actor, timestamp });
        for (const embedded of extracted.embeddedAssets || []) {
          const embeddedId = this.insertAsset({ workspaceId, libraryId, documentId, versionId, assetType: "image", sourceName: embedded.sourceName, mimeType: embedded.mimeType, buffer: embedded.buffer, extractedText: "", altText: embedded.altText, ocrStatus: this.ocrEndpoint ? "queued" : "failed", reviewStatus: "approved", metadata: { ...metadata, ...(embedded.metadata || {}), sourceRole: "pdf_embedded_image", processingState: this.ocrEndpoint ? "processing" : "failed", ...(this.ocrEndpoint ? {} : { processingErrorCode: "KNOWLEDGE_OCR_NOT_CONFIGURED" }) }, actor, timestamp });
          if (this.ocrEndpoint) this.insertOcrJob({ workspaceId, versionId, assetId: embeddedId, buffer: embedded.buffer, actor, timestamp });
        }
      }
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.document.create", entityType: "knowledge_document", entityId: documentId, details: { libraryId, versionId, contentHash, characters: normalizedContent.length, reviewStatus: normalizedReviewStatus }, request, createdAt: timestamp });
    });
    const version = this.documentVersion(workspaceId, versionId);
    if (version.review_status === "approved" && version.extraction_status === "complete") return await this.activateVersion({ workspaceId, versionId, actor, request });
    return version;
  }

  async createVersion({ workspaceId = this.workspaceId, documentId, title = "", content, contentBase64, sourceName, sourceUrl, mimeType = "", metadata = {}, actor = null, request = null } = {}) {
    const document = this.connection.prepare(`
      SELECT d.*, l.workspace_id FROM knowledge_documents d JOIN knowledge_libraries l ON l.id = d.library_id
      WHERE d.id = ? AND l.workspace_id = ? AND d.status = 'active'
    `).get(documentId, workspaceId);
    if (!document) throw new KnowledgeError("知识文档不存在或已归档。", 404, "KNOWLEDGE_DOCUMENT_NOT_FOUND");
    const effectiveMimeType = mimeType || document.mime_type;
    const effectiveSourceName = sourceName || document.source_name;
    const extracted = await this.decodeIncoming({ content, contentBase64, mimeType: effectiveMimeType, sourceName: effectiveSourceName });
    const normalizedContent = extracted.content;
    const latest = this.connection.prepare("SELECT MAX(version) AS version FROM knowledge_document_versions WHERE document_id = ?").get(documentId);
    const version = Number(latest?.version || 0) + 1;
    const versionId = id("KV");
    const contentHash = sha256(normalizedContent);
    const timestamp = now();
    const mergedMetadata = { ...metadataObject(document.metadata_json), ...metadataObject(metadata) };
    const versionMetadata = { ...mergedMetadata, visibility: knowledgeVisibility(mergedMetadata), ...(extracted.extractionMetadata ? { extraction: extracted.extractionMetadata } : {}) };
    const nextTitle = title ? text(title, "文档标题", 300, true) : document.title;
    this.database.transaction(() => {
      this.connection.prepare("UPDATE knowledge_documents SET title = ?, content_hash = ?, source_name = COALESCE(NULLIF(?, ''), source_name), source_url = COALESCE(NULLIF(?, ''), source_url), mime_type = COALESCE(NULLIF(?, ''), mime_type), metadata_json = ?, updated_at = ? WHERE id = ?").run(nextTitle, contentHash, text(sourceName, "来源名称", 500), text(sourceUrl, "来源 URL", 2_000), text(mimeType, "MIME 类型", 120), JSON.stringify(versionMetadata), timestamp, documentId);
      this.connection.prepare(`
        INSERT INTO knowledge_document_versions (id, document_id, version, content_text, content_hash, metadata_json, review_status, index_status, extraction_status, extraction_method, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'approved', 'not_indexed', ?, ?, ?, ?, ?)
      `).run(versionId, documentId, version, normalizedContent, contentHash, JSON.stringify(versionMetadata), extracted.extractionStatus, extracted.extractionMethod, timestamp, timestamp, actor?.userId || null);
      if (extracted.buffer) {
        const assetType = inferDocumentFormat(effectiveMimeType, effectiveSourceName) === "image" ? "image" : "file";
        const assetId = this.insertAsset({ workspaceId, libraryId: document.library_id, documentId, versionId, assetType, sourceName: effectiveSourceName, mimeType: effectiveMimeType, buffer: extracted.buffer, extractedText: extracted.content, ocrStatus: extracted.extractionStatus === "queued" ? "queued" : "succeeded", reviewStatus: "approved", metadata: { ...metadata, sourceRole: "original", processingState: extracted.extractionStatus === "queued" ? "processing" : "available" }, actor, timestamp });
        if (extracted.extractionStatus === "queued") this.insertOcrJob({ workspaceId, versionId, assetId, buffer: extracted.buffer, actor, timestamp });
        for (const embedded of extracted.embeddedAssets || []) {
          const embeddedId = this.insertAsset({ workspaceId, libraryId: document.library_id, documentId, versionId, assetType: "image", sourceName: embedded.sourceName, mimeType: embedded.mimeType, buffer: embedded.buffer, extractedText: "", altText: embedded.altText, ocrStatus: this.ocrEndpoint ? "queued" : "failed", reviewStatus: "approved", metadata: { ...metadata, ...(embedded.metadata || {}), sourceRole: "pdf_embedded_image", processingState: this.ocrEndpoint ? "processing" : "failed", ...(this.ocrEndpoint ? {} : { processingErrorCode: "KNOWLEDGE_OCR_NOT_CONFIGURED" }) }, actor, timestamp });
          if (this.ocrEndpoint) this.insertOcrJob({ workspaceId, versionId, assetId: embeddedId, buffer: embedded.buffer, actor, timestamp });
        }
      }
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.document.version.create", entityType: "knowledge_document_version", entityId: versionId, details: { documentId, version, contentHash, characters: normalizedContent.length }, request, createdAt: timestamp });
    });
    const versionResult = this.documentVersion(workspaceId, versionId);
    if (versionResult.review_status === "approved" && versionResult.extraction_status === "complete") return await this.activateVersion({ workspaceId, versionId, actor, request });
    return versionResult;
  }

  /**
   * Import the existing browser workspace knowledge model into the server
   * knowledge tables.  This keeps the current UI backward-compatible while
   * making approved items available to the real index/retrieval pipeline.
   */
  async syncWorkspaceState(state, actor = null, request = null, workspaceId = this.workspaceId) {
    const bases = Array.isArray(state?.knowledgeBases) ? state.knowledgeBases : [];
    const items = Array.isArray(state?.knowledgeItems) ? state.knowledgeItems : [];
    const versions = Array.isArray(state?.knowledgeVersions) ? state.knowledgeVersions : [];
    if (!bases.length || !items.length) return { libraries: 0, documents: 0, indexed: 0 };
    const timestamp = now();
    const indexedVersionIds = [];
    this.database.transaction(() => {
      const insertLibrary = this.connection.prepare(`
        INSERT OR IGNORE INTO knowledge_libraries (id, workspace_id, business_line_id, name, kind, scope, description, status, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `);
      const updateLibrary = this.connection.prepare(`
        UPDATE knowledge_libraries SET business_line_id = ?, name = ?, kind = ?, scope = ?, description = ?, status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?
      `);
      bases.forEach((base) => {
        const baseId = text(base?.id, "知识库 ID", 160, true);
        const kind = base?.kind === "qa" ? "qa" : "document";
        const scope = base?.scope === "enterprise" ? "enterprise" : "business_line";
        const status = base?.status === "archived" ? "archived" : "active";
        const lineId = scope === "enterprise" ? null : text(base?.businessLineId, "业务线", 160);
        const name = text(base?.name, "知识库名称", 120, true);
        insertLibrary.run(baseId, workspaceId, lineId || null, name, kind, scope, text(base?.description, "知识库说明", 1_000), timestamp, timestamp, actor?.userId || null);
        updateLibrary.run(lineId || null, name, kind, scope, text(base?.description, "知识库说明", 1_000), status, timestamp, baseId, workspaceId);
      });
      const libraryIds = new Set(bases.map((base) => String(base?.id || "")));
      const findVersion = this.connection.prepare("SELECT id, content_hash, review_status, index_status FROM knowledge_document_versions WHERE document_id = ? AND version = ?");
      const activateImportedVersion = this.connection.prepare("UPDATE knowledge_document_versions SET review_status = 'approved', approved_at = COALESCE(approved_at, ?), approved_by = COALESCE(approved_by, ?), updated_at = ? WHERE id = ?");
      const insertDocument = this.connection.prepare(`
        INSERT OR IGNORE INTO knowledge_documents (id, library_id, title, source_type, source_name, source_url, mime_type, content_hash, metadata_json, status, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertVersion = this.connection.prepare(`
        INSERT OR IGNORE INTO knowledge_document_versions (id, document_id, version, content_text, content_hash, metadata_json, review_status, index_status, approved_at, approved_by, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'not_indexed', ?, ?, ?, ?, ?)
      `);
      items.forEach((item) => {
        const libraryId = String(item?.knowledgeBaseId || "");
        if (!libraryIds.has(libraryId)) return;
        const base = bases.find((candidate) => String(candidate?.id || "") === libraryId);
        const latest = versions.find((candidate) => candidate.id === item.latestVersionId) || versions.find((candidate) => candidate.itemId === item.id) || null;
        const rawContent = String(latest?.content || item.content || "").trim();
        if (!rawContent) return;
        const content = normalizeContent(rawContent);
        const versionNumber = Math.max(1, Number(latest?.version) || 1);
        const documentId = text(item.id, "知识文档 ID", 160, true);
        const versionId = text(latest?.id || `${documentId}-V${versionNumber}`, "知识版本 ID", 180, true);
        const contentHash = sha256(content);
        const extractionReady = !["queued", "processing", "pending", "pending_ocr"].includes(String(latest?.extractionStatus || item?.importStatus || "complete").toLowerCase());
        const approved = item.status !== "archived" && extractionReady;
        const metadata = { ...(latest?.metadata || {}), visibility: item.visibility || latest?.visibility || "public", source: item.sourceName || latest?.sourceName || "" };
        insertDocument.run(documentId, libraryId, text(item.title || item.question || base?.name || "企业知识", "知识标题", 300, true), base?.kind === "qa" ? "qa" : "text", text(item.sourceName || latest?.sourceName, "来源名称", 500), text(item.url || latest?.url, "来源 URL", 2_000), "text/plain", contentHash, JSON.stringify(metadata), item.status === "archived" ? "archived" : "active", timestamp, timestamp, actor?.userId || null);
        const existing = findVersion.get(documentId, versionNumber);
        if (!existing) {
          insertVersion.run(versionId, documentId, versionNumber, content, contentHash, JSON.stringify(metadata), approved ? "approved" : "pending", approved ? timestamp : null, approved ? actor?.userId || null : null, timestamp, timestamp, actor?.userId || null);
          if (approved) indexedVersionIds.push(versionId);
        } else if (approved && existing.index_status !== "indexed") {
          if (existing.review_status !== "approved") activateImportedVersion.run(timestamp, actor?.userId || null, timestamp, existing.id);
          indexedVersionIds.push(existing.id);
        }
      });
    });
    let indexed = 0;
    for (const versionId of indexedVersionIds) {
      const existingJob = this.connection.prepare("SELECT id FROM knowledge_index_jobs WHERE version_id = ? AND status IN ('queued', 'running', 'succeeded') ORDER BY created_at DESC LIMIT 1").get(versionId);
      if (!existingJob) {
        const jobId = id("KJOB");
        this.connection.prepare("INSERT INTO knowledge_index_jobs (id, version_id, job_type, status, attempts, created_at, created_by) VALUES (?, ?, 'index', 'queued', 0, ?, ?)").run(jobId, versionId, timestamp, actor?.userId || null);
        await this.indexVersion({ workspaceId, versionId, jobId, actor, request });
        indexed += 1;
      }
    }
    return { libraries: bases.length, documents: items.length, indexed };
  }

  listAssets({ workspaceId = this.workspaceId, libraryId = "", documentId = "", versionId = "", reviewStatus = "", includeData = false, limit = 100 } = {}) {
    const params = [workspaceId]; let query = "SELECT * FROM knowledge_assets WHERE workspace_id = ? AND review_status <> 'archived'";
    if (libraryId) { query += " AND library_id = ?"; params.push(libraryId); }
    if (documentId) { query += " AND document_id = ?"; params.push(documentId); }
    if (versionId) { query += " AND version_id = ?"; params.push(versionId); }
    if (reviewStatus) { query += " AND review_status = ?"; params.push(reviewStatus); }
    query += " ORDER BY updated_at DESC LIMIT ?"; params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(query).all(...params).map((row) => ({
      id: row.id, workspaceId: row.workspace_id, libraryId: row.library_id || null, documentId: row.document_id || null, versionId: row.version_id || null, assetType: row.asset_type, sourceName: row.source_name, mimeType: row.mime_type, contentHash: row.content_hash, dataBase64: includeData ? this.assetBuffer(row).toString("base64") : undefined, extractedText: row.extracted_text, altText: row.alt_text, ocrStatus: row.ocr_status, reviewStatus: row.review_status, metadata: json(row.metadata_json), createdAt: row.created_at, updatedAt: row.updated_at
    }));
  }

  archiveAsset({ workspaceId = this.workspaceId, assetId, actor = null, request = null } = {}) {
    const row = this.connection.prepare("SELECT id FROM knowledge_assets WHERE workspace_id = ? AND id = ?").get(workspaceId, assetId);
    if (!row) throw new KnowledgeError("图片或文件不存在。", 404, "KNOWLEDGE_ASSET_NOT_FOUND");
    const timestamp = now();
    this.connection.prepare("UPDATE knowledge_assets SET review_status = 'archived', updated_at = ? WHERE workspace_id = ? AND id = ?").run(timestamp, workspaceId, assetId);
    appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.asset.archive", entityType: "knowledge_asset", entityId: assetId, details: { workspaceId }, request, createdAt: timestamp });
    return { id: assetId, archived: true };
  }

  assetContent({ workspaceId = this.workspaceId, assetId } = {}) {
    const row = this.connection.prepare("SELECT id, source_name, mime_type, data_base64, storage_key, review_status FROM knowledge_assets WHERE workspace_id = ? AND id = ? AND review_status <> 'archived'").get(workspaceId, assetId);
    if (!row) throw new KnowledgeError("图片或文件不存在。", 404, "KNOWLEDGE_ASSET_NOT_FOUND");
    const buffer = this.assetBuffer(row);
    return { id: row.id, sourceName: row.source_name, mimeType: row.mime_type || "application/octet-stream", buffer };
  }

  createAsset({ workspaceId = this.workspaceId, libraryId = null, documentId = null, versionId = null, assetType = "image", sourceName = "", mimeType = "application/octet-stream", contentBase64, extractedText = "", altText = "", metadata = {}, actor = null, request = null } = {}) {
    const buffer = decodeBase64(contentBase64);
    const timestamp = now();
    let assetId;
    this.database.transaction(() => {
      const needsOcr = assetType === "image" && !extractedText;
      const linked = assetType === "image" && libraryId && !documentId && !versionId
        ? this.insertImageDocumentShell({ workspaceId, libraryId, sourceName, mimeType, altText, extractedText, requiresOcr: needsOcr && Boolean(this.ocrEndpoint), metadata, actor, timestamp })
        : null;
      const effectiveDocumentId = documentId || linked?.documentId || null;
      const effectiveVersionId = versionId || linked?.versionId || null;
      const ocrStatus = needsOcr ? (this.ocrEndpoint ? "queued" : "failed") : "not_required";
      assetId = this.insertAsset({ workspaceId, libraryId, documentId: effectiveDocumentId, versionId: effectiveVersionId, assetType, sourceName, mimeType, buffer, extractedText, altText, ocrStatus, reviewStatus: "approved", metadata: { ...metadata, processingState: ocrStatus === "queued" ? "processing" : ocrStatus === "failed" ? "failed" : "available", ...(ocrStatus === "failed" ? { processingErrorCode: "KNOWLEDGE_OCR_NOT_CONFIGURED" } : {}) }, actor, timestamp });
      if (ocrStatus === "queued") this.insertOcrJob({ workspaceId, versionId: effectiveVersionId, assetId, buffer, actor, timestamp });
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.asset.create", entityType: "knowledge_asset", entityId: assetId, details: { workspaceId, libraryId, documentId, versionId, assetType }, request, createdAt: timestamp });
    });
    return this.listAssets({ workspaceId, versionId, documentId, includeData: false }).find((item) => item.id === assetId);
  }

  createAssetsBatch({ workspaceId = this.workspaceId, libraryId = null, assets = [], defaults = {}, actor = null, request = null } = {}) {
    if (!Array.isArray(assets) || !assets.length) throw new KnowledgeError("请选择要上传的图片。", 422, "KNOWLEDGE_ASSET_BATCH_REQUIRED");
    if (assets.length > MAX_BATCH_ASSETS) throw new KnowledgeError(`单次最多上传 ${MAX_BATCH_ASSETS} 张图片。`, 413, "KNOWLEDGE_ASSET_BATCH_TOO_LARGE");
    if (libraryId) this.library(workspaceId, libraryId);
    const decoded = assets.map((asset) => ({ ...asset, buffer: decodeBase64(asset.contentBase64) }));
    const totalBytes = decoded.reduce((sum, asset) => sum + asset.buffer.length, 0);
    if (totalBytes > MAX_BATCH_ASSET_BYTES) throw new KnowledgeError("本批图片超过 100 MB，请分批上传。", 413, "KNOWLEDGE_ASSET_BATCH_BYTES_EXCEEDED");
    const timestamp = now();
    const created = [];
    const duplicates = [];
    this.database.transaction(() => {
      decoded.forEach((asset) => {
        const hash = crypto.createHash("sha256").update(asset.buffer).digest("hex");
        const existing = this.connection.prepare("SELECT id, source_name FROM knowledge_assets WHERE workspace_id = ? AND content_hash = ? AND COALESCE(library_id, '') = COALESCE(?, '') AND review_status <> 'archived' LIMIT 1").get(workspaceId, hash, libraryId || null);
        if (existing) { duplicates.push({ sourceName: asset.sourceName || existing.source_name, existingAssetId: existing.id }); return; }
        const mimeType = String(asset.mimeType || "application/octet-stream");
        if (inferDocumentFormat(mimeType, asset.sourceName) !== "image") throw new KnowledgeError(`${asset.sourceName || "文件"} 不是支持的图片格式。`, 422, "KNOWLEDGE_ASSET_IMAGE_REQUIRED");
        const hasExtractedText = Boolean(String(asset.extractedText || "").trim());
        const needsOcr = !hasExtractedText && Boolean(this.ocrEndpoint);
        const linked = libraryId
          ? this.insertImageDocumentShell({ workspaceId, libraryId, sourceName: asset.sourceName, mimeType, altText: asset.altText || String(asset.sourceName || "").replace(/\.[^.]+$/, ""), extractedText: asset.extractedText || "", requiresOcr: needsOcr, metadata: { ...(defaults || {}), ...(asset.metadata || {}), sourceRole: "batch_image" }, actor, timestamp })
          : null;
        const ocrStatus = hasExtractedText ? "not_required" : needsOcr ? "queued" : "failed";
        const assetId = this.insertAsset({
          workspaceId,
          libraryId,
          documentId: linked?.documentId || null,
          versionId: linked?.versionId || null,
          assetType: "image",
          sourceName: asset.sourceName,
          mimeType,
          buffer: asset.buffer,
          extractedText: asset.extractedText || "",
          altText: asset.altText || String(asset.sourceName || "").replace(/\.[^.]+$/, ""),
          ocrStatus,
          reviewStatus: "approved",
          metadata: { ...(defaults || {}), ...(asset.metadata || {}), sourceRole: "batch_image", processingState: needsOcr ? "processing" : ocrStatus === "failed" ? "failed" : "available", ...(ocrStatus === "failed" ? { processingErrorCode: "KNOWLEDGE_OCR_NOT_CONFIGURED" } : {}), batchImportedAt: timestamp },
          actor,
          timestamp
        });
        if (needsOcr) this.insertOcrJob({ workspaceId, versionId: linked?.versionId || null, assetId, buffer: asset.buffer, actor, timestamp });
        created.push(assetId);
      });
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.asset.batch_create", entityType: "knowledge_asset_batch", entityId: id("KBATCH"), details: { libraryId, created: created.length, duplicates: duplicates.length, totalBytes }, request, createdAt: timestamp });
    });
    const itemMap = new Map(this.listAssets({ workspaceId, libraryId: libraryId || "", limit: Math.max(100, created.length) }).map((item) => [item.id, item]));
    return { items: created.map((assetId) => itemMap.get(assetId)).filter(Boolean), duplicates, created: created.length, total: assets.length };
  }

  async createDocumentsBatch({ workspaceId = this.workspaceId, libraryId, documents = [], defaults = {}, actor = null, request = null } = {}) {
    this.library(workspaceId, libraryId);
    if (!Array.isArray(documents) || !documents.length) throw new KnowledgeError("请选择要导入的文档。", 422, "KNOWLEDGE_DOCUMENT_BATCH_REQUIRED");
    if (documents.length > MAX_BATCH_DOCUMENTS) throw new KnowledgeError(`单次最多导入 ${MAX_BATCH_DOCUMENTS} 个文档。`, 413, "KNOWLEDGE_DOCUMENT_BATCH_TOO_LARGE");
    const prepared = [];
    const failures = [];
    documents.forEach((document, index) => {
      try {
        const encoded = String(document?.contentBase64 || "").trim();
        const buffer = encoded ? decodeBase64(encoded) : null;
        const content = String(document?.content || "").trim();
        if (!buffer && !content) throw new KnowledgeError(`第 ${index + 1} 个文档没有文件或文字内容。`, 422, "KNOWLEDGE_CONTENT_REQUIRED", { index });
        prepared.push({ ...document, buffer, index, fileHash: buffer ? crypto.createHash("sha256").update(buffer).digest("hex") : sha256(content), byteLength: buffer?.length || Buffer.byteLength(content, "utf8") });
      } catch (error) {
        failures.push({ index, sourceName: document?.sourceName || document?.title || `文档-${index + 1}`, code: error.code || "KNOWLEDGE_DOCUMENT_IMPORT_FAILED", message: String(error.message || "文档导入失败").slice(0, 500) });
      }
    });
    const totalBytes = prepared.reduce((sum, document) => sum + document.byteLength, 0);
    if (totalBytes > MAX_BATCH_DOCUMENT_BYTES) throw new KnowledgeError("本批文档超过 100 MB，请分批上传。", 413, "KNOWLEDGE_DOCUMENT_BATCH_BYTES_EXCEEDED");
    const items = [];
    const duplicates = [];
    for (let index = 0; index < prepared.length; index += 1) {
      const document = prepared[index];
      try {
        const existing = this.connection.prepare(`
          SELECT id, title FROM knowledge_documents
          WHERE library_id = ? AND status = 'active'
            AND json_extract(metadata_json, '$.sourceFileHash') = ?
          LIMIT 1
        `).get(libraryId, document.fileHash);
        if (existing) {
          duplicates.push({ index: document.index, sourceName: document.sourceName || document.title || existing.title, existingDocumentId: existing.id });
          continue;
        }
        const metadata = { ...(metadataObject(defaults)), ...(metadataObject(document.metadata)), visibility: knowledgeVisibility({ ...(metadataObject(defaults)), ...(metadataObject(document.metadata)) }), sourceFileHash: document.fileHash, batchImportedAt: now() };
        const version = await this.createDocument({
          workspaceId,
          libraryId,
          title: document.title || String(document.sourceName || `文档-${index + 1}`).replace(/\.[^.]+$/, ""),
          content: document.content,
          contentBase64: document.contentBase64,
          sourceType: document.sourceType || (document.contentBase64 ? "file" : "text"),
          sourceName: document.sourceName || "",
          sourceUrl: document.sourceUrl || "",
          mimeType: document.mimeType || "application/octet-stream",
          metadata,
          reviewStatus: "approved",
          actor,
          request
        });
        items.push(this.publicVersion(version));
      } catch (error) {
        failures.push({ index: document.index, sourceName: document.sourceName || document.title || `文档-${document.index + 1}`, code: error.code || "KNOWLEDGE_DOCUMENT_IMPORT_FAILED", message: String(error.message || "文档导入失败").slice(0, 500) });
      }
    }
    appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.document.batch_create", entityType: "knowledge_document_batch", entityId: id("KDOCBATCH"), details: { workspaceId, libraryId, total: documents.length, created: items.length, duplicates: duplicates.length, failed: failures.length, totalBytes }, request, createdAt: now() });
    return { items, duplicates, failures, created: items.length, failed: failures.length, total: documents.length, totalBytes };
  }

  approveAsset({ workspaceId = this.workspaceId, assetId, actor = null, request = null } = {}) {
    const asset = this.connection.prepare("SELECT * FROM knowledge_assets WHERE workspace_id = ? AND id = ?").get(workspaceId, assetId);
    if (!asset) throw new KnowledgeError("知识资产不存在。", 404, "KNOWLEDGE_ASSET_NOT_FOUND");
    if (asset.ocr_status === "queued" || asset.ocr_status === "processing") throw new KnowledgeError("资产 OCR 尚未完成。", 409, "KNOWLEDGE_ASSET_OCR_PENDING");
    const timestamp = now();
    this.connection.prepare("UPDATE knowledge_assets SET review_status = 'approved', updated_at = ? WHERE workspace_id = ? AND id = ?").run(timestamp, workspaceId, assetId);
    appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.asset.approve", entityType: "knowledge_asset", entityId: assetId, details: { workspaceId }, request, createdAt: timestamp });
    return this.listAssets({ workspaceId, versionId: asset.version_id || "", documentId: asset.document_id || "", includeData: false }).find((item) => item.id === assetId);
  }

  listOcrJobs({ workspaceId = this.workspaceId, status = "", assetId = "", versionId = "", limit = 100 } = {}) {
    const params = [workspaceId]; let query = "SELECT * FROM knowledge_ocr_jobs WHERE workspace_id = ?";
    if (status) { query += " AND status = ?"; params.push(status); }
    if (assetId) { query += " AND asset_id = ?"; params.push(assetId); }
    if (versionId) { query += " AND version_id = ?"; params.push(versionId); }
    query += " ORDER BY created_at DESC LIMIT ?"; params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(query).all(...params).map((row) => ({ id: row.id, workspaceId: row.workspace_id, versionId: row.version_id || null, assetId: row.asset_id || null, provider: row.provider, status: row.status, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts), resultText: row.result_text, result: json(row.result_json), errorCode: row.error_code || null, errorMessage: row.error_message || null, nextAttemptAt: row.next_attempt_at || null, createdAt: row.created_at, startedAt: row.started_at || null, completedAt: row.completed_at || null }));
  }

  listIndexJobs({ workspaceId = this.workspaceId, status = "", versionId = "", limit = 100 } = {}) {
    const params = [workspaceId]; let query = "SELECT j.*, v.document_id FROM knowledge_index_jobs j JOIN knowledge_document_versions v ON v.id = j.version_id JOIN knowledge_documents d ON d.id = v.document_id JOIN knowledge_libraries l ON l.id = d.library_id WHERE l.workspace_id = ?";
    if (status) { query += " AND j.status = ?"; params.push(status); }
    if (versionId) { query += " AND j.version_id = ?"; params.push(versionId); }
    query += " ORDER BY j.created_at DESC LIMIT ?"; params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(query).all(...params).map((row) => ({ id: row.id, versionId: row.version_id, documentId: row.document_id, jobType: row.job_type, status: row.status, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts || 3), errorCode: row.error_code || null, errorMessage: row.error_message || null, nextAttemptAt: row.next_attempt_at || null, lockedAt: row.locked_at || null, createdAt: row.created_at, startedAt: row.started_at || null, completedAt: row.completed_at || null, stats: json(row.stats_json) }));
  }

  vectorBackendStatus() {
    const requestedProviderId = String(process.env.TZ_EMBEDDING_PROVIDER_ID || "").trim();
    const providers = Array.isArray(aiProviderStore.state?.providers) ? aiProviderStore.state.providers : [];
    const embeddingProvider = (requestedProviderId && providers.find((provider) => provider.id === requestedProviderId && provider.kind === "embedding" && provider.status !== "disabled" && provider.apiKey))
      || providers.find((provider) => provider.kind === "embedding" && provider.status !== "disabled" && provider.apiKey)
      || null;
    const localFallbackEnabled = String(process.env.TZ_RAG_LOCAL_FALLBACK || "1") === "1";
    return {
      kind: this.vectorStore?.configured ? "remote" : "sqlite",
      configured: Boolean(this.vectorStore?.configured),
      required: this.vectorStoreRequired,
      collection: this.vectorStore?.collection || "knowledge_chunks",
      embedding: embeddingProvider
        ? { mode: "remote", providerConfigured: true, providerId: embeddingProvider.id, model: embeddingProvider.model, localFallbackEnabled }
        : { mode: "local_fallback", providerConfigured: false, providerId: null, model: "local-hash-256", localFallbackEnabled, warning: "local-hash-256 is a lexical fallback, not a production semantic embedding model." }
    };
  }

  async processOcrQueue({ workspaceId = this.workspaceId, limit = 2, workerId = `ocr-${process.pid}` } = {}) {
    const batchLimit = Math.max(1, Math.min(20, Number(limit) || 2));
    if (!this.ocrEndpoint) {
      const pending = this.connection.prepare("SELECT * FROM knowledge_ocr_jobs WHERE workspace_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT ?").all(workspaceId, batchLimit);
      const failedAt = now();
      const results = [];
      for (const job of pending) {
        const asset = this.connection.prepare("SELECT * FROM knowledge_assets WHERE id = ? AND workspace_id = ?").get(job.asset_id, workspaceId);
        const assetMetadata = metadataObject(asset?.metadata_json);
        this.database.transaction(() => {
          this.connection.prepare("UPDATE knowledge_ocr_jobs SET status = 'failed', attempts = attempts + 1, error_code = 'KNOWLEDGE_OCR_NOT_CONFIGURED', error_message = ?, next_attempt_at = NULL, completed_at = ?, locked_at = NULL, locked_by = NULL WHERE id = ?").run("OCR is not configured. Configure TZ_OCR_ENDPOINT before retrying.", failedAt, job.id);
          if (asset) this.connection.prepare("UPDATE knowledge_assets SET ocr_status = 'failed', metadata_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify({ ...assetMetadata, processingState: "failed", processingErrorCode: "KNOWLEDGE_OCR_NOT_CONFIGURED" }), failedAt, asset.id);
          if (job.version_id && assetMetadata.sourceRole !== "pdf_embedded_image") {
            this.connection.prepare("UPDATE knowledge_document_versions SET extraction_status = 'failed', index_status = CASE WHEN index_status = 'indexed' THEN index_status ELSE 'failed' END, updated_at = ? WHERE id = ? AND extraction_status <> 'complete'").run(failedAt, job.version_id);
          }
        });
        results.push({ id: job.id, status: "failed", errorCode: "KNOWLEDGE_OCR_NOT_CONFIGURED" });
      }
      return { processed: results.length, configured: false, results };
    }
    const jobs = this.connection.prepare("SELECT * FROM knowledge_ocr_jobs WHERE workspace_id = ? AND status = 'queued' AND attempts < max_attempts AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at ASC LIMIT ?").all(workspaceId, now(), batchLimit);
    const results = [];
    for (const job of jobs) {
      const lockedAt = now();
      const locked = this.connection.prepare("UPDATE knowledge_ocr_jobs SET status = 'processing', attempts = attempts + 1, locked_at = ?, locked_by = ?, started_at = COALESCE(started_at, ?) WHERE id = ? AND status = 'queued'").run(lockedAt, workerId, lockedAt, job.id);
      if (!Number(locked.changes)) continue;
      try {
        const asset = this.connection.prepare("SELECT * FROM knowledge_assets WHERE id = ? AND workspace_id = ?").get(job.asset_id, workspaceId);
        if (!asset) throw new KnowledgeError("OCR 资产不存在。", 404, "KNOWLEDGE_ASSET_NOT_FOUND");
        const ocr = await this.callOcr(this.assetBuffer(asset), { mimeType: asset.mime_type, sourceName: asset.source_name });
        const completedAt = now();
        const assetMetadata = metadataObject(asset.metadata_json);
        let versionContent = "";
        let versionHash = "";
        let extractionMethod = "ocr";
        if (job.version_id) {
          const version = this.documentVersion(workspaceId, job.version_id);
          if (assetMetadata.sourceRole === "pdf_embedded_image") {
            // Keep the immutable PDF text snapshot unchanged. indexVersion()
            // materializes OCR as asset-scoped chunks with stable IDs so an
            // already cited PDF text chunk is not invalidated by enrichment.
            versionContent = String(version.content_text || "");
            extractionMethod = "pdf+ocr";
          } else {
            versionContent = ocr.text;
          }
          versionHash = sha256(versionContent);
        }
        this.database.transaction(() => {
          this.connection.prepare("UPDATE knowledge_assets SET extracted_text = ?, ocr_status = 'succeeded', metadata_json = ?, updated_at = ? WHERE id = ?").run(ocr.text, JSON.stringify({ ...assetMetadata, processingState: "available", processingErrorCode: null, ocrProvider: ocr.provider, ocrConfidence: ocr.confidence }), completedAt, asset.id);
          if (job.version_id) {
            this.connection.prepare("UPDATE knowledge_document_versions SET content_text = ?, content_hash = ?, review_status = 'approved', index_status = 'not_indexed', indexed_at = NULL, extraction_status = 'complete', extraction_method = ?, updated_at = ? WHERE id = ?").run(versionContent, versionHash, extractionMethod, completedAt, job.version_id);
            this.connection.prepare(`
              UPDATE knowledge_documents SET content_hash = ?, updated_at = ?
              WHERE id = (SELECT document_id FROM knowledge_document_versions WHERE id = ?)
                AND ? = (SELECT id FROM knowledge_document_versions WHERE document_id = knowledge_documents.id ORDER BY version DESC LIMIT 1)
            `).run(versionHash, completedAt, job.version_id, job.version_id);
          }
          this.connection.prepare("UPDATE knowledge_ocr_jobs SET status = 'succeeded', result_text = ?, result_json = ?, completed_at = ?, locked_at = NULL, locked_by = NULL WHERE id = ?").run(ocr.text, JSON.stringify({ provider: ocr.provider, confidence: ocr.confidence, blocks: ocr.blocks, metadata: ocr.metadata }), completedAt, job.id);
        });
        if (job.version_id) await this.activateVersion({ workspaceId, versionId: job.version_id });
        results.push({ id: job.id, status: "succeeded" });
      } catch (error) {
        const failedAt = now(); const attempts = Number(job.attempts || 0) + 1; const exhausted = attempts >= Number(job.max_attempts || 3); const retryAt = new Date(Date.now() + Math.min(3_600_000, 5_000 * 2 ** Math.max(0, attempts - 1))).toISOString();
        this.database.transaction(() => {
          this.connection.prepare("UPDATE knowledge_ocr_jobs SET status = ?, error_code = ?, error_message = ?, next_attempt_at = ?, completed_at = ?, locked_at = NULL, locked_by = NULL WHERE id = ?").run(exhausted ? "failed" : "queued", error.code || "KNOWLEDGE_OCR_FAILED", String(error.message || "OCR failed").slice(0, 2_000), exhausted ? null : retryAt, exhausted ? failedAt : null, job.id);
          if (exhausted) {
            const asset = this.connection.prepare("SELECT metadata_json FROM knowledge_assets WHERE id = ?").get(job.asset_id);
            const assetMetadata = metadataObject(asset?.metadata_json);
            this.connection.prepare("UPDATE knowledge_assets SET ocr_status = 'failed', metadata_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify({ ...assetMetadata, processingState: "failed", processingErrorCode: error.code || "KNOWLEDGE_OCR_FAILED" }), failedAt, job.asset_id);
            if (job.version_id && assetMetadata.sourceRole !== "pdf_embedded_image") this.connection.prepare("UPDATE knowledge_document_versions SET extraction_status = 'failed', index_status = CASE WHEN index_status = 'indexed' THEN index_status ELSE 'failed' END, updated_at = ? WHERE id = ? AND extraction_status <> 'complete'").run(failedAt, job.version_id);
          }
        });
        results.push({ id: job.id, status: exhausted ? "failed" : "queued", error: error.message });
      }
    }
    return { processed: results.length, results };
  }

  retryOcrJob({ workspaceId = this.workspaceId, jobId } = {}) {
    if (!this.ocrEndpoint) throw new KnowledgeError("OCR is not configured. Configure TZ_OCR_ENDPOINT before retrying.", 409, "KNOWLEDGE_OCR_NOT_CONFIGURED");
    const row = this.connection.prepare("SELECT id FROM knowledge_ocr_jobs WHERE workspace_id = ? AND id = ?").get(workspaceId, jobId);
    if (!row) throw new KnowledgeError("OCR 任务不存在。", 404, "KNOWLEDGE_OCR_JOB_NOT_FOUND");
    this.connection.prepare("UPDATE knowledge_ocr_jobs SET status = 'queued', attempts = 0, error_code = NULL, error_message = NULL, next_attempt_at = NULL, locked_at = NULL, locked_by = NULL, completed_at = NULL WHERE workspace_id = ? AND id = ?").run(workspaceId, jobId);
    return this.listOcrJobs({ workspaceId, limit: 100 }).find((item) => item.id === jobId);
  }

  async processIndexQueue({ workspaceId = this.workspaceId, limit = 2, workerId = `index-${process.pid}` } = {}) {
    const jobs = this.connection.prepare("SELECT j.* FROM knowledge_index_jobs j JOIN knowledge_document_versions v ON v.id = j.version_id JOIN knowledge_documents d ON d.id = v.document_id JOIN knowledge_libraries l ON l.id = d.library_id WHERE l.workspace_id = ? AND j.status = 'queued' AND j.attempts < j.max_attempts AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= ?) ORDER BY j.created_at ASC LIMIT ?").all(workspaceId, now(), Math.max(1, Math.min(20, Number(limit) || 2)));
    const results = [];
    for (const job of jobs) {
      const lockedAt = now(); const locked = this.connection.prepare("UPDATE knowledge_index_jobs SET status = 'running', attempts = attempts + 1, started_at = COALESCE(started_at, ?), locked_at = ?, locked_by = ? WHERE id = ? AND status = 'queued'").run(lockedAt, lockedAt, workerId, job.id);
      if (!Number(locked.changes)) continue;
      try { await this.indexVersion({ workspaceId, versionId: job.version_id, jobId: job.id }); results.push({ id: job.id, status: "succeeded" }); }
      catch (error) {
        const attempts = Number(job.attempts || 0) + 1; const exhausted = attempts >= Number(job.max_attempts || 3); const retryAt = new Date(Date.now() + Math.min(3_600_000, 5_000 * 2 ** Math.max(0, attempts - 1))).toISOString();
        this.connection.prepare("UPDATE knowledge_index_jobs SET status = ?, error_code = ?, error_message = ?, next_attempt_at = ?, locked_at = NULL, locked_by = ? WHERE id = ?").run(exhausted ? "failed" : "queued", error.code || "KNOWLEDGE_INDEX_FAILED", String(error.message || "索引失败").slice(0, 2_000), exhausted ? null : retryAt, workerId, job.id);
        results.push({ id: job.id, status: exhausted ? "failed" : "queued", error: error.message });
      }
    }
    return { processed: results.length, results };
  }

  retryIndexJob({ workspaceId = this.workspaceId, jobId } = {}) {
    const row = this.connection.prepare("SELECT j.* FROM knowledge_index_jobs j JOIN knowledge_document_versions v ON v.id = j.version_id JOIN knowledge_documents d ON d.id = v.document_id JOIN knowledge_libraries l ON l.id = d.library_id WHERE l.workspace_id = ? AND j.id = ?").get(workspaceId, jobId);
    if (!row) throw new KnowledgeError("索引任务不存在。", 404, "KNOWLEDGE_INDEX_JOB_NOT_FOUND");
    this.connection.prepare("UPDATE knowledge_index_jobs SET status = 'queued', attempts = 0, error_code = NULL, error_message = NULL, next_attempt_at = NULL, locked_at = NULL, locked_by = NULL, completed_at = NULL WHERE id = ?").run(jobId);
    return this.listIndexJobs({ workspaceId, versionId: row.version_id, limit: 10 }).find((item) => item.id === jobId);
  }

  async resolveEmbeddingProvider(providerId = "") {
    await aiProviderStore.load();
    const requestedId = String(providerId || process.env.TZ_EMBEDDING_PROVIDER_ID || "").trim();
    const providers = (aiProviderStore.state?.providers || []).filter((provider) => provider.status !== "disabled" && provider.apiKey);
    const provider = (requestedId && providers.find((item) => item.id === requestedId)) || providers.find((item) => item.kind === "embedding") || null;
    if (!provider) return null;
    return provider;
  }

  async embedTexts(texts, options = {}) {
    const values = texts.map((value) => String(value || ""));
    const provider = await this.resolveEmbeddingProvider(options.providerId);
    if (!provider) {
      if (String(process.env.TZ_RAG_LOCAL_FALLBACK || "1") !== "1") throw new KnowledgeError("No embedding provider is configured and local fallback is disabled.", 503, "EMBEDDING_PROVIDER_REQUIRED");
      return { vectors: values.map((value) => localEmbedding(value, this.localEmbeddingDimensions)), model: "local-hash-256", providerId: null, source: "local_fallback", fallbackReason: "NO_EMBEDDING_PROVIDER_CONFIGURED" };
    }
    try {
      const body = await fetchJsonWithTimeout(endpoint(provider.baseUrl, "/embeddings"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({ model: provider.model, input: values })
      }, this.embeddingTimeoutMs);
      const rows = Array.isArray(body.data) ? body.data : [];
      const vectors = rows.sort((left, right) => Number(left.index || 0) - Number(right.index || 0)).map((row) => row.embedding);
      if (vectors.length !== values.length || vectors.some((vector) => !Array.isArray(vector) || !vector.length)) throw new Error("embedding response shape invalid");
      return { vectors, model: provider.model, providerId: provider.id, source: "remote" };
    } catch (error) {
      if (String(process.env.TZ_RAG_LOCAL_FALLBACK || "1") !== "1") throw error;
      return { vectors: values.map((value) => localEmbedding(value, this.localEmbeddingDimensions)), model: "local-hash-256", providerId: null, source: "local_fallback", fallbackReason: error.message };
    }
  }

  async activateVersion({ workspaceId = this.workspaceId, versionId, actor = null, request = null } = {}) {
    const version = this.documentVersion(workspaceId, versionId);
    if ((version.extraction_status || "complete") !== "complete") return version;
    if (version.index_status === "indexed") return version;
    const existing = this.connection.prepare("SELECT id FROM knowledge_index_jobs WHERE version_id = ? AND status IN ('queued', 'running') ORDER BY created_at DESC LIMIT 1").get(versionId);
    const timestamp = now();
    const jobId = existing?.id || id("KJOB");
    this.database.transaction(() => {
      this.connection.prepare("UPDATE knowledge_document_versions SET review_status = 'approved', index_status = CASE WHEN index_status = 'indexed' THEN 'indexed' ELSE 'queued' END, approved_at = COALESCE(approved_at, ?), approved_by = COALESCE(approved_by, ?), updated_at = ? WHERE id = ?").run(timestamp, actor?.userId || null, timestamp, versionId);
      if (!existing) this.connection.prepare("INSERT INTO knowledge_index_jobs (id, version_id, job_type, status, attempts, created_at, created_by) VALUES (?, ?, 'index', 'queued', 0, ?, ?)").run(jobId, versionId, timestamp, actor?.userId || null);
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.version.activate", entityType: "knowledge_document_version", entityId: versionId, details: { jobId, automatic: true }, request, createdAt: timestamp });
    });
    if (this.asyncIndexAll || String(version.content_text || "").length >= this.asyncIndexChars) return this.documentVersion(workspaceId, versionId);
    await this.indexVersion({ workspaceId, versionId, jobId, actor, request });
    return this.documentVersion(workspaceId, versionId);
  }

  async approveVersion({ workspaceId = this.workspaceId, versionId, actor = null, request = null } = {}) {
    return this.publicVersion(await this.activateVersion({ workspaceId, versionId, actor, request }));
  }

  publicVersion(version, options = {}) {
    const response = {
      id: version.id,
      documentId: version.document_id,
      libraryId: version.library_id,
      libraryName: version.library_name,
      libraryKind: version.library_kind,
      title: version.title,
      version: Number(version.version),
      contentHash: version.content_hash,
      reviewStatus: version.review_status,
      indexStatus: version.index_status,
      sourceType: version.source_type,
      sourceName: version.source_name,
      sourceUrl: version.source_url,
      mimeType: version.mime_type,
      extractionStatus: version.extraction_status || "complete",
      extractionMethod: version.extraction_method || "text",
      businessLineId: version.business_line_id || null,
      scope: version.scope,
      visibility: knowledgeVisibility(version.metadata_json),
      metadata: metadataObject(version.metadata_json),
      approvedAt: version.approved_at || null,
      indexedAt: version.indexed_at || null,
      createdAt: version.created_at,
      updatedAt: version.updated_at
    };
    if (options.includeContent === true) response.content = version.content_text || "";
    return response;
  }

  async indexVersion({ workspaceId = this.workspaceId, versionId, jobId = null, actor = null, request = null } = {}) {
    const version = this.documentVersion(workspaceId, versionId);
    if (version.review_status !== "approved") throw new KnowledgeError("只有已启用的知识版本才能建立检索索引。", 409, "KNOWLEDGE_VERSION_NOT_ACTIVE");
    const chunks = chunkKnowledgeText(version.content_text);
    const ocrAssets = this.connection.prepare(`
      SELECT id, source_name, extracted_text, metadata_json
      FROM knowledge_assets
      WHERE version_id = ? AND review_status = 'approved' AND ocr_status = 'succeeded'
        AND extracted_text <> '' AND json_extract(metadata_json, '$.sourceRole') = 'pdf_embedded_image'
      ORDER BY created_at ASC, id ASC
    `).all(versionId);
    ocrAssets.forEach((asset) => {
      const assetMetadata = metadataObject(asset.metadata_json);
      const assetChunks = chunkKnowledgeText(asset.extracted_text);
      assetChunks.forEach((chunk, assetOrdinal) => {
        const ordinal = chunks.length;
        chunks.push({
          ...chunk,
          ordinal,
          heading: chunk.heading || `图片文字：${asset.source_name || asset.id}`,
          locator: assetMetadata.pageNumber ? `PDF 第 ${assetMetadata.pageNumber} 页图片` : `PDF 内嵌图片 ${asset.source_name || asset.id}`,
          stableId: `KCH-A-${sha256(`${versionId}:${asset.id}:${assetOrdinal}:${chunk.contentText}`).slice(0, 48)}`,
          metadata: { overlapFromPrevious: chunk.overlapFromPrevious || "", originAssetId: asset.id, sourceRole: "pdf_embedded_image", sourceName: asset.source_name || "", pageNumber: assetMetadata.pageNumber || null }
        });
      });
    });
    const replacedChunks = this.connection.prepare("SELECT id, ordinal, content_hash FROM knowledge_chunks WHERE version_id = ?").all(versionId);
    const replacedChunkIds = replacedChunks.map((row) => row.id);
    const reusableChunkIds = new Map(replacedChunks.map((row) => [`${Number(row.ordinal)}:${row.content_hash}`, row.id]));
    const supersededChunkIds = this.connection.prepare(`
      SELECT c.id
      FROM knowledge_chunks c
      JOIN knowledge_document_versions older ON older.id = c.version_id
      WHERE older.document_id = ? AND older.version < ?
    `).all(version.document_id, Number(version.version)).map((row) => row.id);
    const timestamp = now();
    if (jobId) this.connection.prepare("UPDATE knowledge_index_jobs SET status = 'running', attempts = attempts + CASE WHEN status = 'running' THEN 0 ELSE 1 END, started_at = COALESCE(started_at, ?) WHERE id = ?").run(timestamp, jobId);
    this.database.transaction(() => {
      this.connection.prepare("DELETE FROM knowledge_chunks WHERE version_id = ?").run(versionId);
      this.connection.prepare("UPDATE knowledge_document_versions SET index_status = 'indexing', updated_at = ? WHERE id = ?").run(timestamp, versionId);
      const insert = this.connection.prepare(`
        INSERT INTO knowledge_chunks (id, version_id, ordinal, heading, content_text, content_hash, locator, token_count, metadata_json, embedding_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `);
      chunks.forEach((chunk) => {
        const contentHash = sha256(chunk.contentText);
        const chunkId = chunk.stableId || reusableChunkIds.get(`${Number(chunk.ordinal)}:${contentHash}`) || id("KCH");
        insert.run(chunkId, versionId, chunk.ordinal, chunk.heading, chunk.contentText, contentHash, chunk.locator, chunk.tokenCount, JSON.stringify(chunk.metadata || { overlapFromPrevious: chunk.overlapFromPrevious || "" }), timestamp);
      });
    });
    try {
      const rows = this.connection.prepare("SELECT id, content_text, ordinal, heading, metadata_json FROM knowledge_chunks WHERE version_id = ? ORDER BY ordinal ASC").all(versionId);
      const embedded = await this.embedTexts(rows.map((row) => row.content_text));
      let vectorSync = { configured: Boolean(this.vectorStore?.configured), count: 0, status: "sqlite" };
      if (this.vectorStore?.configured) {
        try {
          const staleVectorIds = [...new Set([...replacedChunkIds, ...supersededChunkIds])];
          if (staleVectorIds.length && typeof this.vectorStore.delete === "function") await this.vectorStore.delete({ namespace: workspaceId, ids: staleVectorIds });
          const visibility = knowledgeVisibility(version.metadata_json);
          vectorSync = { ...(await this.vectorStore.upsert({ namespace: workspaceId, items: rows.map((row, index) => ({ id: row.id, vector: embedded.vectors[index], metadata: { workspaceId, libraryId: version.library_id, documentId: version.document_id, versionId, businessLineId: version.business_line_id || null, visibility, ordinal: row.ordinal, heading: row.heading || "" } })) })), deleted: staleVectorIds.length, status: "remote" };
        } catch (error) {
          if (this.vectorStoreRequired) throw error;
          vectorSync = { configured: true, count: 0, status: "sqlite_fallback", error: error.message };
        }
      }
      const update = this.connection.prepare("UPDATE knowledge_chunks SET embedding_json = ?, embedding_model = ?, embedding_provider_id = ?, embedding_status = 'ready' WHERE id = ?");
      this.database.transaction(() => rows.forEach((row, index) => update.run(JSON.stringify(embedded.vectors[index]), embedded.model, embedded.providerId, row.id)));
      const completedAt = now();
      this.connection.prepare("UPDATE knowledge_document_versions SET index_status = 'indexed', indexed_at = ?, updated_at = ? WHERE id = ?").run(completedAt, completedAt, versionId);
      if (jobId) this.connection.prepare("UPDATE knowledge_index_jobs SET status = 'succeeded', stats_json = ?, completed_at = ?, locked_at = NULL, locked_by = NULL WHERE id = ?").run(JSON.stringify({ chunks: rows.length, embeddingModel: embedded.model, embeddingProviderId: embedded.providerId, embeddingSource: embedded.source, fallbackReason: embedded.fallbackReason || null, vectorSync }), completedAt, jobId);
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.version.index", entityType: "knowledge_document_version", entityId: versionId, details: { chunks: rows.length, embeddingModel: embedded.model, embeddingProviderId: embedded.providerId, embeddingSource: embedded.source }, request, createdAt: completedAt });
    } catch (error) {
      const failedAt = now();
      this.connection.prepare("UPDATE knowledge_document_versions SET index_status = 'failed', updated_at = ? WHERE id = ?").run(failedAt, versionId);
      if (jobId) this.connection.prepare("UPDATE knowledge_index_jobs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?").run(error.code || "INDEX_FAILED", String(error.message || "索引失败").slice(0, 500), failedAt, jobId);
      throw error;
    }
    return this.publicVersion(this.documentVersion(workspaceId, versionId));
  }

  async retrieve({ workspaceId = this.workspaceId, query, businessLineId = "", libraryIds = [], topK = 8, minScore = 0.08, providerId = "", includeInternal = false, actor = null } = {}) {
    const queryText = text(query, "检索问题", 2_000, true);
    const limit = Math.max(1, Math.min(20, Number(topK) || 8));
    const normalizedLibraries = Array.isArray(libraryIds) ? libraryIds.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 100) : [];
    if (normalizedLibraries.length) {
      const allowedLibraries = this.connection.prepare(`
        SELECT id FROM knowledge_libraries
        WHERE workspace_id = ? AND status = 'active'
          AND (? = '' OR scope = 'enterprise' OR business_line_id = ?)
      `).all(workspaceId, String(businessLineId || ""), String(businessLineId || "")).map((row) => row.id);
      const allowed = new Set(allowedLibraries);
      const invalid = normalizedLibraries.filter((libraryId) => !allowed.has(libraryId));
      if (invalid.length) throw new KnowledgeError("One or more requested knowledge libraries are outside the active workspace or business-line scope.", 422, "KNOWLEDGE_LIBRARY_SCOPE_INVALID", { libraryIds: invalid });
    }
    const params = [workspaceId];
    let sql = `
      SELECT c.*, v.document_id, v.version, v.content_hash AS version_hash, v.review_status, v.index_status,
             d.library_id, d.title AS document_title, d.source_name, d.source_url, d.metadata_json AS document_metadata_json,
             l.name AS library_name, l.kind AS library_kind, l.scope, l.business_line_id
      FROM knowledge_chunks c
      JOIN knowledge_document_versions v ON v.id = c.version_id
      JOIN knowledge_documents d ON d.id = v.document_id
      JOIN knowledge_libraries l ON l.id = d.library_id
      WHERE l.workspace_id = ? AND l.status = 'active' AND d.status = 'active'
        AND v.review_status = 'approved' AND v.index_status = 'indexed' AND c.embedding_status = 'ready'
        AND v.version = (
          SELECT MAX(active_version.version)
          FROM knowledge_document_versions active_version
          WHERE active_version.document_id = d.id
            AND active_version.review_status = 'approved'
            AND active_version.index_status = 'indexed'
        )
    `;
    if (businessLineId) { sql += " AND (l.scope = 'enterprise' OR l.business_line_id = ?)"; params.push(businessLineId); }
    if (!includeInternal) sql += " AND json_extract(d.metadata_json, '$.visibility') IS NOT 'internal' AND json_extract(v.metadata_json, '$.visibility') IS NOT 'internal'";
    if (normalizedLibraries.length) {
      sql += ` AND l.id IN (${normalizedLibraries.map(() => "?").join(",")})`;
      params.push(...normalizedLibraries);
    }
    const rows = this.connection.prepare(sql).all(...params);
    if (!rows.length) return { runId: null, query: queryText, mode: "hybrid", embeddingModel: null, results: [], evidence: [], knowledgeGap: true, message: "当前知识范围没有已审核且完成索引的资料。" };
    const embeddedQuery = await this.embedTexts([queryText], { providerId });
    const queryVector = embeddedQuery.vectors[0];
    let remoteScores = null;
    if (this.vectorStore?.configured) {
      try {
        const remote = await this.vectorStore.query({ namespace: workspaceId, vector: queryVector, topK: Math.max(limit * 3, 20), filter: { businessLineId, libraryIds: normalizedLibraries, includeInternal } });
        remoteScores = new Map((remote.matches || []).map((match) => [String(match.id || match.chunkId || match.metadata?.id || ""), Number(match.score ?? match.similarity ?? 0)]).filter(([key]) => key));
      } catch (error) {
        if (this.vectorStoreRequired) throw error;
      }
    }
    const scored = rows.map((row) => {
      const vector = json(row.embedding_json, []);
      const vectorScore = remoteScores?.has(row.id) ? remoteScores.get(row.id) : cosine(queryVector, vector);
      const lexical = lexicalScore(queryText, row.content_text);
      const score = vectorScore * 0.72 + lexical * 0.28;
      return { row, vectorScore, lexicalScore: lexical, score };
    }).filter((item) => item.score >= Number(minScore) || item.lexicalScore > 0).sort((left, right) => right.score - left.score).slice(0, limit);
    const runId = id("KRET");
    const results = scored.map(({ row, score, vectorScore, lexicalScore: lexical }) => ({
      id: row.id,
      chunkId: row.id,
      versionId: row.version_id,
      documentId: row.document_id,
      libraryId: row.library_id,
      libraryName: row.library_name,
      title: row.document_title,
      version: Number(row.version),
      quote: row.content_text,
      content: row.content_text,
      heading: row.heading,
      locator: row.locator || `第 ${Number(row.ordinal) + 1} 个知识片段`,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      visibility: knowledgeVisibility(row.document_metadata_json),
      assetId: metadataObject(row.metadata_json).originAssetId || null,
      metadata: metadataObject(row.metadata_json),
      score: Number(score.toFixed(6)),
      vectorScore: Number(vectorScore.toFixed(6)),
      lexicalScore: Number(lexical.toFixed(6)),
      approved: true,
      status: "approved"
    }));
    const evidence = results.map((result, index) => ({
      id: result.chunkId,
      marker: `K${index + 1}`,
      claim: result.title,
      quote: result.quote,
      source: result.libraryName,
      locator: result.locator,
      libraryId: result.libraryId,
      versionId: result.versionId,
      documentId: result.documentId,
      chunkId: result.chunkId,
      assetId: result.assetId || null,
      metadata: result.metadata || {},
      approved: true,
      status: "approved",
      score: result.score
    }));
    this.connection.prepare(`
      INSERT INTO knowledge_retrieval_runs (id, workspace_id, business_line_id, query_text, filters_json, result_json, embedding_model, embedding_provider_id, embedding_source, embedding_fallback_reason, retrieval_mode, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hybrid', ?, ?)
    `).run(runId, workspaceId, businessLineId || null, queryText, JSON.stringify({ libraryIds: normalizedLibraries, topK: limit, minScore, includeInternal }), JSON.stringify(results), embeddedQuery.model, embeddedQuery.providerId || null, embeddedQuery.source || "", embeddedQuery.fallbackReason || null, now(), actor?.userId || null);
    return { runId, query: queryText, mode: "hybrid", embeddingModel: embeddedQuery.model, embeddingProviderId: embeddedQuery.providerId, embeddingSource: embeddedQuery.source, embeddingFallbackReason: embeddedQuery.fallbackReason || null, results, evidence, knowledgeGap: results.length === 0, message: results.length ? "已完成语义 + 关键词混合检索。" : "没有达到相关性阈值的知识片段。" };
  }

  validateEvidenceReferences({ workspaceId = this.workspaceId, evidence = [], allowInternal = false } = {}) {
    if (!Array.isArray(evidence)) throw new KnowledgeError("Evidence must be an array.", 422, "KNOWLEDGE_EVIDENCE_INVALID");
    const validated = [];
    for (let index = 0; index < evidence.length; index += 1) {
      const item = evidence[index] || {};
      const reference = {
        libraryId: String(item.knowledgeLibraryId || item.libraryId || "").trim(),
        documentId: String(item.knowledgeDocumentId || item.documentId || item.itemId || "").trim(),
        versionId: String(item.knowledgeVersionId || item.versionId || "").trim(),
        chunkId: String(item.knowledgeChunkId || item.chunkId || "").trim()
      };
      const populated = Object.values(reference).filter(Boolean).length;
      if (!populated) {
        validated.push({ ...item, referenceType: "external" });
        continue;
      }
      if (populated !== 4) throw new KnowledgeError("A knowledge citation must include libraryId, documentId, versionId and chunkId.", 422, "KNOWLEDGE_EVIDENCE_REFERENCE_INCOMPLETE", { index, reference });
      let row = this.connection.prepare(`
        SELECT c.id AS chunk_id, c.content_text, c.embedding_status,
               v.id AS version_id, v.review_status, v.index_status, v.metadata_json AS version_metadata_json,
               d.id AS document_id, d.status AS document_status, d.metadata_json AS document_metadata_json,
               l.id AS library_id, l.status AS library_status, l.workspace_id
        FROM knowledge_chunks c
        JOIN knowledge_document_versions v ON v.id = c.version_id
        JOIN knowledge_documents d ON d.id = v.document_id
        JOIN knowledge_libraries l ON l.id = d.library_id
        WHERE l.workspace_id = ? AND l.id = ? AND d.id = ? AND v.id = ? AND c.id = ?
      `).get(workspaceId, reference.libraryId, reference.documentId, reference.versionId, reference.chunkId);
      let legacyResolution = null;
      if (!row && isLegacyKnowledgeChunkId(reference.chunkId)) {
        // The browser workspace used historical KC-* chunk IDs before the
        // formal store generated KCH-* IDs. Resolve only inside the exact
        // library/document/version hierarchy and only with an unambiguous
        // quote match (or a version containing one single chunk).
        const candidates = this.connection.prepare(`
          SELECT c.id AS chunk_id, c.content_text, c.embedding_status,
                 v.id AS version_id, v.review_status, v.index_status, v.metadata_json AS version_metadata_json,
                 d.id AS document_id, d.status AS document_status, d.metadata_json AS document_metadata_json,
                 l.id AS library_id, l.status AS library_status, l.workspace_id
          FROM knowledge_chunks c
          JOIN knowledge_document_versions v ON v.id = c.version_id
          JOIN knowledge_documents d ON d.id = v.document_id
          JOIN knowledge_libraries l ON l.id = d.library_id
          WHERE l.workspace_id = ? AND l.id = ? AND d.id = ? AND v.id = ?
          ORDER BY c.ordinal ASC
        `).all(workspaceId, reference.libraryId, reference.documentId, reference.versionId);
        const quoteText = evidenceMatchText(item.quote || item.content || "");
        const matching = quoteText
          ? candidates.filter((candidate) => {
              const chunkText = evidenceMatchText(candidate.content_text);
              return chunkText.includes(quoteText) || quoteText.includes(chunkText);
            })
          : candidates;
        if (matching.length === 1) {
          row = matching[0];
          legacyResolution = { legacyChunkId: reference.chunkId, resolvedChunkId: row.chunk_id, method: quoteText ? "legacy_quote_unique" : "legacy_single_chunk" };
          reference.chunkId = row.chunk_id;
        }
      }
      if (!row) throw new KnowledgeError("The cited knowledge chunk does not exist or its hierarchy is inconsistent.", 422, "KNOWLEDGE_EVIDENCE_REFERENCE_NOT_FOUND", { index, reference });
      if (row.library_status !== "active" || row.document_status !== "active" || row.review_status !== "approved" || row.index_status !== "indexed" || row.embedding_status !== "ready") {
        throw new KnowledgeError("The cited knowledge chunk is not active and indexed.", 422, "KNOWLEDGE_EVIDENCE_REFERENCE_INACTIVE", { index, reference, libraryStatus: row.library_status, documentStatus: row.document_status, reviewStatus: row.review_status, indexStatus: row.index_status, embeddingStatus: row.embedding_status });
      }
      // Internal at either the current document policy or the cited version
      // snapshot is restrictive. Reclassification must never make an older
      // confidential version publishable by accident.
      const visibility = knowledgeVisibility(row.document_metadata_json) === "internal" || knowledgeVisibility(row.version_metadata_json) === "internal" ? "internal" : "public";
      if (!allowInternal && visibility === "internal") throw new KnowledgeError("Internal-only knowledge cannot be cited by public-facing content.", 422, "KNOWLEDGE_INTERNAL_EVIDENCE_FORBIDDEN", { index, reference });
      const quote = String(item.quote || item.content || "").trim();
      if (quote && !evidenceMatchText(row.content_text).includes(evidenceMatchText(quote)) && !evidenceMatchText(quote).includes(evidenceMatchText(row.content_text))) {
        throw new KnowledgeError("The citation quote does not match the referenced knowledge chunk.", 422, "KNOWLEDGE_EVIDENCE_QUOTE_MISMATCH", { index, reference });
      }
      const normalized = {
        ...item,
        ...reference,
        knowledgeLibraryId: reference.libraryId,
        knowledgeDocumentId: reference.documentId,
        knowledgeVersionId: reference.versionId,
        knowledgeChunkId: reference.chunkId,
        visibility,
        referenceType: "knowledge",
        ...(legacyResolution ? { legacyResolution } : {})
      };
      if (legacyResolution && item.articleVersionId && item.id) {
        // Persist the migration on the evidence row when this validator is
        // called during content review. The old ID remains in metadata for
        // auditability, while subsequent checks use the formal KCH ID.
        const existingEvidence = this.connection.prepare("SELECT metadata_json FROM content_article_evidence WHERE id = ? AND article_version_id = ? AND knowledge_chunk_id = ?").get(item.id, item.articleVersionId, legacyResolution.legacyChunkId);
        if (existingEvidence) {
          const evidenceMetadata = metadataObject(existingEvidence.metadata_json);
          this.connection.prepare("UPDATE content_article_evidence SET knowledge_chunk_id = ?, metadata_json = ? WHERE id = ? AND article_version_id = ? AND knowledge_chunk_id = ?").run(legacyResolution.resolvedChunkId, JSON.stringify({ ...evidenceMetadata, legacyChunkId: legacyResolution.legacyChunkId, legacyResolution: legacyResolution.method, legacyResolvedAt: now() }), item.id, item.articleVersionId, legacyResolution.legacyChunkId);
        }
      }
      validated.push(normalized);
    }
    return { valid: true, count: validated.length, items: validated };
  }

  retrievalRun(workspaceId, runId) {
    const row = this.connection.prepare("SELECT * FROM knowledge_retrieval_runs WHERE workspace_id = ? AND id = ?").get(workspaceId, runId);
    if (!row) throw new KnowledgeError("检索记录不存在。", 404, "KNOWLEDGE_RETRIEVAL_NOT_FOUND");
    return { id: row.id, workspaceId: row.workspace_id, businessLineId: row.business_line_id, query: row.query_text, filters: json(row.filters_json), results: json(row.result_json, []), embeddingModel: row.embedding_model, embeddingProviderId: row.embedding_provider_id || null, embeddingSource: row.embedding_source || "", embeddingFallbackReason: row.embedding_fallback_reason || null, mode: row.retrieval_mode, createdAt: row.created_at };
  }
}
