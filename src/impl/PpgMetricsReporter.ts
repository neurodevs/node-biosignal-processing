import { DataPoint } from '@neurodevs/node-signal-processing'

import PpgPeakDetector, { PpgPeakDetectorResults } from './PpgPeakDetector.js'

export default class PpgMetricsReporter implements PpgReporter {
    public static Class?: PpgReporterConstructor

    protected sampleRate: number
    protected ignoreRrIntervalOverPercentDifferent: number
    protected detector: PpgPeakDetector

    protected constructor(options: PpgReporterOptions) {
        const { sampleRate, ignoreRrIntervalThresholdPercent = 25 } = options
        this.sampleRate = sampleRate

        this.detector = PpgPeakDetector.Create({ sampleRate })
        this.ignoreRrIntervalOverPercentDifferent =
            ignoreRrIntervalThresholdPercent
    }

    public static Create(options: PpgReporterOptions) {
        return new (this.Class ?? this)(options)
    }

    public run(signal: number[], timestamps: number[]): PpgReporterResults {
        const middleIdx = Math.floor(signal.length / 2)

        const signalFirstHalf = signal.slice(0, middleIdx)
        const timestampsFirstHalf = timestamps.slice(0, middleIdx)

        const signalSecondHalf = signal.slice(middleIdx)
        const timestampsSecondHalf = timestamps.slice(middleIdx)

        const { result, rrIntervals, hrvMean, hrMean } = this.calculateMetrics(
            signal,
            timestamps
        )

        const { hrvMean: hrvMeanFirstHalf, hrMean: hrMeanFirstHalf } =
            this.calculateMetrics(signalFirstHalf, timestampsFirstHalf)

        const { hrvMean: hrvMeanSecondHalf, hrMean: hrMeanSecondHalf } =
            this.calculateMetrics(signalSecondHalf, timestampsSecondHalf)

        const hrvPercentChange = this.calculatePercentChange(
            hrvMeanFirstHalf,
            hrvMeanSecondHalf
        )

        const hrPercentChange = this.calculatePercentChange(
            hrMeanFirstHalf,
            hrMeanSecondHalf
        )

        return {
            signals: result,
            metrics: {
                rrIntervals,
                hrvMean,
                hrMean,
                hrvPercentChange,
                hrPercentChange,
            },
        }
    }
    private calculatePercentChange(
        meanFirstHalf: number,
        meanSecondHalf: number
    ) {
        return ((meanSecondHalf - meanFirstHalf) / meanFirstHalf) * 100
    }

    private calculateMetrics(signal: number[], timestamps: number[]) {
        const result = this.detector.run(signal, timestamps)
        const { peaks } = result

        const rrIntervals = this.calculateRrIntervals(peaks)
        const hrvMean = this.calculateHeartRateVariability(rrIntervals)
        const hrMean = this.calculateHeartRate(rrIntervals)
        return { result, rrIntervals, hrvMean, hrMean }
    }

    private calculateRrIntervals(peaks: DataPoint[]): number[] {
        const result = new Array(peaks.length - 1)

        peaks.forEach((peak, index) => {
            if (index === 0) {
                return
            }

            const previousPeak = peaks[index - 1]
            result[index - 1] = peak.timestamp - previousPeak.timestamp
        })

        return result
    }

    protected calculateHeartRateVariability(rrIntervals: number[]) {
        const squaredDifferences: number[] = []

        for (let i = 1; i < rrIntervals.length; i++) {
            const current = rrIntervals[i]
            const previous = rrIntervals[i - 1]

            const diff = this.calculateAbsDifference(previous, current)

            if (diff < this.ignoreRrIntervalOverPercentDifferent) {
                const squaredDifference = Math.pow(current - previous, 2)
                squaredDifferences.push(squaredDifference)
            }
        }

        let meanSquaredDifference =
            squaredDifferences.reduce((acc, curr) => acc + curr, 0) /
            squaredDifferences.length

        return Math.sqrt(meanSquaredDifference)
    }

    private calculateAbsDifference(a: number, b: number) {
        return (100 * Math.abs(a - b)) / a
    }

    private calculateHeartRate(rrIntervals: number[]) {
        let validRrIntervals: number[] = []

        for (let i = 1; i < rrIntervals.length; i++) {
            const current = rrIntervals[i]
            const previous = rrIntervals[i - 1]

            const diff = this.calculateAbsDifference(previous, current)

            if (diff < this.ignoreRrIntervalOverPercentDifferent) {
                validRrIntervals.push(current)
            }
        }
        let totalMs = validRrIntervals.reduce((acc, curr) => acc + curr, 0)
        let avgRr = totalMs / validRrIntervals.length

        const secondsPerMinute = 60
        const msPerSecond = 1000
        const beatsPerMinute = (secondsPerMinute * msPerSecond) / avgRr

        return beatsPerMinute
    }
}

export interface PpgReporter {
    run(signal: number[], timestamps: number[]): PpgReporterResults
}

export type PpgReporterConstructor = new (
    options: PpgReporterOptions
) => PpgReporter

export interface PpgReporterOptions {
    sampleRate: number
    ignoreRrIntervalThresholdPercent?: number
}

export interface PpgReporterResults {
    signals: PpgPeakDetectorResults
    metrics: PpgMetrics
}

export interface PpgMetrics {
    rrIntervals: number[]
    hrvMean: number
    hrvPercentChange: number
    hrMean: number
    hrPercentChange: number
}
