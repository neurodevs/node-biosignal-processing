import { writeFile } from 'node:fs/promises'
import { XdfFile, XdfFileLoader, XdfLoader } from '@neurodevs/node-xdf'
import { parse, View } from 'vega'
import { compile, TopLevelSpec } from 'vega-lite'

export default class TimestampJitterGrapher implements JitterGrapher {
    public static Class?: JitterGrapherConstructor
    public static writeFile = writeFile

    private xdfInputPath: string
    private totalSecs: number
    private xAxisUnits: 'milliseconds' | 'seconds'
    private ignoreInterpolatedTimestamps: boolean
    private showIdealIntervalMs: boolean
    private outputDir: string
    private loader: XdfLoader

    private xdfFile!: XdfFile
    private streamResults!: StreamResult[]

    protected constructor(options: JitterGrapherConstructorOptions) {
        const {
            xdfInputPath,
            totalSecs = 1,
            xAxisUnits = 'milliseconds',
            ignoreInterpolatedTimestamps = false,
            showIdealIntervalMs = true,
            outputDir,
            loader,
        } = options

        this.xdfInputPath = xdfInputPath
        this.totalSecs = totalSecs
        this.xAxisUnits = xAxisUnits
        this.ignoreInterpolatedTimestamps = ignoreInterpolatedTimestamps
        this.showIdealIntervalMs = showIdealIntervalMs
        this.outputDir = outputDir
        this.loader = loader
    }

    public static async Create(
        xdfInputPath: string,
        outputDir: string,
        options?: JitterGrapherOptions
    ) {
        const {
            totalSecs,
            xAxisUnits,
            ignoreInterpolatedTimestamps,
            showIdealIntervalMs,
        } = options ?? {}

        const loader = await this.XdfFileLoader()

        return new (this.Class ?? this)({
            xdfInputPath,
            totalSecs,
            xAxisUnits,
            ignoreInterpolatedTimestamps,
            showIdealIntervalMs,
            outputDir,
            loader,
        })
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
            ({ data: _data, timestamps, nominalSampleRateHz, ...rest }) => {
                const maxIndex = this.totalSecs * nominalSampleRateHz

                const nominalIntervalMs = 1000 / nominalSampleRateHz

                const intervalsMs = timestamps
                    .slice(1, maxIndex)
                    .map((t, i) => (t - timestamps[i]) * 1000)
                    .filter((ms) =>
                        this.ignoreInterpolatedTimestamps
                            ? Math.abs(ms - nominalIntervalMs) > 0.001
                            : true
                    )

                return {
                    ...rest,
                    nominalSampleRateHz,
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

        const tickLayer = {
            mark: { type: 'tick' as const, thickness: 2 },
            encoding: {
                x: {
                    field: this.useMs ? 'timeMs' : 'timeSec',
                    type: 'quantitative' as const,
                    title: this.useMs ? 'Time (ms)' : 'Time (s)',
                    axis: { tickMinStep: 1 },
                },
                y: {
                    field: 'intervalMs',
                    type: 'quantitative' as const,
                    title: 'ΔT = T(t+1) − T(t) (ms)',
                },
            },
        }

        const ruleLayer = {
            mark: { type: 'rule' as const, color: 'red', strokeWidth: 1 },
            encoding: {
                y: {
                    field: 'idealMs',
                    type: 'quantitative' as const,
                    aggregate: 'mean' as const,
                },
            },
        }

        const vlSpec: TopLevelSpec = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            data: { values: data },
            facet: {
                row: {
                    field: 'streamName',
                    type: 'nominal',
                    title: null,
                    header: { labelAngle: 0, labelAlign: 'left' },
                },
            },
            spec: {
                width: 800,
                height: 200,
                layer: this.showIdealIntervalMs
                    ? [tickLayer, ruleLayer]
                    : [tickLayer],
            },
            resolve: { scale: { x: 'shared' } },
        }

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

    private get useMs() {
        return this.xAxisUnits === 'milliseconds'
    }

    private flattenIntervalsForPlot() {
        const rows: {
            streamName: string
            timeSec?: number
            timeMs?: number
            intervalMs: number
            idealMs: number
        }[] = []

        this.streams.forEach((stream, streamIndex) => {
            const { nominalSampleRateHz } = this.streamResults[streamIndex]

            const nominalIntervalMs = 1000 / nominalSampleRateHz
            const timestamps = stream.timestamps.slice(1)
            const maxIndex = this.totalSecs * nominalSampleRateHz

            for (let i = 0; i < maxIndex; i++) {
                const intervalMs =
                    (stream.timestamps[i + 1] - stream.timestamps[i]) * 1000

                if (
                    this.ignoreInterpolatedTimestamps &&
                    Math.abs(intervalMs - nominalIntervalMs) <= 0.001
                ) {
                    continue
                }

                const delta = timestamps[i] - timestamps[0]
                rows.push({
                    streamName: stream.name,
                    ...(this.useMs
                        ? { timeMs: delta * 1000 }
                        : { timeSec: delta }),
                    intervalMs,
                    idealMs: nominalIntervalMs,
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

export interface JitterGrapherOptions {
    totalSecs?: number
    xAxisUnits?: 'milliseconds' | 'seconds'
    ignoreInterpolatedTimestamps?: boolean
    showIdealIntervalMs?: boolean
}

export type JitterGrapherConstructor = new (
    options: JitterGrapherConstructorOptions
) => JitterGrapher

export interface JitterGrapherConstructorOptions extends JitterGrapherOptions {
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
