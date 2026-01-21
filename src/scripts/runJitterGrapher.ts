import TimestampJitterGrapher from '../impl/TimestampJitterGrapher.js'

const grapher = await TimestampJitterGrapher.Create(
    './artifacts/test.xdf',
    './artifacts'
)

await grapher.run()
