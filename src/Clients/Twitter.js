import { TwitterApi } from 'twitter-api-v2'

const MAX_MEDIA_UPLOAD_RETRYS = 3
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

        try {
            if (canUseBuffer) {
                const mediaURLs = filesBuffer.map(item => item.url)
                const mediaType = isVideoOnly ? 'video' : (mediaURLs.length > 0 ? 'image' : undefined)
                await this.tweetAtBuffer(text, mediaURLs, mediaType)
                return
            } else if (filesBuffer.length == 1 && filesBuffer[0].type == "image/jpeg" && this.tweetAtWebHookImage && !isMediaFlag) {
                await this.tweetAtWebHook(this.tweetAtWebHookImage, text, filesBuffer[0].url)
                return
            } else if (filesBuffer.length > 0 || isMediaFlag) {
                const mediaIds = await this.uploadMedia(filesBuffer)
                if (mediaIds.length > 0) payload.media = { media_ids: mediaIds }
            } else if (this.webhookURL != undefined) {
                await this.tweetAtWebHook(this.webhookURL, text)
                return
            }
            
            await this.twitterClient.v2.tweet(payload)
        } catch (error) {
            console.error(error)
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

            let responseData
            try {
                responseData = await res.json()
            } catch (e) {
                responseData = await res.text()
            }

            if (!res.ok) {
                const error = new Error(`Request failed with status ${res.status}`)
                error.response = { status: res.status, data: responseData }
                throw error
            }

            // Buffer GraphQL API returns 200 OK even for errors, need to check if response.data.errors exists
            if (responseData && responseData.errors) {
                console.error(`Failed to tweet via Buffer. GraphQL Errors:`, responseData.errors)
            } else if (responseData && responseData.data && responseData.data.createPost && responseData.data.createPost.message) {
                // ... on MutationError returns a message inside the data
                console.error(`Failed to tweet via Buffer. MutationError:`, responseData.data.createPost.message)
            }
        } catch (error) {
            const responseStatus = error.response ? error.response.status : error.message
            console.error(`Failed to tweet via Buffer. status: ${responseStatus}`, error.response?.data || "")
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
                let responseData
                try {
                    responseData = await res.json()
                } catch (e) {
                    responseData = await res.text()
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