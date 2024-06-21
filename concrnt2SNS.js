const twV2 = require('twitter-api-v2')
const at = require('@atproto/api')
const sharp = require('sharp')
const cc = require('@concurrent-world/client')
const env = require('./env.js')

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

const twitterClient = new twV2.TwitterApi({
    appKey: TW_API_KEY,
    appSecret: TW_API_KEY_SECRET,
    accessToken: TW_ACCESS_TOKEN,
    accessSecret: TW_ACCESS_TOKEN_SECRET,
})

const agent = new at.BskyAgent({
    service: BS_SERVICE
})

var pingTimer

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
            imageDownloder(files).then(filesBuffer => {
                tweet(body, filesBuffer)
                post2Bluesky(body, filesBuffer)
            })
        }
    }
}

async function imageDownloder(files) {
    let filesBuffer = []
    for await (file of files) {
        const url = file.url
        const type = file.type
        if (type.indexOf("image") >= 0) { //動画は一旦無視
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const resize = await resizeImage(arrayBuffer)
            const dataArray = new Uint8Array(resize)

            filesBuffer.push({
                "url": url,
                "buffer": resize,
                "uint8Array": dataArray,
                "type": "image/jpeg"
            })
        }
    }


    console.log(filesBuffer)

    return filesBuffer
}

async function resizeImage(arrayBuffer) {
    const imgSharp = new sharp(arrayBuffer)
    let quality = 100
    let size = 10000000
    let img
    while (size >= 976560) {
        const data = await imgSharp.resize({ width: 2048 }).jpeg({
            quality: quality,
            chromaSubsampling: '4:4:4'
        }).keepExif().toBuffer()
        img = data
        size = data.length

        quality -= 5
    }

    return img
}

// twitter
async function tweet(text, filesBuffer) {
    let mediaIds = []

    for await (file of filesBuffer) {
        const buffer = file.buffer
        const type = file.type
        const id = await twitterClient.v1.uploadMedia(buffer, { mimeType: type })
        mediaIds.push(id)
    }

    if (mediaIds.length > 0) {
        await twitterClient.v2.tweet({
            text: text,
            media: { media_ids: mediaIds }
        })
    } else {
        await twitterClient.v2.tweet({
            text: text
        })
    }
}

// bluesky
async function post2Bluesky(text, filesBuffer) {

    console.log("start login")
    const res = await agent.login({
        identifier: BS_IDENTIFIR,
        password: BS_APP_PASSWORD
    })

    console.log(res)

    console.log("start image")
    let images = []
    for await (file of filesBuffer) {
        const result = await agent.uploadBlob(
            file.uint8Array,
            {
                encoding: file.type,
            }
        )

        console.log(result)

        const image = {
            alt: "",
            image: result.data.blob,
            aspectRatio: {
                width: 3,
                height: 2
            }
        }

        images.push(image)
    }


    console.log(images)
    console.log("create RT")

    const rt = new at.RichText({
        text: text
    })
    await rt.detectFacets(agent)

    console.log("start post")
    if (images.length > 0) {
        await agent.post({
            text: rt.text,
            facets: rt.facets,
            embed: {
                $type: 'app.bsky.embed.images',
                images: images
            },
            createdAt: new Date().toISOString(),
        })
    } else {
        await agent.post({
            text: rt.text,
            facets: rt.facets,
            embed: {
                $type: 'app.bsky.feed.post',
            },
            createdAt: new Date().toISOString(),
        })
    }
}

start()