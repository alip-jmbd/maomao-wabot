import { plugins } from '../lib/plugins.js'

export default {
    cmd: ['menu', 'allmenu', 'help'],
    category: 'main',
    run: async (m, { config, text }) => {
        const now = new Date()
        const optionsTime = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        let time = new Intl.DateTimeFormat('id-ID', optionsTime).format(now).replace(/:/g, '.')
        
        const optionsDate = { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        const date = new Intl.DateTimeFormat('id-ID', optionsDate).format(now)
        
        const hourStr = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(now)
        const hour = parseInt(hourStr)

        let greeting = ''
        if (hour >= 0 && hour < 11) greeting = 'Pagi ! 🌄'
        else if (hour >= 11 && hour < 15) greeting = 'Siang ! ☀️'
        else if (hour >= 15 && hour < 18) greeting = 'Sore ! 🌅'
        else greeting = 'Malam ! 🌙'

        const categories = {}
        let totalFeatures = 0
        
        for (const [file, plugin] of plugins) {
            const category = plugin.category || 'others'
            if (!categories[category]) categories[category] = []
            categories[category].push(plugin.cmd[0])
            totalFeatures++
        }

        const categoryList = Object.keys(categories).sort()
        const totalCategories = categoryList.length
        
        const isAllMenu = m.body.toLowerCase().includes('allmenu') || text.toLowerCase() === 'all'
        const selectedCategory = text.toLowerCase()
        const senderNumber = m.sender.split('@')[0]

        let caption = `Hi @${senderNumber},\n`
        caption += `Selamat ${greeting}\n`
        caption += `Aku *${config.botName}*, asisten virtual WhatsApp yang dibuat menggunakan nodejs oleh *LippWangsaff*.\n\n`
        
        caption += `⌗ *Tanggal:* ${date}\n`
        caption += `⌗ *Waktu:* ${time}\n`
        caption += `⌗ *Total Fitur:* ${totalFeatures}\n`
        caption += `⌗ *Total Kategori:* ${totalCategories}\n`
        caption += `⌗ *Prefix:* [ ., /, #, ! ]\n\n`

        if (isAllMenu) {
            caption += `📚 *Daftar Semua Menu*\n`
            for (const category of categoryList) {
                caption += `\n› *${category.charAt(0).toUpperCase() + category.slice(1)}* (${categories[category].length})\n`
                caption += categories[category].map(cmd => `.${cmd}`).join('\n') + '\n'
            }
        } else if (text && categories[selectedCategory]) {
            caption += `📚 *Kategori ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}*\n`
            caption += `\n› *${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}* (${categories[selectedCategory].length})\n`
            caption += categories[selectedCategory].map(cmd => `.${cmd}`).join('\n') + '\n'
        } else {
            caption += `📚 *Daftar Kategori*\n\n`
            for (const category of categoryList) {
                caption += `› *${category.charAt(0).toUpperCase() + category.slice(1)}* (${categories[category].length})\n`
            }
            caption += `\nKetik .allmenu untuk melihat semua perintah.\n`
            caption += `Ketik .menu <kategori> untuk melihat menu spesifik.\n`
        }

        caption = caption.trim() + `\n\n> *${config.botName}*`

        await m.reply(caption, { mentions: [m.sender] })
    }
}