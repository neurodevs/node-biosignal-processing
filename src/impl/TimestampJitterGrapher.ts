import { writeFile } from 'fs/promises'
import { XdfFile, XdfFileLoader, XdfLoader } from '@neurodevs/node-xdf'

export default class TimestampJitterGrapher implements JitterGrapher {
    public static Class?: JitterGrapherConstructor
    public static writeFile = writeFile

    private xdfInputPath: string
    private outputDir: string
    private sampleRateHz: number
    private loader: XdfLoader

    private xdfFile!: XdfFile

    protected constructor(options: JitterGrapherConstructorOptions) {
        const { xdfInputPath, outputDir, sampleRateHz, loader } = options

        this.xdfInputPath = xdfInputPath
        this.outputDir = outputDir
        this.sampleRateHz = sampleRateHz
        this.loader = loader
    }

    public static async Create(options: JitterGrapherOptions) {
        const loader = await this.XdfFileLoader()
        return new (this.Class ?? this)({ ...options, loader })
    }

    public async run() {
        await this.loadXdfFile()
        await this.writeResultsJsonFile()
    }

    private async loadXdfFile() {
        this.xdfFile = await this.loader.load(this.xdfInputPath)
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
            sampleRateHz: this.sampleRateHz,
            streams: this.xdfStreamsMetadata,
        }
    }

    private get xdfStreamsMetadata() {
        return this.xdfFile.streams.map(
            ({ data: _data, timestamps: _timestamps, ...rest }) => rest
        )
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

export interface JitterGrapherOptions {
    xdfInputPath: string
    outputDir: string
    sampleRateHz: number
}

export interface JitterGrapherConstructorOptions extends JitterGrapherOptions {
    loader: XdfLoader
}
