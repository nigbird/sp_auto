/**
 * SheetJS (community edition) writes values but not styles or images. This
 * module post-processes the written .xlsx: it swaps in our own stylesheet,
 * applies a style role to each cell, freezes header rows, and anchors PNG
 * chart images on sheets (DrawingML pictures).
 */

import * as XLSX from 'xlsx';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type StyleRole =
  | 'title' | 'subtitle' | 'section' | 'header' | 'text' | 'wrap' | 'pct' | 'weight' | 'int' | 'score' | 'label' | 'bold'
  | 'kpi' | 'kpiPct' | 'kpiWeight'
  | 'group' | 'groupPct' | 'groupWeight' | 'groupInt'
  | 'total' | 'totalPct' | 'totalWeight' | 'totalInt';

// numFmt ids: 1 = "0", 164 = 0.0%, 165 = weight in percent units, 166 = score in percent units
const NUMFMTS = `<numFmts count="3"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/><numFmt numFmtId="166" formatCode="0.0&quot;%&quot;"/></numFmts>`;

// fonts: 0 normal, 1 bold, 2 title, 3 subtitle, 4 header, 5 section, 6 kpi value, 7 muted
const FONTS = [
  '<font><sz val="11"/><color rgb="FF2F2A25"/><name val="Calibri"/><family val="2"/></font>',
  '<font><b/><sz val="11"/><color rgb="FF2F2A25"/><name val="Calibri"/><family val="2"/></font>',
  '<font><b/><sz val="18"/><color rgb="FF5B4030"/><name val="Calibri"/><family val="2"/></font>',
  '<font><i/><sz val="10"/><color rgb="FF857B70"/><name val="Calibri"/><family val="2"/></font>',
  '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',
  '<font><b/><sz val="13"/><color rgb="FF5B4030"/><name val="Calibri"/><family val="2"/></font>',
  '<font><b/><sz val="15"/><color rgb="FF2F2A25"/><name val="Calibri"/><family val="2"/></font>',
  '<font><sz val="10"/><color rgb="FF857B70"/><name val="Calibri"/><family val="2"/></font>',
];

const solid = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
// fills: 0 none, 1 gray125 (required), 2 header brown, 3 group, 4 total, 5 kpi card
const FILLS = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', solid('5E4231'), solid('F3EADB'), solid('EADFCB'), solid('FAF6F0')];

// borders: 0 none, 1 thin bottom, 2 medium top
const BORDERS = [
  '<border><left/><right/><top/><bottom/><diagonal/></border>',
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE2D8C8"/></bottom><diagonal/></border>',
  '<border><left/><right/><top style="medium"><color rgb="FF8E6A51"/></top><bottom style="thin"><color rgb="FFE2D8C8"/></bottom><diagonal/></border>',
];

interface Xf { numFmt?: number; font?: number; fill?: number; border?: number; wrap?: boolean; h?: 'left' | 'center' | 'right'; v?: 'top' | 'center'; indent?: number }

const ROLES: Record<StyleRole, Xf> = {
  title: { font: 2 },
  subtitle: { font: 3 },
  section: { font: 5 },
  header: { font: 4, fill: 2, border: 1, wrap: true, h: 'center', v: 'center' },
  text: { border: 1, v: 'top', h: 'left', indent: 1 },
  wrap: { border: 1, wrap: true, v: 'top', h: 'left', indent: 1 },
  pct: { numFmt: 164, border: 1, v: 'top', h: 'right' },
  weight: { numFmt: 165, border: 1, v: 'top', h: 'right' },
  int: { numFmt: 1, border: 1, v: 'top', h: 'right' },
  score: { numFmt: 166, border: 1, v: 'top', h: 'right' },
  label: { font: 7, v: 'center' },
  bold: { font: 1 },
  kpi: { font: 6, fill: 5, v: 'center', h: 'left', indent: 1 },
  kpiPct: { font: 6, fill: 5, numFmt: 164, v: 'center', h: 'left', indent: 1 },
  kpiWeight: { font: 6, fill: 5, numFmt: 165, v: 'center', h: 'left', indent: 1 },
  group: { font: 1, fill: 3, border: 1, h: 'left', indent: 1 },
  groupPct: { font: 1, fill: 3, border: 1, numFmt: 164, h: 'right' },
  groupWeight: { font: 1, fill: 3, border: 1, numFmt: 165, h: 'right' },
  groupInt: { font: 1, fill: 3, border: 1, numFmt: 1, h: 'right' },
  total: { font: 1, fill: 4, border: 2, h: 'left', indent: 1 },
  totalPct: { font: 1, fill: 4, border: 2, numFmt: 164, h: 'right' },
  totalWeight: { font: 1, fill: 4, border: 2, numFmt: 165, h: 'right' },
  totalInt: { font: 1, fill: 4, border: 2, numFmt: 1, h: 'right' },
};

