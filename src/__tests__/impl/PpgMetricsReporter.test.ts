import { test, assert } from '@neurodevs/node-tdd'

import PpgMetricsReporter, {
    PpgReporterOptions,
} from '../../impl/PpgMetricsReporter.js'
import PpgPeakPlotter, { PpgPlotter } from '../../impl/PpgPeakPlotter.js'
import PpgPeakDetector from '../../impl/PpgPeakDetector.js'
import SpyPpgMetricsReporter from '../../testDoubles/PpgReporter/SpyPpgMetricsReporter.js'
import SpyPpgPeakDetector from '../../testDoubles/PpgDetector/SpyPpgPeakDetector.js'
import AbstractPackageTest from '../AbstractPackageTest.js'
import expectedOutput from '../testData/expectedOutput.js'
import loadPpgData from '../testData/loadPpgData.js'

export default class PpgMetricsReporterTest extends AbstractPackageTest {
    private static instance: SpyPpgMetricsReporter
    private static reporterOptions: PpgReporterOptions
    private static plotter: PpgPlotter

    private static shouldSavePngs = true

    protected static async beforeEach() {
        PpgPeakDetector.Class = SpyPpgPeakDetector
        SpyPpgPeakDetector.resetTestDouble()

        PpgMetricsReporter.Class = SpyPpgMetricsReporter

        this.reporterOptions = this.generateRandomReporterOptions()
        this.plotter = this.PpgPeakPlotter()

        this.instance = this.PpgMetricsReporter(this.reporterOptions)
    }

    @test()
    protected static async constructorCanOverridePpgPeakDetector() {
        SpyPpgPeakDetector.resetTestDouble()
        PpgMetricsReporter.Create(this.reporterOptions)
        assert.isEqual(SpyPpgPeakDetector.callsToConstructor.length, 1)
    }

    @test()
    protected static async hrvCalculationIgnoresRrIntervalOutliers() {
        // We want to ignore rr intervals 700 -> 1200 and 1100 -> 500
        const rrIntervals = [600, 700, 1200, 800, 500, 600, 700, 800]

        const result = this.instance.calculateHeartRateVariability(rrIntervals)
        assert.isEqual(result, 100)
    }

    @test(
        'Works with: ppg-example-4-subject-3.csv',
        'ppg-example-4-subject-3.csv'
    )
    @test(
        'Works with: ppg-example-3-subject-3.csv',
        'ppg-example-3-subject-3.csv'
    )
    @test(
        'Works with: ppg-example-2-subject-2.csv',
        'ppg-example-2-subject-2.csv'
    )
    @test(
        'Works with: ppg-example-1-subject-1.csv',
        'ppg-example-1-subject-1.csv'
    )
    protected static async runWorksWithActualPpgData(fileName: string) {
        const expected = expectedOutput.find((item) =>
            item.fileName.endsWith(fileName)
        ) as any

        const { values, timestamps } = await loadPpgData(fileName)
        const analyzer = new SpyPpgMetricsReporter({ sampleRate: 64 })
        const result = analyzer.run(values, timestamps)
        const { signals, metrics } = result
        const {
            rrIntervals,
            hrvMean,
            hrMean,
            hrvPercentChange,
            hrPercentChange,
        } = metrics

        if (this.shouldSavePngs) {
            await this.plotter.run(
                `src/__tests__/testData/${fileName}.plot.png`,
                signals
            )
        }

        assert.isTruthy(signals)
        assert.isTruthy(metrics)
        assert.isLength(rrIntervals, expected.numPeaks)
        assert.isEqualDeep(rrIntervals, expected.rrIntervals)
        assert.isEqual(hrvMean, expected.hrvMean)
        assert.isEqual(hrMean, expected.hrMean)
        assert.isEqual(hrvPercentChange, expected.hrvPercentChange)
        assert.isEqual(hrPercentChange, expected.hrPercentChange)
    }

    private static generateRandomReporterOptions() {
        return { sampleRate: 100 * Math.random() }
    }

    private static PpgMetricsReporter(options?: Partial<PpgReporterOptions>) {
        const defaultOptions = this.generateRandomReporterOptions()

        return PpgMetricsReporter.Create({
            ...defaultOptions,
            ...options,
        }) as SpyPpgMetricsReporter
    }

    private static PpgPeakPlotter() {
        return PpgPeakPlotter.Create()
    }
}
