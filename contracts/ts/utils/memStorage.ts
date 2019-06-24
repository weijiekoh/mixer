class MemStorage {
    private db = {}
    async get(key) {
        return Promise.resolve(this.db[key])
    }

    async get_or_element(key, element) {
        try {
            return Promise.resolve(this.db[key])
        } catch(err) {
            if (err.notFound) {
                return element;
            }

            throw err
        }
    }

    async put(key, value) {
        this.db[key] = value
    }

    async del(key) {
        delete this.db[key]
    }

    async put_batch(key_values) {
        let ops = [];
        for (var i = 0; i < key_values.length; i++) {
            await this.put(key_values[i].key, key_values[i].value)
        }
    }
}

export default MemStorage
