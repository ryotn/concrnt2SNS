import { TwitterApi } from 'twitter-api-v2'
import axios from 'axios'

const BUFFER_CREATE_POST_URL = 'https://api.bufferapp.com/1/updates/create.json'
const MAX_IMAGE_POST_COUNT = 4
const MAX_MEDIA_UPLOAD_RETRYS = 3
// コンカレのラベルとTwitterのラベルの対応
// hardが何を指すのか不明・・・とりあえずgraphic_violenceにしておく
// warnはotherにしておく
const WARNING_LABEL = { 'porn': 'adult_content', 'hard': 'graphic_violence', 'nude': 'adult_content', 'warn': 'other' }

class Twitter {
    sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

    constructor(apiKey, apiKeySecret, token, tokenSecret, webhookURL, webhookURLImage) {
        this.twitterClient = new TwitterApi({
            appKey: apiKey,
            appSecret: apiKeySecret,
            accessToken: token,
            accessSecret: tokenSecret,
        })

        this.webhookURL = webhookURL
        this.tweetAtWebHookImage = webhookURLImage
        this.bufferAccessToken = process.env.TW_BUFFER_ACCESS_TOKEN || webhookURL
        this.bufferProfileId = process.env.TW_BUFFER_PROFILE_ID || webhookURLImage
    }

    async tweet(text, filesBuffer) {
        // YoutubeMusicはwatchだけOGPが出ないのでYoutubeに置き換える
        text = text.replace(/https:\/\/music\.youtube\.com\/watch/g, 'https://youtube.com/watch')
        const payload = {
            text: text
        }
        const isMediaFlag = filesBuffer.some(item => item.flag !== undefined)

        try {
            if (!isMediaFlag) {
                const bufferPayload = this.buildBufferPayload(text, filesBuffer)
                await this.createPost(bufferPayload)
                return
            }

            if (filesBuffer.length > 0 || isMediaFlag) {
                const mediaIds = await this.uploadMedia(filesBuffer)
                if (mediaIds.length > 0) payload.media = { media_ids: mediaIds }
            }

            await this.twitterClient.v2.tweet(payload)
        } catch (error) {
            console.error(error)
        }
    }

    buildBufferPayload(text, filesBuffer = []) {
        const payload = {
            text: text,
            profile_ids: [this.bufferProfileId],
            now: true
        }

        const extractMediaUrls = (mediaType) => filesBuffer
            .filter(file => file.type?.startsWith(mediaType))
            .map(file => file.url)
            .filter(Boolean)
        const images = extractMediaUrls('image/')
        const videos = extractMediaUrls('video/')

        if (videos.length > 1) throw new Error('Buffer does not support multiple videos in one post')
        if (videos.length === 1 && images.length > 0) throw new Error('Buffer does not support mixed image and video posts')

        if (videos.length === 1) {
            payload.media = { video: videos[0] }
        } else if (images.length > 0) {
            payload.media = { photo: images.slice(0, MAX_IMAGE_POST_COUNT) }
        }

        return payload
    }

    async createPost(payload) {
        if (!this.bufferAccessToken || !this.bufferProfileId) {
            throw new Error('TW_BUFFER_ACCESS_TOKEN and TW_BUFFER_PROFILE_ID are required')
        }

        let config = {
            method: 'post',
            url: BUFFER_CREATE_POST_URL,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.bufferAccessToken}`
            },
            data: payload
        }

        try {
            await axios(config)
        } catch (error) {
            const responseStatus = error.response?.status
            console.error(`Failed to tweet on Buffer API. code:${responseStatus}`)
            throw error
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

    async tweetAtWebHook(url, text, imageURL = undefined) {
        let data = {
            "value1": text,
            "value2": imageURL
        }
        let config = {
            method: 'post',
            url: url,
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        }

        try {
            await axios(config)
        } catch (error) {
            const responseStatus = error.response.status
            console.error(`Failed to tweet on WebHook. code:${responseStatus}`)
            throw error
        }
    }
}

export default Twitter
