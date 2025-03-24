import { finalizeEvent } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import { SimplePool } from 'nostr-tools/pool'

class Nostr {
    constructor(relays, privateKey) {
        const { data } = nip19.decode(privateKey)
        this.relays = relays.split(',')
        this.secretKey = data
    }
    
    async post(text, fileBuffer) {
        const pool = new SimplePool()

        var content = text
        fileBuffer.forEach((file) => {
            content += `\n${file.url}`
        })
        const eventTemplate = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: content,
        }

        const signedEvent = finalizeEvent(eventTemplate, this.secretKey)
        await Promise.all(pool.publish(this.relays, signedEvent)).catch(e => console.error(e))

        pool.destroy()
    }
}

export default Nostr
