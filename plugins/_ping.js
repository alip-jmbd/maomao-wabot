export default {
    cmd: ['ping'],
    category: 'info',
    run: async (m, { sock, config }) => {
        const latency = Date.now() - m.messageTimestamp * 1000
        await m.adReply(`Pong! Latency: ${latency}ms\nBot: ${config.botName}`)
    }
}