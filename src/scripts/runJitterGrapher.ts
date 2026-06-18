import TimestampJitterGrapher from '../impl/TimestampJitterGrapher.js'

const grapher = await TimestampJitterGrapher.Create(
    './artifacts/test.xdf',
    './artifacts',
    { totalSecs: 1, xAxisUnits: 'milliseconds' }
)

await grapher.run()
