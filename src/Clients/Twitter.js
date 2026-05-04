import { TwitterApi } from 'twitter-api-v2'

const MAX_MEDIA_UPLOAD_RETRYS = 3
const MAX_BUFFER_RETRYS = 5
const BUFFER_RETRY_DELAY = 1000

// コンカレのラベルとTwitterのラベルの対応
// hardが何を指すのか不明・・・とりあえずgraphic_violenceにしておく
// warnはotherにしておく
const WARNING_LABEL = { 'porn': 'adult_content', 'hard': 'graphic_violence', 'nude': 'adult_content', 'warn': 'other' }

class Twitter {
    sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

    constructor(apiKey, apiKeySecret, token, tokenSecret, webhookURL, webhookURLImage, bufferToken, bufferChannelId) {
        this.twitterClient = new TwitterApi({
            appKey: apiKey,
            appSecret: apiKeySecret,
            accessToken: token,
            accessSecret: tokenSecret,
        })

        this.webhookURL = webhookURL
        this.tweetAtWebHookImage = webhookURLImage
        this.bufferToken = bufferToken
        this.bufferChannelId = bufferChannelId
    }

    async tweet(text, filesBuffer) {
        // YoutubeMusicはwatchだけOGPが出ないのでYoutubeに置き換える
        text = text.replace(/https:\/\/music\.youtube\.com\/watch/g, 'https://youtube.com/watch')
        const payload = {
            text: text
        }
        const isMediaFlag = filesBuffer.some(item => item.flag !== undefined)

        const isImagesOnly = filesBuffer.every(item => item.type && item.type.startsWith('image/'))
        const isVideoOnly = filesBuffer.length === 1 && filesBuffer[0].type && filesBuffer[0].type.startsWith('video/')
        const canUseBuffer = this.bufferToken && this.bufferChannelId && !isMediaFlag &&
            ((isImagesOnly && filesBuffer.length <= 4) || isVideoOnly)

        if (canUseBuffer) {
            const mediaURLs = filesBuffer.map(item => item.url)
            const mediaType = isVideoOnly ? 'video' : (mediaURLs.length > 0 ? 'image' : undefined)
            let bufferSuccess = false
            for (let i = 0; i < MAX_BUFFER_RETRYS; i++) {
                try {
                    await this.tweetAtBuffer(text, mediaURLs, mediaType)
                    bufferSuccess = true
                    break
                } catch (error) {
                    console.error(`Buffer attempt ${i + 1} failed:`, error.message || error)
                    const status = error.response?.status
                    const isFetchDimensionsError = error.message && error.message.includes("Failed to fetch image dimensions")
                    const shouldRetry = !status || status >= 500 || status === 429 || isFetchDimensionsError
                    if (!shouldRetry || i === MAX_BUFFER_RETRYS - 1) break
                    await this.sleep(BUFFER_RETRY_DELAY)
                }
            }
            if (bufferSuccess) return
            console.error(`Buffer failed, falling back...`)
        }

        if (filesBuffer.length === 1 && filesBuffer[0].type === "image/jpeg" && this.tweetAtWebHookImage && !isMediaFlag) {
            try {
                await this.tweetAtWebHook(this.tweetAtWebHookImage, text, filesBuffer[0].url)
                return
            } catch (error) {
                console.error("Webhook (image) failed, falling back...", error.message || error)
            }
        }

        if (filesBuffer.length === 0 && this.webhookURL) {
            try {
                await this.tweetAtWebHook(this.webhookURL, text)
                return
            } catch (error) {
                console.error("Webhook (text) failed, falling back...", error.message || error)
            }
        }

        try {
            if (filesBuffer.length > 0 || isMediaFlag) {
                const mediaIds = await this.uploadMedia(filesBuffer)
                if (mediaIds.length > 0) payload.media = { media_ids: mediaIds }
            }
            await this.twitterClient.v2.tweet(payload)
        } catch (error) {
            console.error("Native Twitter API failed", error)
        }
    }

    async uploadMedia(filesBuffer) {
        const ids = await Promise.all(filesBuffer.map(async (file) => {
            let retryCount = 0

            const buffer = file.buffer
            const type = file.type
            const option = { mimeType: type }
            if (type == "video/mp4") {
                option.longVideo = true
            }

            while (retryCount < MAX_MEDIA_UPLOAD_RETRYS) {
                try {
                    const id = await this.twitterClient.v1.uploadMedia(buffer, option)
                    if (file.flag) {
                        await this.twitterClient.v1.createMediaMetadata(id, { sensitive_media_warning: [WARNING_LABEL[file.flag] ?? WARNING_LABEL["warn"]] })
                    }
                    return id
                } catch (error) {
                    retryCount++
                    console.error(`Retry uploadMedia. retryCount:${retryCount}`)
                    console.error(error)
                    await this.sleep(1000)
                }
            }

            return undefined
        }))

        return ids.filter(v => v)
    }

    async tweetAtBuffer(text, mediaURLs = [], mediaType = undefined) {
        let assets = ""
        if (mediaType === 'image' && mediaURLs.length > 0) {
            const imagesMap = mediaURLs.map(url => `{ url: "${url}" }`).join(", ")
            assets = `assets: { images: [${imagesMap}] }`
        } else if (mediaType === 'video' && mediaURLs.length > 0) {
            assets = `assets: { videos: [{ url: "${mediaURLs[0]}" }] }`
        }

        // text must be properly escaped for graphql string literal
        const escapedText = JSON.stringify(text)

        const query = `
        mutation CreatePost {
          createPost(input: {
            text: ${escapedText},
            channelId: "${this.bufferChannelId}",
            schedulingType: automatic,
            mode: shareNow
            ${assets}
          }) {
            ... on PostActionSuccess {
              post { id }
            }
            ... on MutationError { message }
          }
        }`

        try {
            const res = await fetch('https://api.buffer.com', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.bufferToken}`
                },
                body: JSON.stringify({ query: query })
            })

            const responseText = await res.text()
            let responseData = responseText
            if (responseText) {
                try {
                    responseData = JSON.parse(responseText)
                } catch (e) {
                    responseData = responseText
                }
            }

            if (!res.ok) {
                const error = new Error(`Request failed with status ${res.status}`)
                error.response = { status: res.status, data: responseData }
                throw error
            }

            // Buffer GraphQL API returns 200 OK even for errors, need to check if top-level responseData.errors exists
            if (responseData?.errors) {
                const error = new Error(`GraphQL Errors: ${JSON.stringify(responseData.errors)}`)
                error.response = { status: 200, data: responseData }
                throw error
            } else if (responseData?.data?.createPost?.message) {
                // ... on MutationError returns a message inside the data
                const error = new Error(`MutationError: ${responseData.data.createPost.message}`)
                error.response = { status: 200, data: responseData }
                throw error
            }
        } catch (error) {
            if (!error.response) {
                error.response = { status: 500, data: error.message }
            }
            throw error
        }
    }

    async tweetAtWebHook(url, text, imageURL = undefined) {
        let data = {
            "value1": text,
            "value2": imageURL
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })

            if (!res.ok) {
                const responseText = await res.text()
                let responseData = responseText
                if (responseText) {
                    try {
                        responseData = JSON.parse(responseText)
                    } catch (e) {
                        responseData = responseText
                    }
                }
                const error = new Error(`Request failed with status ${res.status}`)
                error.response = { status: res.status, data: responseData }
                throw error
            }
        } catch (error) {
            const responseStatus = error.response ? error.response.status : error.message
            console.error(`Failed to tweet on WebHook. status: ${responseStatus}`, error.response?.data || "")
            throw error
        }
    }
}

export default Twitter