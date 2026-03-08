export default {
    cmd: ['del', 'delete'],
    category: 'admin',
    run: async (m, { sock, isAdmin, isBotAdmin, config }) => {
        if (!m.isGroup) return m.adReply('Fitur ini hanya dapat digunakan di dalam grup.')
        if (!isAdmin) return m.adReply('Hanya admin yang dapat menggunakan perintah ini.')
        if (!m.quoted) return m.adReply('Reply pesan yang ingin dihapus!')

        if (!m.quoted.fromMe && !isBotAdmin) return m.adReply('Bot harus menjadi admin untuk menghapus pesan member lain.')

        try {
            await sock.sendMessage(m.from, {
                delete: {
                    remoteJid: m.from,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id,
                    participant: m.quoted.sender
                }
            })
        } catch (e) {
            console.error(e)
            m.adReply('Gagal menghapus pesan. Pastikan bot adalah admin.')
        }
    }
}