const ROLE_ORDER = Object.keys(ROLES) as StyleRole[];
/** xf index for a role (0 is the default "Normal" xf). */
const XF_INDEX = Object.fromEntries(ROLE_ORDER.map((r, i) => [r, i + 1])) as Record<StyleRole, number>;

function xfXml(x: Xf) {
  const attrs = [
    `numFmtId="${x.numFmt ?? 0}"`, `fontId="${x.font ?? 0}"`, `fillId="${x.fill ?? 0}"`, `borderId="${x.border ?? 0}"`, 'xfId="0"',
    x.numFmt ? 'applyNumberFormat="1"' : '', x.font ? 'applyFont="1"' : '', x.fill ? 'applyFill="1"' : '', x.border ? 'applyBorder="1"' : '',
    x.wrap || x.h || x.v ? 'applyAlignment="1"' : '',
  ].filter(Boolean).join(' ');
  const align = x.wrap || x.h || x.v ? `<alignment${x.h ? ` horizontal="${x.h}"` : ''}${x.v ? ` vertical="${x.v}"` : ''}${x.wrap ? ' wrapText="1"' : ''}${x.indent ? ` indent="${x.indent}"` : ''}/>` : '';
  return align ? `<xf ${attrs}>${align}</xf>` : `<xf ${attrs}/>`;
}

function stylesXml() {
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', ...ROLE_ORDER.map(r => xfXml(ROLES[r]))];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${NUMFMTS}<fonts count="${FONTS.length}">${FONTS.join('')}</fonts><fills count="${FILLS.length}">${FILLS.join('')}</fills><borders count="${BORDERS.length}">${BORDERS.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0"/></styleSheet>`;
}

// ---------------------------------------------------------------------------
// Sheet builder
// ---------------------------------------------------------------------------

export type CellValue = string | number | null | undefined;
export interface StyledCell { v: CellValue; role?: StyleRole }
export interface SheetImage { png: Buffer; width: number; height: number; col: number; row: number; name: string }

/** Builds one worksheet row by row, remembering each cell's style role. */
export class SheetBuilder {
  readonly rows: CellValue[][] = [];
  readonly roles = new Map<string, StyleRole>();
  readonly merges: XLSX.Range[] = [];
  readonly images: SheetImage[] = [];
  freezeRows = 0;
  autoFilter: string | null = null;
  showGrid = true;
  rowHeights = new Map<number, number>();

  constructor(readonly name: string, readonly widths: number[]) {}

  /** Adds a row; plain values take `role`. Returns the 0-based row index. */
  row(cells: (StyledCell | CellValue)[], role?: StyleRole): number {
    const r = this.rows.length;
    this.rows.push(cells.map((c, col) => {
      const cell = c !== null && typeof c === 'object' ? c : { v: c, role };
      const cellRole = cell.role ?? role;
      if (cellRole) this.roles.set(XLSX.utils.encode_cell({ r, c: col }), cellRole);
      return cell.v ?? '';
    }));
    return r;
  }

  blank(n = 1) { for (let i = 0; i < n; i++) this.rows.push([]); }

  merge(r: number, c1: number, c2: number, r2 = r) { this.merges.push({ s: { r, c: c1 }, e: { r: r2, c: c2 } }); }

  /** Anchors chart images in a column, one under another, starting at `row`. */
  stackImages(charts: { png: Buffer; width: number; height: number; name: string }[], col: number, row = 0, scale = 0.8, rowPx = 20) {
    let at = row;
    for (const c of charts) {
      const width = Math.round(c.width * scale), height = Math.round(c.height * scale);
      this.images.push({ ...c, width, height, col, row: at });
      at += Math.ceil(height / rowPx) + 1;
    }
    return at;
  }

