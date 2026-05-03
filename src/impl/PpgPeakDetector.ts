import {
    HilbertPeakDetector,
    FirBandpassFilter,
    PeakDetector,
    Filter,
    PeakDetectorResults,
} from '@neurodevs/node-signal-processing'

export default class PpgPeakDetector implements PpgDetector {
    public static Class?: PpgDetectorConstructor

    protected sampleRate: number
    protected lowCutoffHz: number
    protected highCutoffHz: number
    protected numTaps: number
    protected attenuation: number
    private filter: Filter
    private detector: PeakDetector

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

        this.filter = FirBandpassFilter.Create({
            sampleRate,
            lowCutoffHz,
            highCutoffHz,
            numTaps: this.numTaps,
            attenuation,
            usePadding: true,
        })

        this.detector = HilbertPeakDetector.Create()

        debugger
    }

    public static Create(options: PpgDetectorOptions) {
        return new (this.Class ?? this)(options)
    }

    public run(rawSignal: number[], timestamps: number[]) {
        const rawSignalWithoutFirstSample = rawSignal.slice(1)
        const timestampsWithoutFirstSample = timestamps.slice(1)

        const filtered = this.filter.run(rawSignalWithoutFirstSample)
        const result = this.detector.run(filtered, timestampsWithoutFirstSample)

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
    run(rawSignal: number[], timestamps: number[]): PpgPeakDetectorResults
}

export type PpgDetectorConstructor = new (
    options: PpgDetectorOptions
) => PpgPeakDetector

export interface PpgDetectorOptions {
    sampleRate: number
    lowCutoffHz?: number
    highCutoffHz?: number
    numTaps?: number
    attenuation?: number
}

export interface PpgPeakDetectorResults extends PeakDetectorResults {
    rawSignal: number[]
}
