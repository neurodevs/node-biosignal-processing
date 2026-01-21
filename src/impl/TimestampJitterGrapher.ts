import { writeFile } from 'fs/promises'
import { XdfFile, XdfFileLoader, XdfLoader } from '@neurodevs/node-xdf'

export default class TimestampJitterGrapher implements JitterGrapher {
    public static Class?: JitterGrapherConstructor
    public static writeFile = writeFile

    private xdfInputPath: string
    private outputDir: string
    private loader: XdfLoader

    private xdfFile!: XdfFile
    private streamResults!: StreamResult[]

    protected constructor(options: JitterGrapherConstructorOptions) {
        const { xdfInputPath, outputDir, loader } = options

        this.xdfInputPath = xdfInputPath
        this.outputDir = outputDir
        this.loader = loader
    }

    public static async Create(xdfInputPath: string, outputDir: string) {
        const loader = await this.XdfFileLoader()
        return new (this.Class ?? this)({ xdfInputPath, outputDir, loader })
    }

    public async run() {
        await this.loadXdfFile()
        await this.calculateResults()
        await this.writeResultsJsonFile()
    }

    private async loadXdfFile() {
        this.xdfFile = await this.loader.load(this.xdfInputPath)
    }

    private async calculateResults() {
        this.throwsIfNotEnoughData()

        this.streamResults = this.streams.map(
            ({ data: _data, timestamps, ...rest }) => {
                const intervalsMs = timestamps
                    .slice(1)
                    .map((t, i) => (t - timestamps[i]) * 1000)

                return {
                    ...rest,
                    intervalsMs,
                }
            }
        )
    }

    private throwsIfNotEnoughData() {
        const invalidStreams = this.streams.filter((s) => s.data.length < 2)

        if (invalidStreams.length > 0) {
            const countsDescription = invalidStreams
                .map((s) => `${s.data.length} samples in stream ${s.name}`)
                .join(' and ')

            throw new Error(
                `Cannot calculate jitter with less than 2 samples! \n\nFound: ${countsDescription}.\n`
            )
        }
    }

    private async writeResultsJsonFile() {
        await this.writeFile(
            this.resultsJsonPath,
            JSON.stringify(this.resultsJson, null, 4)
        )
    }

    private get resultsJsonPath() {
        return `${this.outputDir}/results.json`
    }

    private get resultsJson() {
        return {
            xdfInputPath: this.xdfInputPath,
            outputDir: this.outputDir,
            resultsJsonPath: this.resultsJsonPath,
            streamResults: this.streamResults,
        }
    }

    private get streams() {
        return this.xdfFile.streams
    }

    private get writeFile() {
        return TimestampJitterGrapher.writeFile
    }

    private static async XdfFileLoader() {
        return XdfFileLoader.Create()
    }
}

export interface JitterGrapher {
    run(): Promise<void>
}

export type JitterGrapherConstructor = new (
    options: JitterGrapherConstructorOptions
) => JitterGrapher

export interface JitterGrapherConstructorOptions {
    xdfInputPath: string
    outputDir: string
    loader: XdfLoader
}

export interface StreamResult {
    id: number
    name: string
    type: string
    channelCount: number
    channelFormat: string
    nominalSampleRateHz: number
    intervalsMs: number[]
}
