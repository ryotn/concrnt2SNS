import { Client, semantics } from '@concrnt/worldlib'
import { InMemoryAuthProvider, InMemoryKVS, LoadSubKey } from '@concrnt/client'
import Media from './Utils/Media.js'
import Twitter from './Clients/Twitter.js'
import AtProtocol from './Clients/AtProtocol.js'
import Threads from './Clients/Threads.js'
import Nostr from './Clients/Nostr.js'
import CCMsgAnalysis from './Utils/ConcrntMessageAnalysis.js'
import Logger from './Utils/Logger.js'

Logger.overrideConsole({ level: 'info', label: 'concrnt2SNS' })

const CC_SUBKEY = process.env.CC_SUBKEY

const TW_ENABLE = process.env.TW_ENABLE == "true"
const TW_API_KEY = process.env.TW_API_KEY
const TW_API_KEY_SECRET = process.env.TW_API_KEY_SECRET
const TW_ACCESS_TOKEN = process.env.TW_ACCESS_TOKEN
const TW_ACCESS_TOKEN_SECRET = process.env.TW_ACCESS_TOKEN_SECRET
const TW_WEBHOOK_URL = process.env.TW_WEBHOOK_URL
const TW_WEBHOOK_IMAGE_URL = process.env.TW_WEBHOOK_IMAGE_URL
const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN
const BUFFER_TWITTER_CHANNEL_ID = process.env.BUFFER_TWITTER_CHANNEL_ID
const TW_LISTEN_TIMELINE = process.env.TW_LISTEN_TIMELINE

const BS_ENABLE = process.env.BS_ENABLE == "true"
const BS_IDENTIFIER = process.env.BS_IDENTIFIER
const BS_APP_PASSWORD = process.env.BS_APP_PASSWORD
const BS_SERVICE = process.env.BS_SERVICE
const BS_LISTEN_TIMELINE = process.env.BS_LISTEN_TIMELINE

const THREADS_ENABLE = process.env.THREADS_ENABLE == "true"
const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN
const THREADS_LISTEN_TIMELINE = process.env.THREADS_LISTEN_TIMELINE

const NOSTR_ENABLE = process.env.NOSTR_ENABLE == "true"
const NOSTR_PRIVATE_KEY = process.env.NOSTR_PRIVATE_KEY
const NOSTR_RELAYS = process.env.NOSTR_RELAYS
const NOSTR_LISTEN_TIMELINE = process.env.NOSTR_LISTEN_TIMELINE

const LISTEN_TIMELINE = process.env.LISTEN_TIMELINE

const media = new Media()

// v2
const parsed = LoadSubKey(CC_SUBKEY)
if (!parsed) {
    console.error('Invalid CC_SUBKEY')
    process.exit(1)
}
const auth = new InMemoryAuthProvider(undefined, CC_SUBKEY)
const ccClient = await Client.create(parsed.domain, auth, new InMemoryKVS())

// v1
/*
const ccClient = await Client.createFromSubkey(CC_SUBKEY)
if (!ccClient) {
    console.error("Failed to create Concrnt client.")
    process.exit(1)
}*/
const twitterClient = TW_ENABLE && new Twitter(TW_API_KEY, TW_API_KEY_SECRET, TW_ACCESS_TOKEN, TW_ACCESS_TOKEN_SECRET, TW_WEBHOOK_URL, TW_WEBHOOK_IMAGE_URL, BUFFER_ACCESS_TOKEN, BUFFER_TWITTER_CHANNEL_ID)
const bskyClient = BS_ENABLE && await AtProtocol.build(BS_SERVICE, BS_IDENTIFIER, BS_APP_PASSWORD)
const threadsClient = THREADS_ENABLE && await Threads.create(THREADS_ACCESS_TOKEN)
const nosterClient = NOSTR_ENABLE && new Nostr(NOSTR_RELAYS, NOSTR_PRIVATE_KEY)
const ccMsgAnalysis = new CCMsgAnalysis()

const MAX_RECENT = 1000
const recentResourceIDs = new Map()
let homeTimeline = null

