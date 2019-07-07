import { errors } from 'mixer-utils'
import errorCodes from './errorCodes'

const echo = (params: any) => {
    if (params.message !== '') {
        return {
            message: params.message
        }
    } else {
        const errorMsg = 'the message param cannot be blank'
        throw {
            code: errorCodes.echoMsgBlank,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_ECHO_EMPTY_MSG,
                errorMsg,
            )
        }
    }
}
export default echo
