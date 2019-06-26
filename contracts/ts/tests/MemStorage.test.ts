declare var assert: any
import MemStorage from '../utils/memStorage'

describe('MemStorage', async () => {
    const storage = new MemStorage()

    it('should put() and get() values', async () => {
        const key = 'a'
        const value = 123
        await storage.put(key, value)
        assert.equal(await storage.get(key), value)
    })

    it('should del() values correctly', async () => {
        const key = 'b'
        await storage.put(key, 2)
        await storage.del(key)
        const v = await storage.get(key)
        assert.isUndefined(v)
    })

    it('should put_batch() values correctly', async () => {
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
})