async function start() {
    const socket = await ccClient.newSocket()
    homeTimeline = LISTEN_TIMELINE || semantics.homeTimeline(ccClient.ccid, ccClient.currentProfile)

    socket.listen(
        [homeTimeline, TW_LISTEN_TIMELINE, BS_LISTEN_TIMELINE, THREADS_LISTEN_TIMELINE, NOSTR_LISTEN_TIMELINE].filter(Boolean),
        async (event) => {
            if (event.type !== 'created') return

            const docs = event.documents || {}
            for (const key of Object.keys(docs)) {

                const sd = docs[key]
                let parsedDoc
                try {
                    parsedDoc = JSON.parse(sd.document)
                } catch (err) {
                    console.error('Failed to parse signed document', err)
                    continue
                }

                if (!parsedDoc || typeof parsedDoc !== 'object') continue

                // unify shape: prefer parsedDoc.value (v2 record), fall back to parsedDoc itself
                const inner = parsedDoc.value ?? parsedDoc
                if (!inner || typeof inner !== 'object') continue

                // default resource id (may be overridden if we resolve an embedded reference)
                let resourceID = sd.ccfs ?? sd.cckv ?? key ?? event.uri

                // document will be filled either from inner or from an embedded reference
                let document = null

                // detect reference (reroute) documents
                const isReference = (parsedDoc.schema && String(parsedDoc.schema).includes('reference.json')) || (inner && typeof inner.href === 'string')
                if (isReference) {
                    const href = inner.href
                    const refs = sd.references ?? {}
                    let refKey = null
                    let refSD = null

                    if (href && refs[href]) {
                        refKey = href
                        refSD = refs[href]
                    } else if (href) {
                        for (const rk of Object.keys(refs)) {
                            if (rk === href || rk.endsWith(href)) {
                                refKey = rk
                                refSD = refs[rk]
                                break
                            }
                        }
                    }

                    // If there's no embedded referenced document, treat this as a reroute and skip
                    if (!refSD || !refSD.document) {
                        console.log('Reference without embedded target — treated as reroute; skipping')
                        continue
                    }

                    try {
                        const refParsed = JSON.parse(refSD.document)
                        const refInner = refParsed.value ?? refParsed
                        if (!refInner || typeof refInner !== 'object') {
                            console.log('Embedded referenced document invalid — skipping')
                            continue
                        }
                        document = {
                            ...refInner,
                            schema: refParsed.schema ?? refInner.schema,
                            timelines: refParsed.distributes ?? refInner.timelines ?? refInner.distributes ?? []
                        }
                        if (refKey) resourceID = refKey
                    } catch (err) {
                        console.error('Failed to parse referenced embedded document', err)
                        continue
                    }
                }

                // If not resolved from reference, use inner directly
                if (!document) {
                    document = {
                        ...inner,
                        schema: parsedDoc.schema ?? inner.schema,
                        timelines: parsedDoc.distributes ?? inner.timelines ?? inner.distributes ?? []
                    }
                }

                if (!Array.isArray(document.timelines)) document.timelines = []

                // filter by message schemas
                if (
                    document.schema !== 'https://schema.concrnt.world/m/plaintext.json' &&
                    document.schema !== 'https://schema.concrnt.world/m/markdown.json' &&
                    document.schema !== 'https://schema.concrnt.world/m/media.json'
                ) {
                    continue
                }

                const author = document.author ?? document.signer ?? parsedDoc.author ?? null
                if (author !== ccClient.ccid) continue

                if (!resourceID) resourceID = document.key ?? null
                if (!resourceID) continue

                // LRU 重複排除
                if (recentResourceIDs.has(resourceID)) continue

                recentResourceIDs.set(resourceID, Date.now())
                if (recentResourceIDs.size > MAX_RECENT) {
                    const oldest = recentResourceIDs.keys().next().value
                    recentResourceIDs.delete(oldest)
                }

                receivedPost(document)
            }
        }
    )
}


// v1
/*
async function start() {
    const subscription = await ccClient.newSocketListener()
    homeTimeline = LISTEN_TIMELINE || ccClient.user.homeTimeline

    subscription.on('MessageCreated', async (event) => {
        let document = event.parsedDoc
        let resourceID = event.item.resourceID
        if (!document) {
            try {
                let message = await ccClient.getMessage(resourceID, event.item.owner, event.item.timelineID.split('@')[1])
                if (!message || !message.document) {
                    console.error("Failed to fetch message or document for resourceID:", resourceID)
                    return
                }
                document = message.document
            } catch (err) {
                console.error("Error fetching message for resourceID:", resourceID, err)
                return
            }
        }
        if (document.signer !== ccClient.ccid) {
            return
        }
        if (lastMessageResourceID && lastMessageResourceID === resourceID) {
            return
        }
        lastMessageResourceID = resourceID
        receivedPost(document)
    })

    subscription.listen([homeTimeline, TW_LISTEN_TIMELINE, BS_LISTEN_TIMELINE, THREADS_LISTEN_TIMELINE, NOSTR_LISTEN_TIMELINE].filter(Boolean))
} 
*/

function receivedPost(document) {
    const body = document.body
    const text = ccMsgAnalysis.getPlaneText(body)
    const urls = ccMsgAnalysis.getURLs(text)
    const files = ccMsgAnalysis.getMediaFiles(body)

    const isPostTw = (TW_LISTEN_TIMELINE && document.timelines.includes(TW_LISTEN_TIMELINE)) || document.timelines.includes(homeTimeline)
    const isPostBs = (BS_LISTEN_TIMELINE && document.timelines.includes(BS_LISTEN_TIMELINE)) || document.timelines.includes(homeTimeline)
    const isPostThreads = (THREADS_LISTEN_TIMELINE && document.timelines.includes(THREADS_LISTEN_TIMELINE)) || document.timelines.includes(homeTimeline)
    const isPostNostr = (NOSTR_LISTEN_TIMELINE && document.timelines.includes(NOSTR_LISTEN_TIMELINE)) || document.timelines.includes(homeTimeline)

    document.medias?.forEach(media => {
        files.push({
            url: media.mediaURL,
            type: media.mediaType.split("/")[0],
            flag: media.flag? media.flag : undefined
        })
    })

    if (text.length > 0 || files.length > 0) {
        media.downloader(files)
            .then(async filesBuffer => {
                const postTasks = []
                if (TW_ENABLE && isPostTw && twitterClient) postTasks.push(twitterClient.tweet(text, filesBuffer))
                if (BS_ENABLE && isPostBs && bskyClient) postTasks.push(bskyClient.post(text, urls, filesBuffer, ccClient))
                if (THREADS_ENABLE && isPostThreads && threadsClient) postTasks.push(threadsClient.post(text, filesBuffer))
                if (NOSTR_ENABLE && isPostNostr && nosterClient) postTasks.push(nosterClient.post(text, filesBuffer))

                const results = await Promise.allSettled(postTasks)
                results.forEach((result) => {
                    if (result.status === 'rejected') {
                        console.error('Post delivery failed', result.reason)
                    }
                })
            })
            .catch(err => {
                console.error('receivedPost failed', err)
            })
    }
}

start()
