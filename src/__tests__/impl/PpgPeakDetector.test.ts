import { randomInt } from 'node:crypto'
import {
    createFakeFirBandpassFilter,
    createSpyDetectPeaks,
    createSpyFirBandpassFilter,
    SpyDetectPeaks,
    SpyFirBandpassFilter,
} from '@neurodevs/node-signal-processing'
import { test, assert } from '@neurodevs/node-tdd'

import PpgPeakDetector, {
    PpgDetectorOptions,
} from '../../impl/PpgPeakDetector.js'
import SpyPpgPeakDetector from '../../testDoubles/PpgDetector/SpyPpgPeakDetector.js'
import AbstractPackageTest from '../AbstractPackageTest.js'

export default class PpgPeakDetectorTest extends AbstractPackageTest {
    private static randomDetector: SpyPpgPeakDetector
    private static randomOptions: Required<PpgDetectorOptions>
    private static rawData: number[]
    private static timestamps: number[]
    private static spyFilter: SpyFirBandpassFilter
    private static spyDetectPeaks: SpyDetectPeaks

    protected static async beforeEach() {
        this.spyFilter = createSpyFirBandpassFilter()
        PpgPeakDetector.firBandpassFilter = this.spyFilter

        this.spyDetectPeaks = createSpyDetectPeaks()
        PpgPeakDetector.detectPeaks = this.spyDetectPeaks

        PpgPeakDetector.Class = SpyPpgPeakDetector

        this.randomOptions = this.generateRandomOptions()
        this.randomDetector = this.PpgPeakDetector()

        this.rawData = [1, 2, 3, 4]
        this.timestamps = [4, 5, 6, 7]
    }

    @test('works with sampleRate: 100, numTaps: 401', 100, 401)
    @test('works with sampleRate: 100.5, numTaps: 401', 100.5, 401)
    protected static async numTapsEqualsSampleRateTimesFourPlusOne(
        sampleRate: number,
        expectedNumTaps: number
    ) {
        const detector = this.PpgPeakDetector({
            sampleRate,
            numTaps: undefined,
        })

        assert.isEqual(detector.getNumTaps(), expectedNumTaps)
    }

    @test()
    protected static async runFiltersRawSignalWithoutFirstSample() {
        this.run()

        assert.isEqualDeep(this.spyFilter.calledWith, [
            {
                signal: this.rawData.slice(1),
                options: {
                    ...this.randomOptions,
                    usePadding: true,
                },
            },
        ])
    }

    @test()
    protected static async runDetectsPeaksInFilteredSignal() {
        const filtered = [0.1, 0.2, 0.3]
        PpgPeakDetector.firBandpassFilter =
            createFakeFirBandpassFilter(filtered)

        this.run()

        assert.isEqualDeep(
            this.spyDetectPeaks.calledWith.map(
                ({ filteredSignal, timestamps }) => ({
                    filteredSignal,
                    timestamps,
                })
            ),
            [{ filteredSignal: filtered, timestamps: this.timestamps.slice(1) }]
        )
    }

    @test()
    protected static async runReturnsRawDataWithoutFirstSample() {
        const result = this.run()

        assert.isEqualDeep(result.rawSignal, this.rawData.slice(1))
        assert.isEqualDeep(result.timestamps, this.timestamps.slice(1))
    }

    private static run() {
        return this.randomDetector.run(this.rawData, this.timestamps)
    }

    private static generateRandomOptions() {
        return {
            sampleRate: 100 * Math.random(),
            lowCutoffHz: randomInt(1, 5) * Math.random(),
            highCutoffHz: 10 + randomInt(1, 5) * Math.random(),
            numTaps: this.generateValidNumTaps(),
            attenuation: 100 * Math.random(),
        }
    }

    private static generateValidNumTaps() {
        let numTaps = randomInt(51, 101)
        const numTapsIsOdd = numTaps % 2 !== 0

        if (!numTapsIsOdd) {
            numTaps++
        }
        return numTaps
    }

    private static PpgPeakDetector(options?: Partial<PpgDetectorOptions>) {
        return PpgPeakDetector.Create({
            ...this.randomOptions,
            ...options,
        }) as SpyPpgPeakDetector
    }
}
