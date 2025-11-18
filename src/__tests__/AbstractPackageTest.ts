import { writeFile } from 'fs/promises'
import { fakeWriteFile, resetCallsToWriteFile } from '@neurodevs/fake-node-core'
import AbstractModuleTest from '@neurodevs/node-tdd'
import { XdfFileLoader, FakeXdfLoader } from '@neurodevs/node-xdf'
import TimestampJitterGrapher from '../impl/TimestampJitterGrapher.js'

export default abstract class AbstractPackageTest extends AbstractModuleTest {
    protected static async beforeEach() {
        await super.beforeEach()
    }

    protected static setFakeWriteFile() {
        TimestampJitterGrapher.writeFile = fakeWriteFile as typeof writeFile
        resetCallsToWriteFile()
    }

    protected static setFakeXdfLoader() {
        XdfFileLoader.Class = FakeXdfLoader
        FakeXdfLoader.resetTestDouble()
    }
}
