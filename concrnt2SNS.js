const cc = require('@concurrent-world/client')
const ImageResize = require('./Image.js')
const Twitter = require('./Twitter.js')
const AtProtocol = require('./AtProtocol.js')
const CCMsgAnalysis = require('./ConcrntMessageAnalysis.js')

const CC_SUBKEY = process.env.CC_SUBKEY

const TW_ENABLE = process.env.TW_ENABLE == "true"
const TW_API_KEY = process.env.TW_API_KEY
const TW_API_KEY_SECRET = process.env.TW_API_KEY_SECRET
const TW_ACCESS_TOKEN = process.env.TW_ACCESS_TOKEN
const TW_ACCESS_TOKEN_SECRET = process.env.TW_ACCESS_TOKEN_SECRET
const TW_WEBHOOK_URL = process.env.TW_WEBHOOK_URL

const BS_ENABLE = process.env.BS_ENABLE == "true"
const BS_IDENTIFIER = process.env.BS_IDENTIFIER
const BS_APP_PASSWORD = process.env.BS_APP_PASSWORD
const BS_SERVICE = process.env.BS_SERVICE

const LISTEN_TIMELINE = process.env.LISTEN_TIMELINE

const image = new ImageResize()
const twitterClient = TW_ENABLE && new Twitter(TW_API_KEY, TW_API_KEY_SECRET, TW_ACCESS_TOKEN, TW_ACCESS_TOKEN_SECRET, TW_WEBHOOK_URL)
const bskyClient = BS_ENABLE && new AtProtocol(BS_SERVICE, BS_IDENTIFIER, BS_APP_PASSWORD)
const ccMsgAnalysis = new CCMsgAnalysis()

async function start() {
    const client = await cc.Client.createFromSubkey(CC_SUBKEY)

    const subscription = await client.newSubscription()
    const listenTimeline = LISTEN_TIMELINE || client.user.homeTimeline

    subscription.on('MessageCreated', (message) => {
        if (message.document.signer != client.ccid) {
            return
        }
        receivedPost(message)
    })

    subscription.listen([listenTimeline])
}

function receivedPost(data) {
    if (data.document.schema == "https://schema.concrnt.world/m/markdown.json" || data.document.schema == "https://schema.concrnt.world/m/media.json") {
        const body = data.document.body.body
        const text = ccMsgAnalysis.getPlaneText(body)
        const files = ccMsgAnalysis.getMediaFiles(body)

        data.document.body.medias?.forEach(media => {
            files.push({
                url: media.mediaURL,
                type: media.mediaType.split("/")[0]
            })
        })

        if (text.length > 0 || files.length > 0) {
            image.downloader(files).then(filesBuffer => {
                if (TW_ENABLE) twitterClient.tweet(text, filesBuffer)
                if (BS_ENABLE) bskyClient.post(text, filesBuffer)
            })
        }
    }
}

start()
