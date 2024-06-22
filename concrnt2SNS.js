const cc = require('@concurrent-world/client')
const env = require('./env.js')
const ImageResize = require('./Image.js')
const Twitter = require('./Twitter.js')
const AtProtocol = require('./AtProtocol.js')

const CC_SUBKEY = env.CC_SUBKEY
const CC_IMG_PATTERN = /\!\[[^\]]*]\([^\)]*\)/g
const CC_VIDEO_PATTERN = /<video.*(?!<\/video>)\/video>/g
const CC_URL_PATTERN = /https?:\/\/[\w/:%#\$&\?~\.=\+\-]+/

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
        let body = data.document.body.body.replace(CC_IMG_PATTERN, "").replace(CC_VIDEO_PATTERN, "")
        let files = data.document.body.body.match(CC_IMG_PATTERN)?.map((url) => {
            return {
                url: url.match(CC_URL_PATTERN)?.[0] ?? "",
                type: "image"
            }
        }) ?? []

        console.log(`Files:${files}`)

        if (body.length > 0 || files.length > 0) {
            image.downloder(files).then(filesBuffer => {
                twitterClient.tweet(body, filesBuffer)
                bskyClient.post(body, filesBuffer)
            })
        }
    }
}

start()