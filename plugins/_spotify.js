import { spotifySearch, spotifyDownload } from '../lib/scraper/spotify.js'

export default {
    cmd: ['spotify', 'play'],
    category: 'downloader',
    run: async (m, { sock, text, config }) => {
        if (!text) return m.reply('Masukkan judul lagu atau link Spotify!\nContoh: .play blue seol')

        m.reply('⌛ Sedang memproses Spotify...')

        try {
            let trackUrl = text;
            let info;

            if (!/open\.spotify\.com\/track\//.test(text)) {
                const search = await spotifySearch(text, 1);
                if (!search.length) return m.reply('Lagu tidak ditemukan.');
                trackUrl = search[0].url;
                info = search[0];
            }

            const data = await spotifyDownload(trackUrl);

            let caption = `⌗ *Spotify Downloader*\n\n`
            caption += `› *Judul:* ${data.title}\n`
            caption += `› *Artis:* ${data.artist}\n\n`
            caption += `> *${config.botName}*`

            await sock.sendButton(m.from, {
                image: data.cover,
                text: caption,
                footer: config.botName,
                buttons: []
            }, { quoted: m })

            await sock.sendMessage(m.from, { 
                audio: { url: data.downloadUrl }, 
                mimetype: 'audio/mpeg',
                fileName: `${data.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: data.title,
                        body: data.artist,
                        mediaType: 1,
                        thumbnailUrl: data.cover,
                        sourceUrl: trackUrl
                    }
                }
            }, { quoted: m })

        } catch (e) {
            console.error(e)
            m.reply('Terjadi kesalahan saat memproses Spotify. Pastikan link benar atau coba lagi nanti.')
        }
    }
}