import { exec } from 'child_process'
import util from 'util'

export default {
    cmd: ['>', '>>', '$'],
    category: 'owner',
    run: async (m, { sock, text, isOwner, jid, config }) => {
        if (!isOwner) return
        
        const jid_ = jid 
        const sock_ = sock

        const parseEval = (input) => {
            const isStatement = /^\s*(const|let|var|if|for|while|switch|try|return)\b/.test(input)
            return isStatement ? input : `return ${input}`
        }

        if (m.body.startsWith('>>')) {
            try {
                let evalTarget = m.body.slice(2).trim()
                if (!evalTarget) return m.adReply("Kodenya mana?")
                
                let result = await eval(`(async () => {
                    try {
                        ${parseEval(evalTarget)}
                    } catch (e) {
                        return e
                    }
                })()`)

                if (typeof result !== 'string') result = util.inspect(result, { depth: 5 })
                m.adReply(result)
            } catch (e) {
                m.adReply(util.format(e))
            }
        } else if (m.body.startsWith('>')) {
            try {
                let evalTarget = m.body.slice(1).trim()
                if (!evalTarget) return m.adReply("Kodenya mana?")
                
                let result = eval(`(() => {
                    try {
                        ${parseEval(evalTarget)}
                    } catch (e) {
                        return e
                    }
                })()`)
                
                if (typeof result !== 'string') result = util.inspect(result, { depth: 5 })
                m.adReply(result)
            } catch (e) {
                m.adReply(util.format(e))
            }
        } else if (m.body.startsWith('$')) {
            let execTarget = m.body.slice(1).trim()
            if (!execTarget) return m.adReply("Perintahnya mana?")
            exec(execTarget, (err, stdout) => {
                if (err) return m.adReply(util.format(err))
                if (stdout) m.adReply(stdout.trim())
            })
        }
    }
}