import fs from 'fs'
import { PassThrough } from 'stream'
import ffmpeg from 'fluent-ffmpeg'
import crypto from 'crypto'
import { Readable } from 'stream'
import WebP from 'node-webpmux'
import { 
    proto, 
    generateWAMessageFromContent, 
    prepareWAMessageMedia, 
    generateWAMessage,
    generateMessageID
} from '@whiskeysockets/baileys'

export const groupCache = new Map()

export const convertToOpus = (input) => {
    return new Promise((resolve, reject) => {
        const output = new PassThrough()
        const buffers =[]
        
        const source = Buffer.isBuffer(input) ? Readable.from(input) : input

        ffmpeg(source)
            .audioCodec('libopus')
            .audioChannels(1)
            .audioFrequency(16000)
            .toFormat('opus')
            .addOutputOptions(['-avoid_negative_ts make_zero', '-map_metadata -1'])
            .on('error', (err) => reject(err))
            .pipe(output)

        output.on('data', (chunk) => buffers.push(chunk))
        output.on('end', () => resolve(Buffer.concat(buffers)))
    })
}

export default async function wrapSocket(sock) {
    const oldSendMessage = sock.sendMessage
    sock.generateMessageID = generateMessageID

    sock.sendMessage = async (jid, content, options = {}) => {
        if (!jid || !content) return
        if (!content.contextInfo) content.contextInfo = {}
        if (typeof jid === 'string' && jid.endsWith('@g.us')) {
            const duration = groupCache.get(jid)
            if (duration) content.contextInfo.expiration = duration
        }
        return await oldSendMessage.call(sock, jid, content, options)
    }

    sock.sendImage = async (jid, path, caption = '', quoted = '', options = {}) => {
        let payload = typeof path === 'string' && path.startsWith('http') ? { url: path } : Buffer.isBuffer(path) ? path : { url: path }
        return await sock.sendMessage(jid, { image: payload, caption: String(caption), ...options }, { quoted })
    }

    sock.sendVideo = async (jid, path, caption = '', quoted = '', gif = false, options = {}) => {
        let payload = typeof path === 'string' && path.startsWith('http') ? { url: path } : Buffer.isBuffer(path) ? path : { url: path }
        return await sock.sendMessage(jid, { video: payload, caption: String(caption), gifPlayback: gif, ...options }, { quoted })
    }

    sock.sendAudio = async (jid, path, ptt = false, quoted = '', options = {}) => {
        try {
            let source = typeof path === 'string' && path.startsWith('http') ? path : Buffer.isBuffer(path) ? path : path
            if (ptt) {
                const buffer = await convertToOpus(source)
                return await sock.sendMessage(jid, { audio: buffer, ptt: true, mimetype: 'audio/ogg; codecs=opus', ...options }, { quoted })
            }
            return await sock.sendMessage(jid, { audio: typeof source === 'string' ? { url: source } : source, ptt: false, mimetype: 'audio/mpeg', ...options }, { quoted })
        } catch (e) {
            console.error(e)
        }
    }

    sock.sendAlbum = async (jid, items =[], options = {}) => {
        if (!sock.user?.id) throw new Error("User not authenticated")
        const messageSecret = crypto.randomBytes(32)
        const messageContent = {
            messageContextInfo: { messageSecret },
            albumMessage: {
                expectedImageCount: items.filter(a => a.image).length,
                expectedVideoCount: items.filter(a => a.video).length,
            }
        }
        const album = generateWAMessageFromContent(jid, messageContent, {
            userJid: sock.user.id,
            upload: sock.waUploadToServer,
            quoted: options.quoted || null,
            ephemeralExpiration: options.quoted?.expiration || 0,
        })
        await sock.relayMessage(album.key.remoteJid, album.message, { messageId: album.key.id })
        for (const content of items) {
            const mediaSecret = crypto.randomBytes(32)
            const mediaMsg = await generateWAMessage(album.key.remoteJid, content, {
                upload: sock.waUploadToServer,
                ephemeralExpiration: options.quoted?.expiration || 0,
            })
            mediaMsg.message.messageContextInfo = {
                messageSecret: mediaSecret,
                messageAssociation: { associationType: 1, parentMessageKey: album.key }
            }
            await sock.relayMessage(mediaMsg.key.remoteJid, mediaMsg.message, { messageId: mediaMsg.key.id })
        }
        return album
    }

    sock.sendCard = async (jid, options = {}) => {
        const { text = "", footer = "", cards =[], quoted = null } = options
        let carouselCards =[]
        for (let i = 0; i < cards.length; i++) {
            const item = cards[i]
            let mediaInput = typeof item.image === 'string' ? { url: item.image } : item.image
            const img = await prepareWAMessageMedia({ image: mediaInput }, { upload: sock.waUploadToServer })
            carouselCards.push({
                header: proto.Message.InteractiveMessage.Header.fromObject({
                    title: item.caption || "",
                    hasMediaAttachment: true,
                    ...img
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                    buttons: Array.isArray(item.buttons) ? item.buttons :[]
                }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: footer })
            })
        }
        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: { text },
                        carouselMessage: { cards: carouselCards }
                    })
                }
            }
        }, { userJid: sock.user.id, quoted })
        return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
    }

    sock.sendButton = async (jid, content = {}, options = {}) => {
        const { text = "", footer = "", title = "", buttons =[], image, video } = content
        const processedButtons = buttons.map((btn, i) => {
            if (btn.name && btn.buttonParamsJson) return btn
            return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text || btn.displayText || `Button ${i + 1}`,
                    id: btn.id || `id_${i + 1}`
                })
            }
        })
        let header = { title, hasMediaAttachment: false }
        if (image || video) {
            const media = await prepareWAMessageMedia({[image ? 'image' : 'video']: typeof (image || video) === 'string' ? { url: (image || video) } : (image || video) 
            }, { upload: sock.waUploadToServer })
            header = { title, hasMediaAttachment: true, ...media }
        }
        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: { text: text || content.caption || "" },
                        footer: { text: footer },
                        header: header,
                        nativeFlowMessage: { buttons: processedButtons },
                        contextInfo: {
                            mentionedJid: options.mentions ||[],
                            ...options.contextInfo
                        }
                    })
                }
            }
        }, { userJid: sock.user.id, quoted: options.quoted || null })
        await sock.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
            additionalNodes:[{
                tag: "biz",
                attrs: {},
                content:[{
                    tag: "interactive",
                    attrs: { type: "native_flow", v: "1" },
                    content:[{
                        tag: "native_flow", attrs: { v: "9", name: "mixed" }
                    }]
                }]
            }]
        })
        return msg
    }
    
    sock.sendSticker = async (jid, buffer, quoted = '', options = {}) => {
        const packname = options.packname || 'Kaguya - Hime !'
        const author = options.author || 'cosmic princess kaguya'
        const isVideo = options.isAnimated || false

        return new Promise((resolve, reject) => {
            const tempFileIn = `./temp_${Date.now()}_in.${isVideo ? 'mp4' : 'jpg'}`
            const tempFileOut = `./temp_${Date.now()}_out.webp`

            fs.writeFileSync(tempFileIn, buffer)

            let args =[
                "-vcodec", "libwebp",
                "-vf", "scale='min(512,iw)':'min(512,ih)',pad=512:512:(512-iw)/2:(512-ih)/2:color=white@0",
                "-loop", "0",
                "-an"
            ]

            if (isVideo) {
                args.push("-preset", "default", "-t", "00:00:05", "-r", "15", "-qscale", "20")
            } else {
                args.push("-preset", "default", "-qscale", "70")
            }

            ffmpeg(tempFileIn)
                .addOutputOptions(args)
                .toFormat('webp')
                .save(tempFileOut)
                .on('end', async () => {
                    try {
                        let webpBuffer = fs.readFileSync(tempFileOut)
                        
                        const img = new WebP.Image()
                        await img.load(webpBuffer)
                        
                        const json = { "sticker-pack-id": `yuuki-${Date.now()}`, "sticker-pack-name": packname, "sticker-pack-publisher": author, "emojis": ["🚀"] }
                        const exifHeader = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
                        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
                        const exif = Buffer.concat([exifHeader, jsonBuffer])
                        exif.writeUIntLE(jsonBuffer.length, 14, 4)
                        
                        img.exif = exif
                        let finalBuffer = await img.save(null)
                        
                        let res = await sock.sendMessage(jid, { sticker: finalBuffer, ...options }, { quoted })
                        
                        fs.unlinkSync(tempFileIn)
                        fs.unlinkSync(tempFileOut)
                        resolve(res)
                    } catch (e) {
                        if (fs.existsSync(tempFileIn)) fs.unlinkSync(tempFileIn)
                        if (fs.existsSync(tempFileOut)) fs.unlinkSync(tempFileOut)
                        reject(e)
                    }
                })
                .on('error', (err) => {
                    if (fs.existsSync(tempFileIn)) fs.unlinkSync(tempFileIn)
                    if (fs.existsSync(tempFileOut)) fs.unlinkSync(tempFileOut)
                    reject(err)
                })
        })
    }


    return sock
}