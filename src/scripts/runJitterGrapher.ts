import TimestampJitterGrapher from '../impl/TimestampJitterGrapher.js'

const grapher = await TimestampJitterGrapher.Create(
    './artifacts/muse_data.xdf',
    './artifacts/',
    {
        totalSecs: 1,
        xAxisUnits: 'milliseconds',
        ignoreInterpolatedTimestamps: false,
        showIdealIntervalMs: true,
    }
)

await grapher.run()
