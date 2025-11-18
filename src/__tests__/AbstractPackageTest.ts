import AbstractModuleTest from '@neurodevs/node-tdd'
import { XdfFileLoader, FakeXdfLoader } from '@neurodevs/node-xdf'

export default abstract class AbstractPackageTest extends AbstractModuleTest {
    protected static async beforeEach() {
        await super.beforeEach()

        this.setFakeXdfLoader()
    }

    protected static setFakeXdfLoader() {
        XdfFileLoader.Class = FakeXdfLoader
        FakeXdfLoader.resetTestDouble()
    }
}
