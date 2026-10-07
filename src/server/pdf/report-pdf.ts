import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { GENDER_LABEL } from '@/lib/orders';
import { FLAG_LABEL } from '@/lib/results';
import type { ReportDTO, ReportFlag, ReportRow } from '@/lib/report';

/**
 * The report as a PDF, drawn directly (no headless browser, so it runs on serverless).
 * Manrope is embedded so it matches the site; because we pass our own default font,
 * pdfkit never loads its bundled Helvetica data files.
 */
const FONT_DIR = path.join(process.cwd(), 'src/server/pdf/fonts');
let fonts: { regular: Buffer; semi: Buffer; bold: Buffer } | undefined;
const loadFonts = () =>
  (fonts ??= {
    regular: readFileSync(path.join(FONT_DIR, 'manrope-latin-400-normal.woff')),
    semi: readFileSync(path.join(FONT_DIR, 'manrope-latin-600-normal.woff')),
    bold: readFileSync(path.join(FONT_DIR, 'manrope-latin-800-normal.woff')),
  });

const C = { ink: '#0F2236', muted: '#5F6F80', line: '#DDE3E8', soft: '#F6F3EC', blue: '#3368A0', sky: '#66A3BF', mint: '#C8DFDB', ok: '#2C7A6A', hi: '#B83A30', lo: '#94600E' };
const FLAG_COLOR: Record<ReportFlag, string> = { NORMAL: C.ok, HIGH: C.hi, LOW: C.lo, ABNORMAL: C.hi };

const M = 40;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const W = PAGE_W - M * 2;
const COLS = { name: M, value: M + 190, unit: M + 258, range: M + 316, bar: M + 394, flag: M + 466 };
const BOTTOM = PAGE_H - 70;

