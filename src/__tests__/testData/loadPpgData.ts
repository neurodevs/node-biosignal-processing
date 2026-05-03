import * as fs from 'fs'
import { parse } from 'fast-csv'

export default async function loadPpgData(fileName: string) {
    const ppgData = await loadCsv(`src/__tests__/testData/${fileName}`)

    const values = ppgData.map((row) => Number(row['infrared']))
    const timestamps = ppgData.map((row) => Number(row['timestamp']))

    return { values, timestamps }
}

export async function loadCsv(filePath: string): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
        const results: CsvRow[] = []

        fs.createReadStream(filePath)
            .pipe(parse({ headers: true }))
            .on('data', (row: CsvRow) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', (error: any) => reject(error))
    })
}

export function padSignalWithZeros(signal: number[], padLength: number) {
    const zeros = new Array(padLength).fill(0)
    return zeros.concat(signal, zeros)
}

export function removeSignalPadding(signal: number[], padLength: number) {
    return signal.slice(padLength, signal.length - padLength)
}

export function normalizeSignal(signal: number[]) {
    const max = Math.max(...signal)
    const min = Math.min(...signal)

    return signal.map((value) => (value - min) / (max - min))
}

export type CsvRow = Record<string, string>
