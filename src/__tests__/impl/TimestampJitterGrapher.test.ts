import { randomInt } from 'node:crypto'
import { callsToWriteFile } from '@neurodevs/fake-node-core'
import generateId from '@neurodevs/generate-id'
import { test, assert } from '@neurodevs/node-tdd'
import { FakeXdfLoader, XdfStream } from '@neurodevs/node-xdf'

import { parse, View } from 'vega'
import { TopLevelSpec, compile } from 'vega-lite'
import TimestampJitterGrapher, {
    JitterGrapher,
    JitterGrapherOptions,
} from '../../impl/TimestampJitterGrapher.js'
import AbstractPackageTest from '../AbstractPackageTest.js'

export default class TimestampJitterGrapherTest extends AbstractPackageTest {
    private static instance: JitterGrapher

    private static readonly oneSecond = 1

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
            const expected = this.oneSecond * streamResult.nominalSampleRateHz

            assert.isTrue(
                numIntervals <= expected,
                `Stream result has more than 10 seconds of data! Found ${numIntervals} intervals, expected maximum ${expected}.`
            )
        }
    }

    @test()
    protected static async defaultsXAxisUnitsToMilliseconds() {
        await this.run()

        assert.isEqualDeep(
            callsToWriteFile[1],
            {
                file: `${this.outputDir}/intervals_over_time.png`,
                data: await this.generateBuffer({ xAxisUnits: 'milliseconds' }),
                options: undefined,
            },
            'Default xAxisUnits is not milliseconds!'
        )
    }

    @test()
    protected static async supportsSecondsForXAxisUnits() {
        const instance = await this.TimestampJitterGrapher({
            xAxisUnits: 'seconds',
        })
        await instance.run()

        assert.isEqualDeep(
            callsToWriteFile[1],
            {
                file: `${this.outputDir}/intervals_over_time.png`,
                data: await this.generateBuffer({ xAxisUnits: 'seconds' }),
                options: undefined,
            },
            'xAxisUnits is not seconds!'
        )
    }

    @test()
    protected static async defaultsShowIdealIntervalMsToTrue() {
        await this.run()

        assert.isEqualDeep(
            callsToWriteFile[1],
            {
                file: `${this.outputDir}/intervals_over_time.png`,
                data: await this.generateBuffer({ showIdealIntervalMs: true }),
                options: undefined,
            },
            'showIdealIntervalMs should default to true!'
        )
    }

    @test()
    protected static async canHideIdealIntervalMsLine() {
        const instance = await this.TimestampJitterGrapher({
            showIdealIntervalMs: false,
        })
        await instance.run()

        assert.isEqualDeep(
            callsToWriteFile[1],
            {
                file: `${this.outputDir}/intervals_over_time.png`,
                data: await this.generateBuffer({ showIdealIntervalMs: false }),
                options: undefined,
            },
            'showIdealIntervalMs: false should omit the red line!'
        )
    }

    @test()
    protected static async defaultsIgnoreInterpolatedTimestampsToFalse() {
        const hz = 4
        const nominalIntervalSec = 1 / hz

        const timestamps = [
            0,
            nominalIntervalSec,
            nominalIntervalSec * 2 + 0.005,
            nominalIntervalSec * 3 + 0.005,
        ]

        const stream = this.createFakeStream({
            channelCount: 1,
            nominalSampleRateHz: hz,
            timestamps,
            data: timestamps.map(() => [Math.random()]),
        })

        FakeXdfLoader.fakeResponse = { path: '', streams: [stream], events: [] }

        await this.run()

        const { intervalsMs } = JSON.parse(callsToWriteFile[0].data)
            .streamResults[0]

        assert.isEqual(
            intervalsMs.length,
            3,
            'Expected all intervals when ignoreInterpolatedTimestamps defaults to false!'
        )
    }

    @test()
    protected static async ignoresInterpolatedTimestampsWithFloatingPointDrift() {
        const hz = 52
        const nominalIntervalSec = 1 / hz

        // Simulate real-world interpolated timestamps that don't land exactly
        // on 1000/52 = 19.230769230769234 due to floating-point accumulation
        const interpolatedIntervalSec = 0.01923076924867928 // ≈ 19.23076924867928 ms

        const timestamps = [
            0,
            interpolatedIntervalSec, // interpolated → should be filtered
            interpolatedIntervalSec * 2, // interpolated → should be filtered
            interpolatedIntervalSec * 2 + nominalIntervalSec + 0.005, // jittered → kept
        ]

        const stream = this.createFakeStream({
            channelCount: 1,
            nominalSampleRateHz: hz,
            timestamps,
            data: timestamps.map(() => [Math.random()]),
        })

        FakeXdfLoader.fakeResponse = { path: '', streams: [stream], events: [] }

        const instance = await this.TimestampJitterGrapher({
            ignoreInterpolatedTimestamps: true,
        })
        await instance.run()

        const { intervalsMs } = JSON.parse(callsToWriteFile[0].data)
            .streamResults[0]

        assert.isEqual(
            intervalsMs.length,
            1,
            `Expected only the jittered interval to survive, got ${intervalsMs.length} intervals: ${JSON.stringify(intervalsMs)}`
        )
    }

    @test()
    protected static async ignoresInterpolatedTimestampsWhenEnabled() {
        const hz = 4
        const nominalIntervalSec = 1 / hz

        const timestamps = [
            0,
            nominalIntervalSec, // exact → filtered
            nominalIntervalSec * 2 + 0.005, // jittered → kept
            nominalIntervalSec * 3 + 0.005, // exact relative → filtered
        ]

        const stream = this.createFakeStream({
            channelCount: 1,
            nominalSampleRateHz: hz,
            timestamps,
            data: timestamps.map(() => [Math.random()]),
        })

        FakeXdfLoader.fakeResponse = { path: '', streams: [stream], events: [] }

        const instance = await this.TimestampJitterGrapher({
            ignoreInterpolatedTimestamps: true,
        })
        await instance.run()

        const { intervalsMs } = JSON.parse(callsToWriteFile[0].data)
            .streamResults[0]

        assert.isEqual(
            intervalsMs.length,
            1,
            `Expected only the jittered interval to survive, got ${intervalsMs.length} intervals!`
        )

        assert.isEqual(
            intervalsMs[0],
            (timestamps[2] - timestamps[1]) * 1000,
            'Expected the kept interval to be the jittered one!'
        )
    }

    @test()
    protected static async plotsFilteredIntervalsAtCorrectTimestamp() {
        const hz = 4
        const nominalIntervalSec = 1 / hz

        const timestamps = [
            0,
            nominalIntervalSec, // exact → filtered
            nominalIntervalSec * 2 + 0.005, // jittered → kept
            nominalIntervalSec * 3 + 0.005, // exact relative → filtered
        ]

        const stream = this.createFakeStream({
            channelCount: 1,
            nominalSampleRateHz: hz,
            timestamps,
            data: timestamps.map(() => [Math.random()]),
        })

        FakeXdfLoader.fakeResponse = { path: '', streams: [stream], events: [] }

        const instance = await this.TimestampJitterGrapher({
            ignoreInterpolatedTimestamps: true,
        })
        await instance.run()

        // The surviving interval should appear at x = timestamps[2] - timestamps[1]
        // (i.e. its actual position in the sliced timestamp array), not x = 0
        const survivingTimestampMs = (timestamps[2] - timestamps[1]) * 1000
        const survivingIntervalMs = (timestamps[2] - timestamps[1]) * 1000

        const expectedBuffer = await this.generateBufferFromData(
            [
                {
                    streamName: stream.name,
                    timeMs: survivingTimestampMs,
                    intervalMs: survivingIntervalMs,
                    idealMs: 1000 / hz,
                },
            ],
            true
        )

        assert.isEqualDeep(
            callsToWriteFile[1].data,
            expectedBuffer,
            'Filtered interval should be plotted at the correct timestamp, not at x=0!'
        )
    }

    @test()
    protected static async providesTotalSecsOptions() {
        const instance = await this.TimestampJitterGrapher({
            totalSecs: 1,
        })
        await instance.run()

        const streamResults = JSON.parse(callsToWriteFile[0].data).streamResults

        for (const streamResult of streamResults) {
            const numIntervals = streamResult.intervalsMs.length
            const expected = 1 * streamResult.nominalSampleRateHz

            assert.isTrue(
                numIntervals <= expected,
                `Stream result has too much data! Found ${numIntervals} intervals, expected maximum ${expected}.`
            )
        }
    }

    private static async run() {
        await this.instance.run()
    }

    private static async generateBufferFromData(
        data: {
            streamName: string
            timeSec?: number
            timeMs?: number
            intervalMs: number
            idealMs: number
        }[],
        useMs: boolean
    ) {
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
                layer: [
                    {
                        mark: { type: 'tick' as const, thickness: 2 },
                        encoding: {
                            x: {
                                field: useMs ? 'timeMs' : 'timeSec',
                                type: 'quantitative' as const,
                                title: useMs ? 'Time (ms)' : 'Time (s)',
                                axis: { tickMinStep: 1 },
                            },
                            y: {
                                field: 'intervalMs',
                                type: 'quantitative' as const,
                                title: 'ΔT = T(t+1) − T(t) (ms)',
                            },
                        },
                    },
                    {
                        mark: {
                            type: 'rule' as const,
                            color: 'red',
                            strokeWidth: 1,
                        },
                        encoding: {
                            y: {
                                field: 'idealMs',
                                type: 'quantitative' as const,
                                aggregate: 'mean' as const,
                            },
                        },
                    },
                ],
            },
            resolve: { scale: { x: 'shared' } },
        }

        const vgSpec = compile(vlSpec).spec
        const runtime = parse(vgSpec)
        const view = new View(runtime, { renderer: 'none' }).initialize()
        const canvas = await view.toCanvas()
        return canvas.toBuffer('image/png')
    }

    private static async generateBuffer(options?: JitterGrapherOptions) {
        const { xAxisUnits = 'milliseconds', showIdealIntervalMs = true } =
            options ?? {}

        const useMs = xAxisUnits === 'milliseconds'
        const data = this.flattenIntervalsForPlot(useMs)

        const tickLayer = {
            mark: { type: 'tick' as const, thickness: 2 },
            encoding: {
                x: {
                    field: useMs ? 'timeMs' : 'timeSec',
                    type: 'quantitative' as const,
                    title: useMs ? 'Time (ms)' : 'Time (s)',
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
                layer: showIdealIntervalMs
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

        return buffer
    }

    private static flattenIntervalsForPlot(useMs = true) {
        const rows: {
            streamName: string
            timeSec?: number
            timeMs?: number
            intervalMs: number
            idealMs: number
        }[] = []

        this.fakeStreams.forEach((stream, streamIndex) => {
            const { nominalSampleRateHz } = this.fakeStreamResults[streamIndex]

            const timestamps = stream.timestamps.slice(1)
            const maxIndex = this.oneSecond * nominalSampleRateHz
            const idealMs = 1000 / nominalSampleRateHz

            for (let i = 0; i < maxIndex; i++) {
                const intervalMs =
                    (stream.timestamps[i + 1] - stream.timestamps[i]) * 1000
                const delta = timestamps[i] - timestamps[0]
                rows.push({
                    streamName: stream.name,
                    ...(useMs ? { timeMs: delta * 1000 } : { timeSec: delta }),
                    intervalMs,
                    idealMs,
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
            const maxIndex = this.oneSecond * nominalSampleRateHz

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

    private static async TimestampJitterGrapher(
        options?: JitterGrapherOptions
    ) {
        return TimestampJitterGrapher.Create(
            this.xdfInputPath,
            this.outputDir,
            options
        )
    }
}
