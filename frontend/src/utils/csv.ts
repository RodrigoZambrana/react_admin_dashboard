import Papa from 'papaparse'

export function downloadCsvFile(filename: string, rows: Record<string, unknown>[]) {
    const safeRows = Array.isArray(rows) ? rows : []
    if (!safeRows.length) {
        // Ensure headers exist by exporting an empty CSV with no rows
        const blob = new Blob([''], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        return
    }
    const csv = Papa.unparse(
        safeRows.map((row) =>
            Object.fromEntries(
                Object.entries(row).map(([key, value]) => [
                    key,
                    value === null || value === undefined ? '' : String(value),
                ]),
            ),
        ),
    )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function parseCsvFile<T extends Record<string, unknown> = Record<string, unknown>>(
    file: File,
) {
    return new Promise<T[]>((resolve, reject) => {
        Papa.parse<T>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors && results.errors.length) {
                    reject(new Error(results.errors[0].message))
                    return
                }
                resolve((results.data || []) as T[])
            },
            error: (error) => {
                reject(error)
            },
        })
    })
}
