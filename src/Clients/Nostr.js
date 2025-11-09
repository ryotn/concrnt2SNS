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

        const flags = fileBuffer.map((file) => file.flag).filter(v => v).join(',')
        let tags = []
        if (flags.length > 0) {
            tags.push(["content-warning", flags])
        }
        let content = text
        fileBuffer.forEach((file) => {
            content += `\n${file.url}`
        })
        const eventTemplate = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: content,
        }

        const signedEvent = finalizeEvent(eventTemplate, this.secretKey)
        const promises = pool.publish(this.relays, signedEvent)
        const results = await Promise.allSettled(promises)

        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.error(`Failed to publish to relay ${this.relays[i]}:`, result.reason)
            }
        })

        pool.destroy()
    }
}

export default Nostr
