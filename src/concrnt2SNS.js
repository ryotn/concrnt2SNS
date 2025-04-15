import { Client } from '@concrnt/worldlib'
import Media from './Utils/Media.js'
import Twitter from './Clients/Twitter.js'
import AtProtocol from './Clients/AtProtocol.js'
import Threads from './Clients/Threads.js'
import Nostr from './Clients/Nostr.js'
import CCMsgAnalysis from './Utils/ConcrntMessageAnalysis.js'

const CC_SUBKEY = process.env.CC_SUBKEY

const TW_ENABLE = process.env.TW_ENABLE == "true"
const TW_API_KEY = process.env.TW_API_KEY
const TW_API_KEY_SECRET = process.env.TW_API_KEY_SECRET
const TW_ACCESS_TOKEN = process.env.TW_ACCESS_TOKEN
const TW_ACCESS_TOKEN_SECRET = process.env.TW_ACCESS_TOKEN_SECRET
const TW_WEBHOOK_URL = process.env.TW_WEBHOOK_URL
const TW_WEBHOOK_IMAGE_URL = process.env.TW_WEBHOOK_IMAGE_URL

const BS_ENABLE = process.env.BS_ENABLE == "true"
const BS_IDENTIFIER = process.env.BS_IDENTIFIER
const BS_APP_PASSWORD = process.env.BS_APP_PASSWORD
const BS_SERVICE = process.env.BS_SERVICE

const THREADS_ENABLE = process.env.THREADS_ENABLE == "true"
const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN

const NOSTR_ENABLE = process.env.NOSTR_ENABLE == "true"
const NOSTR_PRIVATE_KEY = process.env.NOSTR_PRIVATE_KEY
const NOSTR_RELAYS = process.env.NOSTR_RELAYS

const LISTEN_TIMELINE = process.env.LISTEN_TIMELINE

const media = new Media()
const ccClient = await Client.createFromSubkey(CC_SUBKEY)
const twitterClient = TW_ENABLE && new Twitter(TW_API_KEY, TW_API_KEY_SECRET, TW_ACCESS_TOKEN, TW_ACCESS_TOKEN_SECRET, TW_WEBHOOK_URL, TW_WEBHOOK_IMAGE_URL)
const bskyClient = BS_ENABLE && await AtProtocol.build(BS_SERVICE, BS_IDENTIFIER, BS_APP_PASSWORD)
const threadsClient = THREADS_ENABLE && await Threads.create(THREADS_ACCESS_TOKEN)
const nosterClient = NOSTR_ENABLE && new Nostr(NOSTR_RELAYS, NOSTR_PRIVATE_KEY)
const ccMsgAnalysis = new CCMsgAnalysis()

async function start() {
    const subscription = await ccClient.newSocketListener()
    const listenTimeline = LISTEN_TIMELINE || ccClient.user.homeTimeline

    subscription.on('MessageCreated', (message) => {
        const document = message.parsedDoc
        if (document.signer != ccClient.ccid) {
            return
        }
        receivedPost(document)
    })

    subscription.listen([listenTimeline])
}

function receivedPost(document) {
    if (document.schema == "https://schema.concrnt.world/m/markdown.json" || document.schema == "https://schema.concrnt.world/m/media.json") {
        const body = document.body.body
        const text = ccMsgAnalysis.getPlaneText(body)
        const urls = ccMsgAnalysis.getURLs(text)
        const files = ccMsgAnalysis.getMediaFiles(body)

        document.body.medias?.forEach(media => {
            files.push({
                url: media.mediaURL,
                type: media.mediaType.split("/")[0],
                flag: media.flag
            })
        })

        if (text.length > 0 || files.length > 0) {
            media.downloader(files).then(filesBuffer => {
                if (TW_ENABLE) twitterClient.tweet(text, filesBuffer)
                if (BS_ENABLE) bskyClient.post(text, urls, filesBuffer, ccClient)
                if (THREADS_ENABLE) threadsClient.post(text, filesBuffer)
                if (NOSTR_ENABLE) nosterClient.post(text, filesBuffer)
            })
        }
    }
}

start()
