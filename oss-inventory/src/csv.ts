/**
 * The minimum of RFC 4180 the tool needs, in one place: the reader for sbt-license-report's CSV and
 * the writer for `inventory.csv`. sbt-license-report writes unquoted fields (F11), but a quoted one
 * is legal CSV, so the reader understands both and the writer quotes whenever it must.
 */

/** One field, quoted only when it holds a comma, a quote or a line break. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** One record, with the LF line end SCOPE.md requires. */
export function csvRow(values: readonly string[]): string {
  return `${values.map(csvField).join(',')}\n`
}

export type CsvRow = {
  /** 1-based, counting every physical line, so a message can name the line of the file. */
  readonly line: number
  readonly fields: readonly string[]
}

/** Splits CSV text into records. A record that spans lines counts from its first line. */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let startLine = 1
  let started = false

  const endField = (): void => {
    fields.push(field)
    field = ''
  }
  const endRow = (): void => {
    endField()
    if (!(fields.length === 1 && fields[0] === '')) {
      rows.push({ line: startLine, fields })
    }
    fields = []
    started = false
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (!started) {
      startLine = line
      started = true
    }
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        if (char === '\n') line += 1
        field += char
      }
      continue
    }
    if (char === '"' && field === '') {
      quoted = true
    } else if (char === ',') {
      endField()
    } else if (char === '\n') {
      endRow()
      line += 1
    } else if (char === '\r') {
      // part of a CRLF end; the following \n closes the record
    } else {
      field += char
    }
  }
  if (started || field !== '' || fields.length > 0) endRow()
  return rows
}
