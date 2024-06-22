const cc = require('@concurrent-world/client')
const env = require('./env.js')
const ImageResize = require('./Image.js')
const Twitter = require('./Twitter.js')
const AtProtocol = require('./AtProtocol.js')
const CCMsgAnalysis = require('./ConcrntMessageAnalysis.js')

const CC_SUBKEY = env.CC_SUBKEY

const TW_API_KEY = env.TW_API_KEY
const TW_API_KEY_SECRET = env.TW_API_KEY_SECRET

const TW_ACCESS_TOKEN = env.TW_ACCESS_TOKEN
const TW_ACCESS_TOKEN_SECRET = env.TW_ACCESS_TOKEN_SECRET

const BS_IDENTIFIR = env.BS_IDENTIFIR
const BS_APP_PASSWORD = env.BS_APP_PASSWORD
const BS_SERVICE = env.BS_SERVICE

const image = new ImageResize()
const twitterClient = new Twitter(TW_API_KEY, TW_API_KEY_SECRET, TW_ACCESS_TOKEN, TW_ACCESS_TOKEN_SECRET)
const bskyClient = new AtProtocol(BS_SERVICE, BS_IDENTIFIR, BS_APP_PASSWORD)
const ccMsgAnalysis = new CCMsgAnalysis()

async function start() {
    const client = await cc.Client.createFromSubkey(CC_SUBKEY)

    const subscription = await client.newSubscription()

    subscription.on('MessageCreated', (message) => {
        console.log("--------------------------------test")
        console.log(JSON.stringify(message, null, 2))
        receivedPost(message)
    })

    subscription.listen([client.user.homeTimeline])
}

function receivedPost(data) {
    if (data.document.schema == "https://schema.concrnt.world/m/markdown.json") {
        const body = data.document.body.body
        const text = ccMsgAnalysis.getPlaneText(body)
        const files = ccMsgAnalysis.getMediaFiles(body)

        console.log(`Files:${JSON.stringify(files, null, 2)}`)

        if (text.length > 0 || files.length > 0) {
            image.downloader(files).then(filesBuffer => {
                twitterClient.tweet(text, filesBuffer)
                bskyClient.post(text, filesBuffer)
            })
        }
    }
}

start()