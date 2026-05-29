import * as XLSX from "xlsx"

/**
 * Build an .xlsx workbook from an array of plain row objects and trigger a
 * browser download. The keys of the first row become the column headers (in
 * insertion order). Client-only — `XLSX.writeFile` relies on the browser to
 * save the file.
 */
export function exportRowsToXlsx(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
  sheetName = "Sheet1",
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const safeName = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`
  XLSX.writeFile(workbook, safeName)
}
