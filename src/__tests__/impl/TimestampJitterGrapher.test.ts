import { randomInt } from 'crypto'
import { callsToWriteFile } from '@neurodevs/fake-node-core'
import generateId from '@neurodevs/generate-id'
import { test, assert } from '@neurodevs/node-tdd'
import { FakeXdfLoader, XdfStream } from '@neurodevs/node-xdf'

import TimestampJitterGrapher, {
    JitterGrapher,
} from '../../impl/TimestampJitterGrapher.js'
import AbstractPackageTest from '../AbstractPackageTest.js'

export default class TimestampJitterGrapherTest extends AbstractPackageTest {
    private static instance: JitterGrapher

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

    private static async run() {
        await this.instance.run()
    }

    public static createFakeStream(options?: Partial<XdfStream>): XdfStream {
        const channelCount = randomInt(1, 10)

        return {
            id: randomInt(1, 10),
            name: generateId(),
            type: generateId(),
            channelCount,
            channelFormat: 'float32',
            nominalSampleRateHz: 100 * Math.random(),
            data: Array.from({ length: 10 }, (_, i) =>
                Array.from(
                    { length: channelCount },
                    () => i + (Math.random() - 0.5)
                )
            ),
            timestamps: Array.from(
                { length: 10 },
                (_, i) => i + (Math.random() - 0.5)
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

    private static readonly fakeStreamsMetadata = this.fakeStreams.map(
        ({ data: _data, timestamps: _timestamps, ...rest }) => rest
    )

    private static readonly resultsJson = {
        xdfInputPath: this.xdfInputPath,
        outputDir: this.outputDir,
        resultsJsonPath: this.resultsJsonPath,
        streams: this.fakeStreamsMetadata,
    }

    private static async TimestampJitterGrapher() {
        return TimestampJitterGrapher.Create(this.xdfInputPath, this.outputDir)
    }
}
