import { parseStrategicPlanWorkbook, type ParsedWorkbook } from './parse-workbook';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** The uploaded workbook from a form's "file" field, checked for type and size. */
export async function readUpload(formData: FormData): Promise<{ ok: true; buffer: Buffer; fileName: string } | { ok: false; message: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose an Excel file (.xlsx) to import.' };
  if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) return { ok: false, message: `"${file.name}" isn't an Excel file. Upload an .xlsx file.` };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: 'The file is larger than 10 MB. Remove unused sheets and try again.' };
  return { ok: true, buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name };
}

export function parseSafely(buffer: Buffer, sheet?: string): { ok: true; parsed: ParsedWorkbook } | { ok: false; message: string } {
  try {
    return { ok: true, parsed: parseStrategicPlanWorkbook(buffer, sheet || undefined) };
  } catch (error) {
    console.error('Plan import: could not read workbook', error);
    return { ok: false, message: "The file couldn't be read. Save it again as .xlsx and retry." };
  }
}
