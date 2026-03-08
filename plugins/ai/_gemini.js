const sessions = new Map()

export default {
    cmd: ['gemini', 'ai', 'istri'],
    category: 'ai',
    run: async (m, { text }) => {
        if (!text) return m.reply('Apa sih? Berisik banget, mau ngomong apa?')

        if (!sessions.has(m.sender)) {
            sessions.set(m.sender, [])
        }
        let history = sessions.get(m.sender)

        const payload = {
            system_instruction: {
                parts: [{ text: "kamu istriku tsundere imut kesukaan sama kucing, dan lucu, respond mu cuek" }]
            },
            contents: [
                ...history,
                {
                    role: "user",
                    parts: [{ text: text }]
                }
            ]
        }

        try {
            const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent", {
                method: 'POST',
                headers: {
                    'x-goog-api-key': 'AIzaSyCOK1DHxy9LgmscCYjPie3N-PRdRD5kk94',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            const data = await response.json()
            const result = data.candidates[0].content.parts[0].text

            history.push({ role: "user", parts: [{ text: text }] })
            history.push({ role: "model", parts: [{ text: result }] })

            if (history.length > 20) {
                history.splice(0, 2)
            }
            sessions.set(m.sender, history)

            m.reply(result)
        } catch (e) {
            m.reply('Lagi malas jawab. Sana hus-hus!')
        }
    }
}