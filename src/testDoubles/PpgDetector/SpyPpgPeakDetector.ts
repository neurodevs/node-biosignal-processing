import PpgPeakDetector, {
    PpgDetectorOptions,
} from '../../impl/PpgPeakDetector.js'

export default class SpyPpgPeakDetector extends PpgPeakDetector {
    public static callsToConstructor: PpgDetectorOptions[] = []

    public constructor(options: PpgDetectorOptions) {
        super(options)

        SpyPpgPeakDetector.callsToConstructor.push(options)
    }

    public getNumTaps() {
        return this.numTaps
    }

    public static resetTestDouble() {
        SpyPpgPeakDetector.callsToConstructor = []
    }
}
