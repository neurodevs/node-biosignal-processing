import generateId from '@neurodevs/generate-id'
import {
    FakeSubplotGrapher,
    SubplotGrapher,
} from '@neurodevs/node-server-plots'
import { test, assert } from '@neurodevs/node-tdd'

import PpgPeakPlotter, { PpgPlotter } from '../../impl/PpgPeakPlotter.js'
import AbstractPackageTest from '../AbstractPackageTest.js'
import { PpgPeakDetectorResults } from '../../impl/PpgPeakDetector.js'

export default class PpgPeakPlotterTest extends AbstractPackageTest {
    private static instance: PpgPlotter
    private static savePath: string
    private static signals: PpgPeakDetectorResults
    private static signalLength: number

    protected static async beforeEach() {
        await super.beforeEach()

        SubplotGrapher.Class = FakeSubplotGrapher
        FakeSubplotGrapher.resetTestDouble()

        this.savePath = `${generateId()}.plot.png`
        this.signalLength = 4

        this.signals = {
            rawSignal: this.generateRandomArray(this.signalLength),
            filteredSignal: this.generateRandomArray(this.signalLength),
            timestamps: this.generateRandomArray(this.signalLength),
            upperAnalyticSignal: this.generateRandomArray(this.signalLength),
            upperEnvelope: this.generateRandomArray(this.signalLength),
            lowerAnalyticSignal: this.generateRandomArray(this.signalLength),
            lowerEnvelope: this.generateRandomArray(this.signalLength),
            thresholdedSignal: this.generateRandomArray(this.signalLength),
            nonZeroSegments: [],
            peaks: [],
        } as unknown as PpgPeakDetectorResults

        this.instance = this.PpgPeakPlotter()
    }

    @test()
    protected static async createsInstance() {
        assert.isTruthy(this.instance, 'Failed to create instance!')
    }

    @test()
    protected static async callsSubplotGrapherWithRequiredOptions() {
        await this.run()

        assert.isEqualDeep(FakeSubplotGrapher.callsToConstructor[0], {
            subplotHeight: 600,
            subplotWidth: 4000,
        })

        assert.isEqualDeep(FakeSubplotGrapher.callsToGenerate[0], {
            savePath: this.savePath,
            plotConfigs: this.plotConfigs as any,
        })
    }

    private static async run() {
        await this.instance.run(this.savePath, this.signals)
    }

    private static generateRandomArray(length: number) {
        return Array.from({ length }, () => Math.random())
    }

    private static get plotConfigs() {
        const minTimestamp = Math.min(...this.timestamps)

        const normalizedTimestamps = this.timestamps.map(
            (timestamp) => (timestamp - minTimestamp) / 1000
        )

        const {
            rawDataset,
            filteredDataset,
            upperEnvelopeDataset,
            lowerEnvelopeDataset,
            thresholdedDataset,
        } = this.generateDatasets(normalizedTimestamps)

        const peakTimestamps = this.signals.peaks.map((peak) =>
            ((peak.timestamp - minTimestamp) / 1000)?.toString()
        )

        return [
            {
                title: 'Raw PPG Signal',
                datasets: [rawDataset],
            },
            {
                title: 'Filtered PPG Signal (0.4-4 Hz Bandpass)',
                datasets: [filteredDataset],
            },
            {
                title: 'Upper Envelope (Hilbert)',
                datasets: [filteredDataset, upperEnvelopeDataset],
            },
            {
                title: 'Lower Envelope (Hilbert)',
                datasets: [
                    filteredDataset,
                    upperEnvelopeDataset,
                    lowerEnvelopeDataset,
                ],
            },
            {
                title: 'Thresholded PPG Signal by Lower Envelope',
                datasets: [thresholdedDataset, lowerEnvelopeDataset],
            },
            {
                title: 'Peak Detection on Thresholded Signal',
                datasets: [thresholdedDataset],
                verticalLines: peakTimestamps,
            },
            {
                title: 'Peak Detection on Raw Signal',
                datasets: [rawDataset],
                verticalLines: peakTimestamps,
            },
        ]
    }

    private static generateDatasets(normalizedTimestamps: number[]) {
        const formattedRawSignal = this.formatSignal(
            this.rawSignal,
            normalizedTimestamps
        )
        const formattedFilteredSignal = this.formatSignal(
            this.filteredSignal,
            normalizedTimestamps
        )
        const formattedUpperEnvelope = this.formatSignal(
            this.upperEnvelope,
            normalizedTimestamps
        )
        const formattedLowerEnvelope = this.formatSignal(
            this.lowerEnvelope,
            normalizedTimestamps
        )
        const formattedThresholdedSignal = this.formatSignal(
            this.thresholdedSignal,
            normalizedTimestamps
        )

        return {
            rawDataset: {
                label: 'Raw PPG Signal',
                data: formattedRawSignal,
                color: 'cornflowerblue',
            },
            filteredDataset: {
                label: 'Filtered PPG Signal',
                data: formattedFilteredSignal,
                color: 'cornflowerblue',
            },
            upperEnvelopeDataset: {
                label: 'Upper Envelope',
                data: formattedUpperEnvelope,
                color: 'forestgreen',
            },
            lowerEnvelopeDataset: {
                label: 'Lower Envelope',
                data: formattedLowerEnvelope,
                color: 'goldenrod',
            },
            thresholdedDataset: {
                label: 'Thresholded PPG Signal',
                data: formattedThresholdedSignal,
                color: 'salmon',
            },
        }
    }

    private static formatSignal(signal: number[], timestamps: number[]) {
        return signal.map((value, i) => {
            return {
                x: timestamps[i].toString(),
                y: value,
            }
        })
    }

    private static get rawSignal() {
        return this.signals.rawSignal
    }

    private static get filteredSignal() {
        return this.signals.filteredSignal
    }

    private static get upperEnvelope() {
        return this.signals.upperEnvelope
    }

    private static get lowerEnvelope() {
        return this.signals.lowerEnvelope
    }

    private static get thresholdedSignal() {
        return this.signals.thresholdedSignal
    }

    private static get timestamps() {
        return this.signals.timestamps
    }

    private static PpgPeakPlotter() {
        return PpgPeakPlotter.Create()
    }
}
