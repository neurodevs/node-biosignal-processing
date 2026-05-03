import PpgMetricsReporter, {
    PpgReporterOptions,
} from '../../impl/PpgMetricsReporter.js'

export default class SpyPpgMetricsReporter extends PpgMetricsReporter {
    public constructor(options: PpgReporterOptions) {
        super(options)
    }

    public getSampleRate() {
        return this.sampleRate
    }

    public getDetector() {
        return this.detector
    }

    public calculateHeartRateVariability(rrIntervals: number[]) {
        return super.calculateHeartRateVariability(rrIntervals)
    }
}
