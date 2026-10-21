import { parseStrategicPlanWorkbook, type ParsedWorkbook } from './parse-workbook';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // .xlsx / .xlsm (Office Open XML is a zip)
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy binary .xls

function startsWith(bytes: Uint8Array, signature: number[]) {
  return bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);
}

/**
 * The uploaded workbook from a form's "file" field, checked for size, name and
 * — because the name is whatever the browser sent — that its first bytes really
 * are a spreadsheet, before anything tries to parse it.
 */
export async function readUpload(formData: FormData): Promise<{ ok: true; buffer: Buffer; fileName: string } | { ok: false; message: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose an Excel file (.xlsx) to import.' };
  const fileName = file.name.split(/[\\/]/).pop()!.slice(0, 200);
  if (!/\.(xlsx|xlsm|xls)$/i.test(fileName)) return { ok: false, message: `"${fileName}" isn't an Excel file. Upload an .xlsx file.` };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: 'The file is larger than 10 MB. Remove unused sheets and try again.' };
  const buffer = Buffer.from(await file.arrayBuffer());
  // Either container is fine whatever the extension says (people rename .xlsx to .xls); anything else isn't a workbook.
  if (!startsWith(buffer, ZIP_SIGNATURE) && !startsWith(buffer, OLE_SIGNATURE)) return { ok: false, message: `"${fileName}" isn't a valid Excel workbook. Save it again from Excel as .xlsx and retry.` };
  return { ok: true, buffer, fileName };
}

export function parseSafely(buffer: Buffer, sheet?: string): { ok: true; parsed: ParsedWorkbook } | { ok: false; message: string } {
  try {
    return { ok: true, parsed: parseStrategicPlanWorkbook(buffer, sheet || undefined) };
  } catch (error) {
    console.error('Plan import: could not read workbook', error);
    return { ok: false, message: "The file couldn't be read. Save it again as .xlsx and retry." };
  }
}
