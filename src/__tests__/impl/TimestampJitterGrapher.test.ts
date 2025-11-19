import { randomInt } from 'crypto'
import { callsToWriteFile } from '@neurodevs/fake-node-core'
import generateId from '@neurodevs/generate-id'
import { test, assert } from '@neurodevs/node-tdd'
import { FakeXdfLoader, XdfStream } from '@neurodevs/node-xdf'
import { Data } from 'plotly.js-dist-min'

import TimestampJitterGrapher, {
    JitterGrapher,
} from '../../impl/TimestampJitterGrapher.js'
import FakePlotly from '../../testDoubles/Plotly/FakePlotly.js'
import { resetCallsToPlotlyToImage } from '../../testDoubles/Plotly/FakePlotly.js'
import AbstractPackageTest from '../AbstractPackageTest.js'

export default class TimestampJitterGrapherTest extends AbstractPackageTest {
    private static instance: JitterGrapher

    protected static async beforeEach() {
        await super.beforeEach()

        this.setFakeXdfLoader()
        this.setFakeWriteFile()

        FakeXdfLoader.fakeResponse = this.fakeXdfFile

        this.setFakeToImage()

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
    protected static async generatesJitterPlot() {
        await this.run()

        assert.isEqualDeep(
            callsToWriteFile[1],
            {
                file: `${this.outputDir}/jitter.png`,
                data: await this.generatePngBuffer(),
                options: undefined,
            },
            'Did not generate jitter plot PNG file!'
        )
    }

    private static async generatePngBuffer() {
        const traces = this.fakeStreams.map((stream) => {
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

        let layout = {
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

        const pngBuffer = await FakePlotly.toImage(
            { data: traces, layout },
            {
                format: 'png',
                width: 1000,
                height: 600,
            }
        )

        return pngBuffer
    }

    private static async run() {
        await this.instance.run()
    }

    public static createFakeStream(options?: Partial<XdfStream>): XdfStream {
        return {
            id: randomInt(1, 10),
            name: generateId(),
            type: generateId(),
            channelCount: randomInt(1, 10),
            channelFormat: 'float32',
            nominalSampleRateHz: 100 * Math.random(),
            data: [],
            timestamps: Array.from(
                { length: 10 },
                (_, i) => i + (Math.random() - 0.5) * 0.1
            ),
            ...options,
        }
    }

    private static readonly xdfInputPath = this.generateId()
    private static readonly outputDir = this.generateId()

    private static readonly fakeStreams = [
        this.createFakeStream(),
        this.createFakeStream(),
    ]

    private static readonly fakeXdfFile = {
        path: '',
        streams: this.fakeStreams,
        events: [],
    }

    private static readonly resultsJsonPath = `${this.outputDir}/results.json`

    private static get resultsJson() {
        return {
            xdfInputPath: this.xdfInputPath,
            outputDir: this.outputDir,
            resultsJsonPath: this.resultsJsonPath,
            streams: this.fakeStreamsMetadata,
        }
    }

    private static get fakeStreamsMetadata() {
        return this.fakeStreams.map(
            ({ data: _data, timestamps: _timestamps, ...rest }) => rest
        )
    }

    private static setFakeToImage() {
        TimestampJitterGrapher.toImage = FakePlotly.toImage.bind(this)
        resetCallsToPlotlyToImage()
    }

    private static async TimestampJitterGrapher() {
        return TimestampJitterGrapher.Create(this.xdfInputPath, this.outputDir)
    }
}
