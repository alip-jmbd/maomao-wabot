import { downloadContentFromMessage } from '@whiskeysockets/baileys'

export default {
    cmd: ['s', 'sticker', 'stiker'],
    category: 'tools',
    run: async (m, { sock, text, config }) => {
        let q = m.quoted ? m.quoted : m
        let type = q.type
        let mediaMsg = q === m.quoted ? q[type] : m.message[type]

        if (/ephemeral|viewOnce/.test(type)) {
            const innerType = Object.keys(mediaMsg.message || mediaMsg)[0]
            mediaMsg = (mediaMsg.message || mediaMsg)[innerType]
            type = innerType
        }

        let mime = mediaMsg?.mimetype || ''

        if (/image|video|webp/.test(mime)) {
            await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } })

            try {
                let downloadType = type.includes('image') ? 'image' : type.includes('video') ? 'video' : type.includes('sticker') ? 'sticker' : ''
                
                const stream = await downloadContentFromMessage(mediaMsg, downloadType)
                let buffer = Buffer.from([])
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

                let [pack, auth] = text.split('|')
                
                await sock.sendSticker(m.from, buffer, m, {
                    packname: pack || 'Kaguya Hime !',
                    author: auth || 'cosmic princess kaguya',
                    isAnimated: /video|gif/.test(mime)
                })

                await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } })

            } catch (e) {
                console.error(e)
                await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } })
                m.adReply('Gagal membuat stiker.', config.title, 'Error', config.thumbnail1, config.sourceUrl)
            }
        } else {
            m.adReply('Kirim atau reply gambar/video dengan caption *.s*', config.title, 'Sticker Tool', config.thumbnail1, config.sourceUrl)
        }
    }
}