export async function renderReportPdf(report: ReportDTO, lab: { phone: string; pathologistTitle: string }): Promise<Buffer> {
  const f = loadFonts();
  // `font` accepts a buffer; the typings only list names.
  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: 0, left: M, right: M }, bufferPages: true, font: f.regular as unknown as string, info: { Title: `Lab report ${report.code}`, Author: 'Amma Labs' } });
  doc.registerFont('r', f.regular).registerFont('s', f.semi).registerFont('b', f.bold);
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const text = (s: string, x: number, y: number, o: { font?: 'r' | 's' | 'b'; size?: number; color?: string; width?: number; align?: 'left' | 'right' | 'center' } = {}) =>
    doc.font(o.font ?? 'r').fontSize(o.size ?? 9.5).fillColor(o.color ?? C.ink).text(s, x, y, { width: o.width, align: o.align, lineBreak: o.width !== undefined, ellipsis: o.width !== undefined });

  function header() {
    // brand mark: gradient-ish tile with a drop
    doc.roundedRect(M, 36, 30, 30, 9).fill(C.blue);
    doc.save().translate(M + 7, 43).scale(0.64).path('M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z').lineWidth(2.4).lineCap('round').lineJoin('round').strokeColor('#fff').stroke().restore();
    text('Amma Labs', M + 40, 38, { font: 'b', size: 15 });
    text("Tested with a mother's care", M + 40, 55, { size: 8, color: C.muted });
    text('LABORATORY REPORT', PAGE_W - M - 200, 40, { font: 'b', size: 9, color: C.blue, width: 200, align: 'right' });
    text(report.code, PAGE_W - M - 200, 54, { size: 9, color: C.muted, width: 200, align: 'right' });
    doc.moveTo(M, 78).lineTo(PAGE_W - M, 78).lineWidth(0.6).strokeColor(C.line).stroke();
  }

  function colHeads(y: number) {
    const h = (s: string, x: number) => text(s.toUpperCase(), x, y, { font: 's', size: 7, color: C.muted });
    h('Parameter', COLS.name + 4); h('Result', COLS.value); h('Unit', COLS.unit); h('Reference range', COLS.range); h('Where it sits', COLS.bar); h('Flag', COLS.flag);
    doc.moveTo(M, y + 13).lineTo(PAGE_W - M, y + 13).lineWidth(0.5).strokeColor(C.line).stroke();
    return y + 19;
  }

  function newPage(): number {
    doc.addPage();
    header();
    return 92;
  }

  function row(r: ReportRow, y: number) {
    text(r.name, COLS.name + 4, y, { size: 9.5, width: 180 });
    text(r.value, COLS.value, y - 0.5, { font: 'b', size: r.value.length > 14 ? 8.5 : 10, width: r.range === null && r.value.length > 14 ? W - 190 : 62 });
    text(r.unit, COLS.unit, y, { size: 8.5, color: C.muted, width: 54 });
    text(r.range ?? '', COLS.range, y, { size: 8.5, color: C.muted, width: 74 });
    if (r.position !== null) {
      const bx = COLS.bar, bw = 62, by = y + 4;
      doc.roundedRect(bx, by, bw, 4, 2).fill(C.soft);
      doc.rect(bx + bw * 0.25, by, bw * 0.5, 4).fill(C.mint);
      doc.roundedRect(bx + (bw * r.position) / 100 - 1.5, by - 3, 3, 10, 1.5).fill(r.flag === 'NORMAL' ? C.ink : FLAG_COLOR[r.flag]);
    }
    text(FLAG_LABEL[r.flag].toUpperCase(), COLS.flag, y + 0.5, { font: 'b', size: 7.5, color: FLAG_COLOR[r.flag] });
    doc.moveTo(M, y + 16).lineTo(PAGE_W - M, y + 16).lineWidth(0.3).strokeColor(C.line).stroke();
  }

  header();

  // patient block
  let y = 90;
  doc.roundedRect(M, y, W, 62, 10).fill(C.soft);
  const meta: [string, string][] = [
    ['Patient', `${report.patient.name}, ${report.patient.age} y · ${GENDER_LABEL[report.patient.gender]}`],
    ['Order ID', report.code],
    ['Sample collected', report.collected],
    ['Verified by', report.verifiedBy],
  ];
  meta.forEach(([k, v], i) => {
    const x = M + 14 + (i % 2) * (W / 2), yy = y + 10 + Math.floor(i / 2) * 26;
    text(k.toUpperCase(), x, yy, { font: 's', size: 6.5, color: C.muted });
    text(v, x, yy + 9, { font: 's', size: 9.5, width: W / 2 - 24 });
  });
  y += 76;

  const within = `${report.summary.within} within range`;
  text(within, M, y, { font: 'b', size: 8.5, color: C.ok });
  if (report.summary.outside) text(`${report.summary.outside} outside range`, M + doc.widthOfString(within) + 14, y, { font: 'b', size: 8.5, color: C.hi });
  y += 22;

  for (const t of report.tests) {
    if (y > BOTTOM - 80) y = newPage();
    text(t.name, M, y, { font: 'b', size: 12, width: W });
    y += 22;
    y = colHeads(y);
    for (const g of t.groups) {
      if (g.heading) {
        if (y > BOTTOM - 40) { y = newPage(); y = colHeads(y); }
        doc.rect(M, y - 3, W, 16).fill(C.soft);
        text(g.heading, M + 4, y + 0.5, { font: 'b', size: 8.5 });
        y += 18;
      }
      for (const r of g.rows) {
        if (y > BOTTOM) { y = newPage(); y = colHeads(y); }
        row(r, y);
        y += 20;
      }
    }
    y += 12;
  }

  // sign-off
  if (y > BOTTOM - 70) y = newPage();
  y += 8;
  doc.moveTo(M, y + 30).lineTo(M + 170, y + 30).lineWidth(0.6).strokeColor(C.ink).stroke();
  text(report.verifiedBy, M, y + 36, { font: 'b', size: 9.5 });
  text(lab.pathologistTitle, M, y + 49, { size: 8.5, color: C.muted });
  text(`Released ${new Date(report.releasedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`, M, y + 61, { size: 8, color: C.muted });

  // footer + page numbers on every page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.moveTo(M, PAGE_H - 52).lineTo(PAGE_W - M, PAGE_H - 52).lineWidth(0.5).strokeColor(C.line).stroke();
    text('Reference ranges are for adults and can vary with age and sex. Discuss any flagged value with your doctor.', M, PAGE_H - 44, { size: 7.5, color: C.muted, width: W - 80 });
    text(`Amma Labs · ${lab.phone}`, M, PAGE_H - 32, { size: 7.5, color: C.muted, width: W - 80 });
    text(`Page ${i + 1} of ${range.count}`, PAGE_W - M - 70, PAGE_H - 44, { size: 7.5, color: C.muted, width: 70, align: 'right' });
  }
  doc.end();
  return done;
}
