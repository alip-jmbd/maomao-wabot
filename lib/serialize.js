import { getContentType, jidNormalizedUser } from '@whiskeysockets/baileys'
import { saveContact, saveMetadata, syncGroupParticipants, getLidMapping } from './database.js'
import config from '../config.js'
import util from 'util'

export async function serialize(sock, m) {
    if (!m) return m
    
    if (m.key) {
        m.id = m.key.id
        m.from = m.key.remoteJid
        m.jid = m.from
        m.isGroup = m.from.endsWith('@g.us')
        m.isNewsletter = m.from.endsWith('@newsletter')
        
        let jid, lid
        if (m.isGroup) {
            lid = m.key.participant
            jid = m.key.participantAlt
        } else {
            lid = m.key.remoteJid
            jid = m.key.remoteJidAlt
        }

        if (lid && !jid && lid.endsWith('@s.whatsapp.net')) jid = lid
        if (lid && lid.endsWith('@lid') && !jid) {
            const mapped = await getLidMapping(lid)
            if (mapped) jid = mapped
        }

        m.sender = jid ? jidNormalizedUser(jid) : jidNormalizedUser(lid)
        m.senderLid = lid && lid.endsWith('@lid') ? lid : null
    }

    if (m.message) {
        m.type = getContentType(m.message)
        if (m.type === 'ephemeralMessage' || m.type === 'viewOnceMessageV2') {
            m.message = m.message[m.type].message
            m.type = getContentType(m.message)
        }

        m.body = (m.type === 'conversation' ? m.message.conversation 
               : m.type === 'extendedTextMessage' ? m.message.extendedTextMessage.text 
               : m.type === 'imageMessage' ? m.message.imageMessage.caption 
               : m.type === 'videoMessage' ? m.message.videoMessage.caption 
               : '') || ''
        
        m.arg = m.body.trim().split(/ +/) || []
        m.text = m.arg.slice(1).join(" ")
        m.expiration = m.message[m.type]?.contextInfo?.expiration || 0
        
        m.quoted = m.message[m.type]?.contextInfo?.quotedMessage || null
        if (m.quoted) {
            m.quoted.type = getContentType(m.quoted)
            m.quoted.id = m.message[m.type].contextInfo.stanzaId
            
            let qRaw = m.message[m.type].contextInfo.participant
            let qAlt = m.message[m.type].contextInfo.participantAlt
            let qJid = qAlt || (qRaw?.endsWith('@s.whatsapp.net') ? qRaw : null)
            let qLid = qRaw?.endsWith('@lid') ? qRaw : null

            if (qLid && !qJid) {
                const qMapped = await getLidMapping(qLid)
                if (qMapped) qJid = qMapped
            }
            
            m.quoted.sender = qJid ? jidNormalizedUser(qJid) : jidNormalizedUser(qRaw)
            m.quoted.lid = qLid
        }
    }

    m.isAdmin = false
    m.isBotAdmin = false

    if (m.isGroup) {
        const metadata = await sock.groupMetadata(m.from).catch(() => null)
        if (metadata) {
            m.groupName = metadata.subject
            const participants = metadata.participants || []
            const botJid = jidNormalizedUser(sock.user.id)
            
            m.isAdmin = participants.find(p => jidNormalizedUser(p.id) === m.sender || jidNormalizedUser(p.phoneNumber) === m.sender)?.admin !== null
            m.isBotAdmin = participants.find(p => jidNormalizedUser(p.id) === botJid || jidNormalizedUser(p.phoneNumber) === botJid)?.admin !== null
            
            setImmediate(async () => {
                await saveMetadata(m.from, metadata.subject, metadata.desc?.toString(), metadata.participants)
                await syncGroupParticipants(m.from, metadata.participants)
            })
        }
    }

    setImmediate(async () => {
        if (m.sender && m.sender.endsWith('@s.whatsapp.net') && !m.key.fromMe) {
            await saveContact(m.sender, m.senderLid, m.pushName)
        }
    })

    const ownerNumbers = config.ownerNumber.map(n => n.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    m.isOwner = ownerNumbers.includes(m.sender)

    m.reply = (text, options = {}) => {
        let content = typeof text === 'object' ? util.inspect(text) : (text || "Selesai.")
        let mentions = [...String(content).matchAll(/@(\d+)/g)].map(v => v[1] + '@s.whatsapp.net')
        return sock.sendMessage(m.from, { 
            text: String(content), 
            mentions: options.mentions || mentions,
            contextInfo: { expiration: m.expiration } 
        }, { quoted: m, ...options })
    }

    return m
}