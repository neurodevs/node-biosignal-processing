import {
    detectPeaks,
    DetectPeaksFn,
    DetectPeaksResults,
    firBandpassFilter,
    FirBandpassFilterFn,
    FirBandpassFilterOptions,
} from '@neurodevs/node-signal-processing'

export default class PpgPeakDetector implements PpgDetector {
    public static Class?: PpgDetectorConstructor
    public static firBandpassFilter: FirBandpassFilterFn = firBandpassFilter
    public static detectPeaks: DetectPeaksFn = detectPeaks

    protected sampleRate: number
    protected lowCutoffHz: number
    protected highCutoffHz: number
    protected numTaps: number
    protected attenuation: number
    private filterOptions: FirBandpassFilterOptions

    protected constructor(options: PpgDetectorOptions) {
        let {
            sampleRate,
            lowCutoffHz = 0.4,
            highCutoffHz = 4.0,
            numTaps,
            attenuation = 50,
        } = options

        this.sampleRate = sampleRate
        this.lowCutoffHz = lowCutoffHz
        this.highCutoffHz = highCutoffHz
        this.numTaps = numTaps ?? this.generateNumTaps(sampleRate)
        this.attenuation = attenuation

        this.filterOptions = {
            sampleRate,
            lowCutoffHz,
            highCutoffHz,
            numTaps: this.numTaps,
            attenuation,
            usePadding: true,
        }
    }

    public static Create(options: PpgDetectorOptions) {
        return new (this.Class ?? this)(options)
    }

    public run(rawSignal: readonly number[], timestamps: readonly number[]) {
        const rawSignalWithoutFirstSample = rawSignal.slice(1)
        const timestampsWithoutFirstSample = timestamps.slice(1)

        const filtered = PpgPeakDetector.firBandpassFilter(
            rawSignalWithoutFirstSample,
            this.filterOptions
        )

        const result = PpgPeakDetector.detectPeaks(
            filtered,
            timestampsWithoutFirstSample
        )

        return {
            ...result,
            rawSignal: rawSignalWithoutFirstSample,
        }
    }

    private generateNumTaps(sampleRate: number) {
        return 4 * Math.floor(sampleRate) + 1
    }
}

export interface PpgDetector {
    run(
        rawSignal: readonly number[],
        timestamps: readonly number[]
    ): PpgPeakDetectorResults
}

export type PpgDetectorConstructor = new (
    options: PpgDetectorOptions
) => PpgDetector

export interface PpgDetectorOptions {
    sampleRate: number
    lowCutoffHz?: number
    highCutoffHz?: number
    numTaps?: number
    attenuation?: number
}

export interface PpgPeakDetectorResults extends DetectPeaksResults {
    rawSignal: number[]
}
