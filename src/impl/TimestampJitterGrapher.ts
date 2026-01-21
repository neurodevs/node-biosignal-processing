import { writeFile } from 'fs/promises'
import { XdfFile, XdfFileLoader, XdfLoader } from '@neurodevs/node-xdf'
import { parse, View } from 'vega'
import { compile, TopLevelSpec } from 'vega-lite'

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
        await this.writeIntervalsPlotPng()
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

    private get streams() {
        return this.xdfFile.streams
    }

    private throwsIfNotEnoughData() {
        const invalidStreams = this.streams.filter((s) => s.data.length < 2)

        if (invalidStreams.length > 0) {
            const countsByStream = invalidStreams
                .map((s) => `${s.data.length} samples in stream ${s.name}`)
                .join(' and ')

            throw new Error(
                `Cannot calculate jitter with less than 2 samples! \n\nFound: ${countsByStream}.\n`
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

    private async writeIntervalsPlotPng() {
        const data = this.flattenIntervalsForPlot()

        const vlSpec: TopLevelSpec = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            data: { values: data },
            facet: {
                row: {
                    field: 'streamName',
                    type: 'nominal',
                    title: null,
                    header: {
                        labelAngle: 0,
                        labelAlign: 'left',
                    },
                },
            },
            spec: {
                width: 2000,
                height: 200,
                layer: [
                    {
                        mark: { type: 'line', interpolate: 'step-after' },
                        encoding: {
                            x: {
                                field: 'timeSec',
                                type: 'quantitative',
                                title: 'Time (s)',
                            },
                            y: {
                                field: 'intervalMs',
                                type: 'quantitative',
                                title: 'ΔT = T(t+1) − T(t) (ms)',
                            },
                            order: { field: 'timeSec', type: 'quantitative' },
                        },
                    },
                    {
                        mark: {
                            type: 'rule',
                            color: 'red',
                            strokeWidth: 2,
                        },
                        encoding: {
                            y: {
                                field: 'idealIntervalMs',
                                type: 'quantitative',
                            },
                        },
                    },
                ],
            },
            resolve: {
                scale: {
                    x: 'shared',
                },
            },
        } as const

        const vgSpec = compile(vlSpec).spec
        const runtime = parse(vgSpec)

        const view = new View(runtime, { renderer: 'none' }).initialize()

        const canvas = await view.toCanvas()
        const buffer = canvas.toBuffer('image/png')

        await this.writeFile(
            `${this.outputDir}/intervals_over_time.png`,
            buffer
        )
    }

    private flattenIntervalsForPlot() {
        const rows: {
            streamName: string
            timeSec: number
            intervalMs: number
            idealIntervalMs: number
        }[] = []

        this.streams.forEach((stream, streamIndex) => {
            const { intervalsMs, nominalSampleRateHz } =
                this.streamResults[streamIndex]

            const idealIntervalMs = 1000 / nominalSampleRateHz

            for (let i = 0; i < intervalsMs.length; i++) {
                const timestamps = stream.timestamps.slice(1)

                rows.push({
                    streamName: stream.name,
                    timeSec: timestamps[i],
                    intervalMs: intervalsMs[i],
                    idealIntervalMs,
                })
            }
        })

        return rows
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
