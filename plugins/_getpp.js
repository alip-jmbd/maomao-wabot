import { getLidMapping } from '../lib/database.js'

export default {
    cmd: ['getpp'],
    category: 'tools',
    run: async (m, { sock, text }) => {
        let target
        const mentioned = m.message[m.type]?.contextInfo?.mentionedJid?.[0]

        if (mentioned) {
            target = mentioned
        } else if (m.quoted) {
            target = m.quoted.sender
        } else if (text) {
            let input = text.replace(/[^0-9]/g, '')
            if (input.endsWith('@s.whatsapp.net')) {
                target = input
            } else if (input.endsWith('@lid')) {
                target = await getLidMapping(input)
            } else {
                target = input + '@s.whatsapp.net'
            }
        } else {
            target = m.sender
        }

        if (!target) return

        try {
            let url = await sock.profilePictureUrl(target, 'image').catch(() => null)
            
            if (!url) {
                url = await sock.profilePictureUrl(target, 'preview').catch(() => null)
            }

            if (url) {
                await sock.sendImage(m.from, url, '', m)
            } else {
                m.reply('Tidak ada foto profil.')
            }
        } catch (e) {
            m.reply('Gagal mengambil foto profil.')
        }
    }
}