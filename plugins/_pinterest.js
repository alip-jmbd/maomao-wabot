import { pinterest } from '../lib/scraper/pinterest.js'

export default {
    cmd: ['pin', 'pinterest'],
    category: 'tools',
    run: async (m, { sock, text, config }) => {
        if (!text) return m.reply('Masukkan query pencarian!\nContoh: .pin kaguya 5')

        let args = text.split(' ')
        let lastArg = args[args.length - 1]
        let count = parseInt(lastArg)
        let query = text

        if (!isNaN(count)) {
            query = args.slice(0, -1).join(' ')
        } else {
            count = 1
        }
        
        if (count > 10) return m.reply('Maksimal 10 gambar.')

        m.reply('⌛ Sedang mencari gambar...')

        try {
            const results = await pinterest(query, count)
            if (!results.length) return m.reply('Gambar tidak ditemukan.')

            let caption = `⌗ *Pinterest Search*\n\n`
            caption += `› *Query:* ${query}\n`
            caption += `› *Jumlah:* ${results.length}\n\n`
            caption += `> *${config.botName}*`

            if (results.length === 1) {
                await sock.sendButton(m.from, {
                    image: results[0],
                    text: caption,
                    footer: config.botName,
                    buttons: []
                }, { quoted: m })
            } else {
                let album = results.map(url => ({ image: { url } }))
                await m.reply(caption)
                await sock.sendAlbum(m.from, album, { quoted: m })
            }

        } catch (e) {
            console.error(e)
            m.reply('Terjadi kesalahan saat mencari gambar.')
        }
    }
}