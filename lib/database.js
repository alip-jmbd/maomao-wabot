import Database from 'better-sqlite3'
import config from '../config.js'

const db = new Database('database.db')

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        key_id TEXT PRIMARY KEY,
        remote_jid TEXT,
        id TEXT,
        from_me INTEGER,
        push_name TEXT,
        message TEXT,
        timestamp INTEGER,
        type TEXT
    );
    CREATE TABLE IF NOT EXISTS contacts (
        jid TEXT PRIMARY KEY,
        lid TEXT,
        pushname TEXT
    );
    CREATE TABLE IF NOT EXISTS lid_mapping (
        lid TEXT PRIMARY KEY,
        jid TEXT
    );
    CREATE TABLE IF NOT EXISTS groups (
        jid TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        members TEXT
    );
    CREATE TABLE IF NOT EXISTS group_settings (
        jid TEXT PRIMARY KEY,
        welcome INTEGER DEFAULT 1,
        goodbye INTEGER DEFAULT 1,
        welcome_text TEXT DEFAULT 'Hai @pushname, Selamat datang di @gcname!',
        goodbye_text TEXT DEFAULT 'Selamat tinggal @pushname, semoga tenang disana.'
    );
`)

export async function saveMessage(m, type) {
    if (!m || !m.key) return
    const key = `${m.key.remoteJid}:${m.key.id}`
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO messages (key_id, remote_jid, id, from_me, push_name, message, timestamp, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(key, m.key.remoteJid, m.key.id, m.key.fromMe ? 1 : 0, m.pushName || 'null', JSON.stringify(m.message), m.messageTimestamp, type)
}

export async function loadMessage(jid, id) {
    const key = `${jid}:${id}`
    const stmt = db.prepare('SELECT message FROM messages WHERE key_id = ?')
    const row = stmt.get(key)
    if (!row) return undefined
    return JSON.parse(row.message)
}

export async function saveContact(jid, lid, pushName) {
    if (!jid || !jid.endsWith('@s.whatsapp.net')) return
    
    const existing = db.prepare('SELECT pushname, lid FROM contacts WHERE jid = ?').get(jid)
    let finalName = pushName
    
    if (pushName === 'Unknown' || !pushName) {
        if (existing && existing.pushname && existing.pushname !== 'null') {
            finalName = existing.pushname
        } else {
            finalName = 'null'
        }
    }

    const finalLid = lid || (existing ? existing.lid : 'null')

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO contacts (jid, lid, pushname)
        VALUES (?, ?, ?)
    `)
    stmt.run(jid, finalLid, finalName)

    if (lid && lid.endsWith('@lid')) {
        const mapStmt = db.prepare('INSERT OR REPLACE INTO lid_mapping (lid, jid) VALUES (?, ?)')
        mapStmt.run(lid, jid)
    }
}

export async function getContact(jid) {
    return db.prepare('SELECT * FROM contacts WHERE jid = ?').get(jid)
}

export async function getLidMapping(lid) {
    const row = db.prepare('SELECT jid FROM lid_mapping WHERE lid = ?').get(lid)
    return row ? row.jid : null
}

export async function saveMetadata(jid, name, desc, participants = []) {
    if (!jid || (!jid.endsWith('@g.us') && !jid.endsWith('@newsletter'))) return
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO groups (jid, name, description, members)
        VALUES (?, ?, ?, ?)
    `)
    stmt.run(jid, name || 'null', desc || 'null', JSON.stringify(participants))
}

export async function syncGroupParticipants(jid, participants = []) {
    if (!jid || !participants.length) return
    const stmt = db.prepare('BEGIN TRANSACTION')
    try {
        stmt.run()
        for (const p of participants) {
            const userJid = p.phoneNumber || (p.id?.endsWith('@s.whatsapp.net') ? p.id : null)
            const userLid = p.id?.endsWith('@lid') ? p.id : null
            
            if (userJid) {
                saveContact(userJid, userLid, 'Unknown')
            }
        }
        db.prepare('COMMIT').run()
    } catch (error) {
        db.prepare('ROLLBACK').run()
    }
}

export async function getGroupSettings(jid) {
    let row = db.prepare('SELECT * FROM group_settings WHERE jid = ?').get(jid)
    if (!row) {
        db.prepare('INSERT INTO group_settings (jid) VALUES (?)').run(jid)
        row = { 
            welcome: 1, 
            goodbye: 1, 
            welcome_text: 'Hai @pushname, Selamat datang di @gcname!', 
            goodbye_text: 'Selamat tinggal @pushname, semoga tenang disana.' 
        }
    }
    return {
        welcome: row.welcome === 1,
        goodbye: row.goodbye === 1,
        welcomeText: row.welcome_text,
        goodbyeText: row.goodbye_text
    }
}

export async function updateGroupSettings(jid, field, value) {
    let col = ''
    if (field === 'welcome') col = 'welcome'
    else if (field === 'goodbye') col = 'goodbye'
    else if (field === 'welcomeText') col = 'welcome_text'
    else if (field === 'goodbyeText') col = 'goodbye_text'
    
    if (!col) return

    const check = db.prepare('SELECT jid FROM group_settings WHERE jid = ?').get(jid)
    if (!check) {
        db.prepare('INSERT INTO group_settings (jid) VALUES (?)').run(jid)
    }

    db.prepare(`UPDATE group_settings SET ${col} = ? WHERE jid = ?`).run(value, jid)
}