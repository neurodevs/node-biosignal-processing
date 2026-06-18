import { randomInt } from 'node:crypto'
import {
    FirBandpassFilter,
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
    private static randomOptions: PpgDetectorOptions
    private static rawData: number[]
    private static timestamps: number[]

    protected static async beforeEach() {
        FirBandpassFilter.Class = SpyFirBandpassFilter

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
    protected static async runCallsDependenciesAsExpected() {
        this.run()

        assert.isEqual(SpyFirBandpassFilter.callsToRun.length, 1)
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
