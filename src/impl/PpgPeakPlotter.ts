import { Grapher, SubplotGrapher } from '@neurodevs/node-server-plots'
import { PpgPeakDetectorResults } from './PpgPeakDetector.js'

export default class PpgPeakPlotter implements PpgPlotter {
    public static Class?: PpgPlotterConstructor

    private grapher: Grapher

    protected constructor() {
        this.grapher = PpgPeakPlotter.SubplotGrapher()
    }

    public static Create() {
        return new (this.Class ?? this)()
    }

    public async run(savePath: string, signals: PpgPeakDetectorResults) {
        const plotConfigs = this.generatePlotConfigs(signals)

        await this.grapher.generate({
            savePath,
            plotConfigs: plotConfigs as any,
        })
    }

    private generatePlotConfigs(signals: PpgPeakDetectorResults) {
        const { timestamps: timestampsInMs } = signals
        const minTimestampMs = Math.min(...timestampsInMs)

        const normalizedTimestamps = this.normalizeTimestamps(
            timestampsInMs,
            minTimestampMs
        )

        const peakTimestamps = signals.peaks.map((peak) =>
            ((peak.timestamp - minTimestampMs) / 1000)?.toString()
        )

        const {
            rawDataset,
            filteredDataset,
            upperEnvelopeDataset,
            lowerEnvelopeDataset,
            thresholdedDataset,
        } = this.generateDatasets(signals, normalizedTimestamps)

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

    private normalizeTimestamps(
        timestampsInMs: number[],
        minTimestampMs: number
    ) {
        const msPerSecond = 1000

        const normalizedTimestampsInSecs = timestampsInMs.map(
            (timestampMs) => (timestampMs - minTimestampMs) / msPerSecond
        )
        return normalizedTimestampsInSecs
    }

    private generateDatasets(
        signals: PpgPeakDetectorResults,
        normalizedTimestamps: number[]
    ) {
        const {
            rawSignal,
            filteredSignal,
            upperEnvelope,
            lowerEnvelope,
            thresholdedSignal,
        } = signals

        return {
            rawDataset: {
                label: 'Raw PPG Signal',
                data: this.formatSignal(rawSignal, normalizedTimestamps),
                color: 'cornflowerblue',
            },
            filteredDataset: {
                label: 'Filtered PPG Signal',
                data: this.formatSignal(filteredSignal, normalizedTimestamps),
                color: 'cornflowerblue',
            },
            upperEnvelopeDataset: {
                label: 'Upper Envelope',
                data: this.formatSignal(upperEnvelope, normalizedTimestamps),
                color: 'forestgreen',
            },
            lowerEnvelopeDataset: {
                label: 'Lower Envelope',
                data: this.formatSignal(lowerEnvelope, normalizedTimestamps),
                color: 'goldenrod',
            },
            thresholdedDataset: {
                label: 'Thresholded PPG Signal',
                data: this.formatSignal(
                    thresholdedSignal,
                    normalizedTimestamps
                ),
                color: 'salmon',
            },
        }
    }

    private formatSignal(signal: number[], timestamps: number[]) {
        return signal.map((value, i) => {
            return {
                x: timestamps[i]?.toString() ?? '',
                y: value,
            }
        })
    }

    private static readonly subplotHeight = 600
    private static readonly subplotWidth = 4000

    private static SubplotGrapher() {
        return SubplotGrapher.Create({
            subplotHeight: this.subplotHeight,
            subplotWidth: this.subplotWidth,
        })
    }
}

export interface PpgPlotter {
    run(savePath: string, signals: PpgPeakDetectorResults): Promise<void>
}

export type PpgPlotterConstructor = new () => PpgPlotter
