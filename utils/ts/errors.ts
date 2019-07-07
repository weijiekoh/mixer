import { VError } from 'verror'

enum MixerErrorNames {
    BACKEND_ECHO_EMPTY_MSG = 'BACKEND_ECHO_EMPTY_MSG',
}

interface MixerError {
    name: MixerErrorNames
    message: string
    cause?: any
}

const genError = (
    name: MixerErrorNames,
    message: string,
    cause?: any,
) => {

    return new VError({
        name,
        message,
        cause
    })
}

export {
    MixerErrorNames,
    MixerError,
    genError,
}
