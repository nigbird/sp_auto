/**
 * jsPDF's built-in fonts only cover the Windows-1252 character set; anything
 * else prints as "�". Swap the common typographic characters for plain ones
 * before text reaches a PDF. (Scripts such as Amharic need an embedded font,
 * which these exports don't include.)
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/[—–−]/g, '-'],
  [/[·•]/g, '|'],
  [/[‘’′]/g, "'"],
  [/[“”″]/g, '"'],
  [/…/g, '...'],
  [/→/g, '>'],
  [/ /g, ' '],
];

export function pdfText(value: unknown): string {
  let text = value == null ? '' : String(value);
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement);
  return text;
}

/** autoTable hook: clean every cell's text. */
export const cleanPdfCell = (data: { cell: { text: string[] } }) => {
  data.cell.text = data.cell.text.map(pdfText);
};
