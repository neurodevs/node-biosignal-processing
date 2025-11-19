import { writeFile } from 'fs/promises'
import { XdfFile, XdfFileLoader, XdfLoader } from '@neurodevs/node-xdf'
import { toImage, Data } from 'plotly.js-dist-min'

export default class TimestampJitterGrapher implements JitterGrapher {
    public static Class?: JitterGrapherConstructor
    public static writeFile = writeFile
    public static toImage = toImage

    private xdfInputPath: string
    private outputDir: string
    private loader: XdfLoader

    private xdfFile!: XdfFile

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
        await this.generateJitterPlot()
    }

    private async loadXdfFile() {
        this.xdfFile = await this.loader.load(this.xdfInputPath)
    }

    private async calculateResults() {}

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
            streams: this.xdfStreamsMetadata,
        }
    }

    private async generateJitterPlot() {
        const traces = this.generateStreamTraces()
        let layout = this.generatePlotLayout()

        const pngBuffer = await this.toImage(
            { data: traces, layout },
            {
                format: 'png',
                width: 1000,
                height: 600,
            }
        )

        await this.writeFile(`${this.outputDir}/jitter.png`, pngBuffer)
    }

    private generateStreamTraces() {
        return this.streams.map((stream) => {
            return {
                x: [],
                y: [],
                type: 'histogram',
                histnorm: 'density',
                name: stream.name,
                autobinx: false,
                opacity: 0.5,
                marker: {
                    color: 'rgba(255, 100, 102, 0.7)',
                    line: {
                        color: 'rgba(255, 100, 102, 1)',
                        width: 1,
                    },
                },
                xbins: {
                    end: 2.8,
                    size: 0.06,
                    start: 0.5,
                },
            } as Data
        })
    }

    private generatePlotLayout() {
        return {
            bargap: 0.05,
            bargroupgap: 0.2,
            barmode: 'overlay' as const,
            title: {
                text: 'Distribution of Timestamp Jitter per Stream',
            },
            xaxis: {
                title: {
                    text: 'Timestamp Jitter (ms)',
                },
            },
            yaxis: {
                title: {
                    text: 'Count',
                },
            },
        }
    }

    private get xdfStreamsMetadata() {
        return this.streams.map(
            ({ data: _data, timestamps: _timestamps, ...rest }) => rest
        )
    }

    private get streams() {
        return this.xdfFile.streams
    }

    private get toImage() {
        return TimestampJitterGrapher.toImage
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
