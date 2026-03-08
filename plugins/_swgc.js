import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { convertToOpus } from '../lib/helper.js'

export default {
    cmd: ['swgc'],
    category: 'tools',
    run: async (m, { sock, isAdmin }) => {
        if (!m.isGroup) return m.adReply("Khusus di dalam grup!")
        if (!isAdmin) return m.adReply("Hanya admin grup yang bisa menggunakan perintah ini!")

        let type = m.quoted ? m.quoted.type : m.type
        let mediaMsg = m.quoted ? m.quoted[type] : m.message[type]

        if (/ephemeral|viewOnce/.test(type)) {
            const innerType = Object.keys(mediaMsg.message || mediaMsg)[0]
            mediaMsg = (mediaMsg.message || mediaMsg)[innerType]
            type = innerType
        }

        const mime = (mediaMsg?.mimetype || '')
        const isMedia = /image|video|audio/.test(mime)
        let text = m.text.trim()

        const colorMap = { 'biru': '0xff26c4dc', 'merah': '0xffff0000', 'hijau': '0xff00ff00', 'kuning': '0xffffff00', 'hitam': '0xff000000' }
        let bgColor = colorMap['biru']
        if (text.includes('--color:')) {
            let col = text.split('--color:')[1].trim().split(' ')[0]
            bgColor = colorMap[col] || `0xff${col.replace('#', '')}`
            text = text.replace(`--color:${col}`, '').replace('--color:', '').trim()
        }

        try {
            let content = { contextInfo: { isGroupStatus: true, remoteJid: m.from } }

            if (isMedia) {
                const downloadType = type.includes('image') ? 'image' : type.includes('video') ? 'video' : 'audio'
                const stream = await downloadContentFromMessage(mediaMsg, downloadType)
                let buffer = Buffer.from([])
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

                if (downloadType === 'audio') {
                    content.audio = await convertToOpus(buffer)
                    content.ptt = true
                    content.mimetype = 'audio/ogg; codecs=opus'
                    content.waveform = new Uint8Array(64).fill(10) 
                } else {
                    content[downloadType] = buffer
                    content.caption = text || undefined
                }
            } else {
                if (!text) return m.adReply("Teksnya mana?")
                content.text = text
            }

            await sock.sendMessage(m.from, content, { backgroundColor: bgColor })
            return m.adReply("Status Grup Berhasil Dikirim!")
        } catch (e) {
            console.error(e)
            m.adReply("Terjadi kesalahan.")
        }
    }
}