  toSheet(): XLSX.WorkSheet {
    const ws = XLSX.utils.aoa_to_sheet(this.rows);
    ws['!cols'] = this.widths.map(wch => ({ wch }));
    if (this.merges.length) ws['!merges'] = this.merges;
    if (this.autoFilter) ws['!autofilter'] = { ref: this.autoFilter };
    if (this.rowHeights.size) {
      const rows: XLSX.RowInfo[] = [];
      for (const [r, hpt] of this.rowHeights) rows[r] = { hpt };
      ws['!rows'] = rows;
    }
    return ws;
  }
}

// ---------------------------------------------------------------------------
// Workbook assembly
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function drawingXml(images: SheetImage[], startId: number) {
  const anchors = images.map((img, i) => {
    const cx = img.width * EMU_PER_PX, cy = img.height * EMU_PER_PX, id = startId + i;
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${img.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id + 1}" name="${esc(img.name)}" descr="${esc(img.name)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
}

const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

/** Writes the workbook, then applies styles, frozen panes and images. */
export function writeStyledWorkbook(sheets: SheetBuilder[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, s.toSheet(), s.name);
  const raw = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const files = unzipSync(new Uint8Array(raw));

  files['xl/styles.xml'] = strToU8(stylesXml());
  let contentTypes = strFromU8(files['[Content_Types].xml']);
  let mediaNo = 0;
  let drawingNo = 0;
  let shapeId = 0;

  sheets.forEach((sheet, index) => {
    const path = `xl/worksheets/sheet${index + 1}.xml`;
    let xml = strFromU8(files[path]);

    // Cell styles: drop SheetJS's own style index, apply the role's.
    xml = xml.replace(/<c r="([A-Z]+\d+)"([^>]*?)(\/?)>/g, (_m, ref: string, attrs: string, selfClose: string) => {
      const cleaned = attrs.replace(/\s+s="\d+"/, '');
      const role = sheet.roles.get(ref);
      return `<c r="${ref}"${cleaned}${role ? ` s="${XF_INDEX[role]}"` : ''}${selfClose}>`;
    });

    // Sheet view: frozen header rows and gridlines.
    const pane = sheet.freezeRows > 0
      ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${sheet.freezeRows + 1}" sqref="A${sheet.freezeRows + 1}"/>`
      : '';
    const view = `<sheetView workbookViewId="0"${sheet.showGrid ? '' : ' showGridLines="0"'}${index === 0 ? ' tabSelected="1"' : ''}>${pane}</sheetView>`;
    xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, `<sheetViews>${view}</sheetViews>`);

    // Images: a drawing part with one picture per chart.
    if (sheet.images.length) {
      drawingNo++;
      const drawingPath = `xl/drawings/drawing${drawingNo}.xml`;
      files[drawingPath] = strToU8(drawingXml(sheet.images, shapeId));
      shapeId += sheet.images.length;
      const imageRels = sheet.images.map((img, i) => {
        mediaNo++;
        files[`xl/media/image${mediaNo}.png`] = new Uint8Array(img.png);
        return `<Relationship Id="rId${i + 1}" Type="${REL_IMAGE}" Target="../media/image${mediaNo}.png"/>`;
      }).join('');
      files[`xl/drawings/_rels/drawing${drawingNo}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}">${imageRels}</Relationships>`);

      const relsPath = `xl/worksheets/_rels/sheet${index + 1}.xml.rels`;
      const drawingRel = `<Relationship Id="rIdDrawing1" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingNo}.xml"/>`;
      files[relsPath] = files[relsPath]
        ? strToU8(strFromU8(files[relsPath]).replace('</Relationships>', `${drawingRel}</Relationships>`))
        : strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}">${drawingRel}</Relationships>`);

      // <drawing> comes after ignoredErrors and before legacyDrawing/tableParts/extLst.
      const before = xml.match(/<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/);
      xml = before
        ? xml.replace(before[0], `<drawing r:id="rIdDrawing1"/>${before[0]}`)
        : xml.replace('</worksheet>', '<drawing r:id="rIdDrawing1"/></worksheet>');
      if (!/xmlns:r=/.test(xml)) xml = xml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');

      contentTypes = contentTypes.replace('</Types>', `<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    }

    files[path] = strToU8(xml);
  });

  if (!/Extension="png"/.test(contentTypes)) contentTypes = contentTypes.replace('<Default ', '<Default Extension="png" ContentType="image/png"/><Default ');
  files['[Content_Types].xml'] = strToU8(contentTypes);
  return Buffer.from(zipSync(files, { level: 6 }));
}
