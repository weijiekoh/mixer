import { VError } from 'verror'

enum MixerErrorNames {
    BACKEND_ECHO_MSG_BLANK = 'BACKEND_ECHO_MSG_BLANK',
    BACKEND_MIX_PROOF_INVALID = 'BACKEND_MIX_PROOF_INVALID',
    BACKEND_MIX_SIGNAL_INVALID = 'BACKEND_MIX_SIGNAL_INVALID',
    BACKEND_MIX_SIGNAL_HASH_INVALID = 'BACKEND_MIX_SIGNAL_HASH_INVALID',
    BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID = 'BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID',
}

const errorCodes = {
    ECHO_MSG_BLANK: -32000,
    MIX_PROOF_INVALID: -33000,
    MIX_SIGNAL_INVALID: -33001,
    MIX_SIGNAL_HASH_INVALID: -33002,
    MIX_SIGNAL_AND_SIGNAL_HASH_INVALID: -33003,
}

interface MixerError {
    name: MixerErrorNames
    message: string
    cause?: any
}

/*
 * Convenience function to create and return a VError
 */
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
    errorCodes,
}
