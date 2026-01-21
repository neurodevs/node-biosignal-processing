import { randomInt } from 'crypto'
import { callsToWriteFile } from '@neurodevs/fake-node-core'
import generateId from '@neurodevs/generate-id'
import { test, assert } from '@neurodevs/node-tdd'
import { FakeXdfLoader, XdfStream } from '@neurodevs/node-xdf'

import { parse, View } from 'vega'
import { TopLevelSpec, compile } from 'vega-lite'
import TimestampJitterGrapher, {
    JitterGrapher,
} from '../../impl/TimestampJitterGrapher.js'
import AbstractPackageTest from '../AbstractPackageTest.js'

export default class TimestampJitterGrapherTest extends AbstractPackageTest {
    private static instance: JitterGrapher

    private static readonly tenSeconds = 10

    protected static async beforeEach() {
        await super.beforeEach()

        this.setFakeXdfLoader()
        this.setFakeWriteFile()

        FakeXdfLoader.fakeResponse = this.fakeXdfFile

        this.instance = await this.TimestampJitterGrapher()
    }

    @test()
    protected static async createsInstance() {
        assert.isTruthy(this.instance, 'Failed to create instance!')
    }

    @test()
    protected static async createsXdfFileLoader() {
        assert.isEqual(
            FakeXdfLoader.numConstructorCalls,
            1,
            'Did not create XdfFileLoader!'
        )
    }

    @test()
    protected static async runLoadsXdfFileFromGivenPath() {
        await this.run()

        assert.isEqual(
            FakeXdfLoader.callsToLoad[0].filePath,
            this.xdfInputPath,
            'Did not load XDF file from given path!'
        )
    }

    @test()
    protected static async throwsIfNotEnoughData() {
        const invalidCounts = [0, 1]

        for (const count of invalidCounts) {
            FakeXdfLoader.fakeResponse = {
                ...this.fakeXdfFile,
                streams: this.fakeStreams.map((s) => ({
                    ...s,
                    data: s.data.slice(0, count),
                    timestamps: s.timestamps.slice(0, count),
                })),
            }

            await assert.doesThrowAsync(async () => {
                await this.instance.run()
            }, `Cannot calculate jitter with less than 2 samples! \n\nFound: ${count} samples in stream ${this.fakeStreams[0].name} and ${count} samples in stream ${this.fakeStreams[1].name}.\n`)
        }
    }

    @test()
    protected static async writesResultsToJsonFile() {
        await this.run()

        assert.isEqualDeep(
            callsToWriteFile[0],
            {
                file: this.resultsJsonPath,
                data: JSON.stringify(this.resultsJson, null, 4),
                options: undefined,
            },
            'Did not write results to JSON file!'
        )
    }

    @test()
    protected static async writesIntervalsPlotPng() {
        await this.run()

        assert.isEqualDeep(
            callsToWriteFile[1],
            {
                file: `${this.outputDir}/intervals_over_time.png`,
                data: await this.generateBuffer(),
                options: undefined,
            },
            'Did not write intervals plot PNG file!'
        )
    }

    @test()
    protected static async onlySamplesTenSecondsOfData() {
        await this.run()

        const streamResults = JSON.parse(callsToWriteFile[0].data).streamResults

        for (const streamResult of streamResults) {
            const numIntervals = streamResult.intervalsMs.length
            const expected = this.tenSeconds * streamResult.nominalSampleRateHz

            assert.isTrue(
                numIntervals <= expected,
                `Stream result has more than 10 seconds of data! Found ${numIntervals} intervals, expected maximum ${expected}.`
            )
        }
    }

    private static async run() {
        await this.instance.run()
    }

    private static async generateBuffer() {
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
                width: 800,
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

        return buffer
    }

    private static flattenIntervalsForPlot() {
        const rows: {
            streamName: string
            timeSec: number
            intervalMs: number
            idealIntervalMs: number
        }[] = []

        this.fakeStreams.forEach((stream, streamIndex) => {
            const { intervalsMs, nominalSampleRateHz } =
                this.fakeStreamResults[streamIndex]

            const timestamps = stream.timestamps.slice(1)
            const maxIndex = this.tenSeconds * nominalSampleRateHz
            const idealIntervalMs = 1000 / nominalSampleRateHz

            for (let i = 0; i < maxIndex; i++) {
                rows.push({
                    streamName: stream.name,
                    timeSec: timestamps[i] - timestamps[0],
                    intervalMs: intervalsMs[i],
                    idealIntervalMs,
                })
            }
        })

        return rows
    }

    public static createFakeStream(options?: Partial<XdfStream>): XdfStream {
        const channelCount = randomInt(1, 10)
        const nominalSampleRateHz = 1 + Math.random() * 0.1

        return {
            id: randomInt(1, 10),
            name: generateId(),
            type: generateId(),
            channelCount,
            channelFormat: 'float32',
            nominalSampleRateHz,
            data: Array.from({ length: 20 }, (_, i) =>
                Array.from(
                    { length: channelCount },
                    () => i + (Math.random() - 0.5)
                )
            ),
            timestamps: Array.from(
                { length: 20 },
                (_, i) => i / nominalSampleRateHz
            ),
            ...options,
        }
    }

    private static readonly xdfInputPath = this.generateId()
    private static readonly outputDir = this.generateId()
    private static readonly resultsJsonPath = `${this.outputDir}/results.json`

    private static readonly fakeStreams = [
        this.createFakeStream(),
        this.createFakeStream(),
    ]

    private static readonly fakeXdfFile = {
        path: '',
        streams: this.fakeStreams,
        events: [],
    }

    private static readonly fakeStreamResults = this.fakeStreams.map(
        ({ data: _data, timestamps, nominalSampleRateHz, ...rest }) => {
            const maxIndex = this.tenSeconds * nominalSampleRateHz

            const intervalsMs = timestamps
                .slice(1, maxIndex)
                .map((t, i) => (t - timestamps[i]) * 1000)

            return {
                ...rest,
                nominalSampleRateHz,
                intervalsMs,
            }
        }
    )

    private static readonly resultsJson = {
        xdfInputPath: this.xdfInputPath,
        outputDir: this.outputDir,
        resultsJsonPath: this.resultsJsonPath,
        streamResults: this.fakeStreamResults,
    }

    private static async TimestampJitterGrapher() {
        return TimestampJitterGrapher.Create(this.xdfInputPath, this.outputDir)
    }
}
