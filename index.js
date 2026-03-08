import makeWASocket, { 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    jidDecode
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import fs from 'fs'
import readline from 'readline'
import chalk from 'chalk'
import { loadPlugins, getPlugin, reloadPlugin } from './lib/plugins.js'
import { serialize } from './lib/serialize.js'
import wrapSocket, { groupCache } from './lib/helper.js'
import config from './config.js'
import { saveMessage, loadMessage, saveMetadata, syncGroupParticipants, getGroupSettings, getContact, getLidMapping } from './lib/database.js'

const originLog = console.log
console.log = (...args) => {
    const msg = args[0]
    if (typeof msg === 'string' && msg.includes('Closing session: SessionEntry')) return
    if (typeof msg === 'string' && msg.includes('remoteIdentityKey')) return
    if (msg && typeof msg === 'object' && msg.remoteIdentityKey) return
    if (msg && typeof msg === 'object' && msg._chains) return
    originLog(...args)
}

const decodeJid = (jid) => {
    if (!jid) return jid
    if (typeof jid !== 'string') return jid.id || jid.jid || jid
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {}
        return decode.user && decode.server && decode.user + '@' + decode.server || jid
    } else return jid
}

const startBot = async () => {
    await loadPlugins()
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const { version } = await fetchLatestBaileysVersion()
    
    const silentLogger = pino({ level: 'silent' })

    const sock = makeWASocket({
        version,
        logger: silentLogger,
        printQRInTerminal: !config.usePairingCode,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, silentLogger)
        },
        browser:['Ubuntu', 'Chrome', '20.0.04'],
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            return await loadMessage(key.remoteJid, key.id) || undefined
        }
    })

    await wrapSocket(sock)

    if (config.usePairingCode && !sock.authState.creds.registered) {
        console.log(chalk.yellow('Menunggu inisialisasi...'))
        await new Promise(resolve => setTimeout(resolve, 2000))
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        const phoneNumber = await new Promise(resolve => rl.question(chalk.bgMagenta.white.bold(' Masukan Nomer Bot: '), resolve))
        rl.close()
        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber.trim())
            console.log(chalk.black(chalk.bgCyanBright(` Pairing Code: ${code} `)))
        }, 3000)
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'open') {
            console.log(chalk.greenBright.bold('Kaguya - hime Connected !'))
            const groups = await sock.groupFetchAllParticipating()
            for (const id in groups) {
                const meta = groups[id]
                if (meta.ephemeralDuration) groupCache.set(id, meta.ephemeralDuration)
                await saveMetadata(id, meta.subject, meta.desc?.toString(), meta.participants)
                await syncGroupParticipants(id, meta.participants)
            }
        }
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) startBot()
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu
        if (!['add', 'remove'].includes(action)) return

        try {
            const metadata = await sock.groupMetadata(id)
            await saveMetadata(id, metadata.subject, metadata.desc?.toString(), metadata.participants)
            await syncGroupParticipants(id, metadata.participants)

            const settings = await getGroupSettings(id)
            if (action === 'add' && !settings.welcome) return
            if (action === 'remove' && !settings.goodbye) return

            const botJid = jidNormalizedUser(sock.user.id)
            const now = new Date()
            const time = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(now)
            const date = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)

            for (let item of participants) {
                let jid = decodeJid(item)
                if (jid === botJid) continue

                if (jid.endsWith('@lid')) {
                    const found = metadata.participants.find(p => p.id === jid)
                    if (found && found.phoneNumber) {
                        jid = found.phoneNumber
                    } else {
                        const mapped = await getLidMapping(jid)
                        if (mapped) jid = mapped
                    }
                }
                jid = jidNormalizedUser(jid)

                let dbContact = await getContact(jid)
                let pushName = (dbContact && dbContact.pushname && dbContact.pushname !== 'null') ? dbContact.pushname : jid.split('@')[0]
                
                let ppUser
                try {
                    ppUser = await Promise.race([
                        sock.profilePictureUrl(jid, 'image'),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
                    ]).catch(() => sock.profilePictureUrl(jid, 'preview').catch(() => sock.profilePictureUrl(id, 'image')))
                } catch {
                    ppUser = config.thumbnail1
                }

                let text = action === 'add' ? settings.welcomeText : settings.goodbyeText
                if (text) {
                    text = String(text).replace(/@pushname/g, `@${jid.split('@')[0]}`)
                    text = text.replace(/@nama/g, String(pushName))
                    text = text.replace(/@gcname/g, String(metadata.subject))
                    text = text.replace(/@desk/g, String(metadata.desc?.toString() || 'Tidak ada deskripsi'))
                    text = text.replace(/@date/g, String(date))
                    text = text.replace(/@jam/g, String(time))

                    await sock.sendButton(id, {
                        image: ppUser || config.thumbnail1,
                        text: text,
                        footer: config.botName,
                        buttons: []
                    }, { mentions:[jid] })
                }
            }
        } catch (e) {
            console.error('Error GP Update:', e)
        }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        const m = await serialize(sock, messages[0])
        if (!m || !m.message) return

        const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })
        
        console.log(`[ ${m.isGroup ? chalk.yellowBright.bold('GC') : chalk.greenBright.bold('PC')} ][ ${chalk.whiteBright(time + ' WIB')} ]`)
        if (m.isGroup) {
            console.log(`${chalk.magentaBright('›')} ${chalk.whiteBright.bold(m.groupName || 'Loading...')}`)
            console.log(`${chalk.magentaBright('›')} ${chalk.yellowBright(m.from)}`)
        }
        console.log(`${chalk.magentaBright('›')} ${chalk.cyanBright(m.sender)} ${chalk.whiteBright('~')} ${chalk.blueBright(m.senderLid || 'no-lid')}`)
        console.log(`${chalk.magentaBright('›')} ${chalk.greenBright.bold(m.pushName || 'User')}`)
        console.log(`${chalk.magentaBright('›')} ${chalk.yellowBright(m.type)}`)
        console.log(`${chalk.magentaBright('›')} ${chalk.whiteBright('message:')} ${chalk.cyanBright(m.body || 'Media Content')}`)
        console.log(chalk.cyanBright('· · ─ ·𖥸· ─ · ·'))

        saveMessage(m, type)

        if (m.isOwner && (m.body.startsWith('>>') || m.body.startsWith('>') || m.body.startsWith('$'))) {
            const ownerPlugin = getPlugin('>')
            if (ownerPlugin) return await ownerPlugin.run(m, { 
                sock, 
                config, 
                text: m.text, 
                isOwner: m.isOwner,
                jid: m.from
            })
        }

        const cmd = m.body.trim().split(/ +/).shift().toLowerCase()
        const plugin = getPlugin(cmd)
        if (plugin) {
            try {
                await plugin.run(m, { 
                    sock, 
                    config, 
                    text: m.text,
                    jid: m.from,
                    isOwner: m.isOwner,
                    isAdmin: m.isAdmin,
                    isBotAdmin: m.isBotAdmin
                })
            } catch (e) {
                console.error(chalk.red(e))
            }
        }
    })
}

startBot()

const pluginDebounce = new Map()

const watchPlugins = (dir) => {
    fs.watch(dir, { recursive: true }, async (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            if (pluginDebounce.has(filename)) clearTimeout(pluginDebounce.get(filename))
            const timer = setTimeout(async () => {
                await reloadPlugin(filename)
                pluginDebounce.delete(filename)
            }, 100)
            pluginDebounce.set(filename, timer)
        }
    })
}
watchPlugins('./plugins')