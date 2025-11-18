import AbstractModuleTest from '@neurodevs/node-tdd'

export default abstract class AbstractPackageTest extends AbstractModuleTest {
    protected static async beforeEach() {
        await super.beforeEach()
    }
}
