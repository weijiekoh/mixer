require('module-alias/register')

import * as Ajv from 'ajv'

const genValidator = (
    name: string,
) => {
    const ajv = new Ajv()
    const schema = require(`@mixer-backend/schemas/${name}.json`)
    const validate: Ajv.ValidateFunction = ajv.compile(schema)

    return validate
}

export { genValidator }
