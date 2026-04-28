import axios from 'axios'

const BUFFER_CREATE_POST_URL = 'https://api.bufferapp.com/1/updates/create.json'
const MAX_IMAGE_POST_COUNT = 4

class Twitter {
    constructor(apiKey, apiKeySecret, token, tokenSecret, webhookURL, webhookURLImage) {
        this.bufferAccessToken = webhookURL || process.env.TW_BUFFER_ACCESS_TOKEN
        this.bufferProfileId = webhookURLImage || process.env.TW_BUFFER_PROFILE_ID
    }

    async tweet(text, filesBuffer) {
        // YoutubeMusicはwatchだけOGPが出ないのでYoutubeに置き換える
        text = text.replace(/https:\/\/music\.youtube\.com\/watch/g, 'https://youtube.com/watch')

        try {
            const payload = this.buildBufferPayload(text, filesBuffer)
            await this.createPost(payload)
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

        const images = filesBuffer.filter(file => file.type?.startsWith('image/')).map(file => file.url).filter(Boolean)
        const videos = filesBuffer.filter(file => file.type?.startsWith('video/')).map(file => file.url).filter(Boolean)

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
}

export default Twitter
