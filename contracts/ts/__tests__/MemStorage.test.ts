declare var assert: any
import { MemStorage } from 'mixer-crypto'

describe('MemStorage', async () => {
    const storage = new MemStorage()

    it('put() and get()', async () => {
        const key = 'a'
        const value = 123
        await storage.put(key, value)
        assert.equal(await storage.get(key), value)
    })

    it('del()', async () => {
        const key = 'b'
        await storage.put(key, 2)
        await storage.del(key)
        const v = await storage.get(key)
        assert.isUndefined(v)
    })

    it('put_batch()', async () => {
        await storage.put_batch(
            [
                { key: 'c', value: 3 },
                { key: 'd', value: 4 },
                { key: 'e', value: 5 },
            ]
        )
        const v = await storage.get('c')
        assert.equal(v, 3)
    })

    it('get_or_element()', async () => {
        const key = 'f'
        const value = 6
        await storage.put(key, value)
        const element = 'g'
        assert.equal(await storage.get_or_element(key, element), value)
        assert.equal(await storage.get_or_element('none', element), element)
    })
})
