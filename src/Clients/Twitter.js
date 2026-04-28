import { TwitterApi } from 'twitter-api-v2'
import axios from 'axios'

const BUFFER_GRAPHQL_URL = 'https://api.buffer.com'
const MAX_IMAGE_POST_COUNT = 4
const MAX_MEDIA_UPLOAD_RETRYS = 3
const BUFFER_SCHEDULING_TYPES = new Set(['automatic', 'notification'])
const BUFFER_MODES = new Set(['addToQueue', 'shareNow', 'shareNext'])
// コンカレのラベルとTwitterのラベルの対応
// hardが何を指すのか不明・・・とりあえずgraphic_violenceにしておく
// warnはotherにしておく
const WARNING_LABEL = { 'porn': 'adult_content', 'hard': 'graphic_violence', 'nude': 'adult_content', 'warn': 'other' }

class Twitter {
    sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

    constructor(apiKey, apiKeySecret, token, tokenSecret, bufferAccessToken, bufferChannelId) {
        this.twitterClient = new TwitterApi({
            appKey: apiKey,
            appSecret: apiKeySecret,
            accessToken: token,
            accessSecret: tokenSecret,
        })

        this.bufferAccessToken = bufferAccessToken
        this.bufferChannelId = bufferChannelId
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

            if (filesBuffer.length > 0) {
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
            channelId: this.bufferChannelId,
            schedulingType: 'automatic',
            mode: 'shareNow'
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
            payload.assets = { videos: [{ url: videos[0] }] }
        } else if (images.length > 0) {
            payload.assets = { images: images.slice(0, MAX_IMAGE_POST_COUNT).map((url) => ({ url })) }
        }

        return payload
    }

    buildBufferMutation(payload) {
        if (!BUFFER_SCHEDULING_TYPES.has(payload.schedulingType)) throw new Error('Invalid Buffer schedulingType')
        if (!BUFFER_MODES.has(payload.mode)) throw new Error('Invalid Buffer mode')

        const text = JSON.stringify(payload.text)
        const channelId = JSON.stringify(payload.channelId)
        const inputFields = `
            text: ${text},
            channelId: ${channelId},
            schedulingType: ${payload.schedulingType},
            mode: ${payload.mode}
        `

        let assetsField = ''
        if (payload.assets?.images) {
            const images = payload.assets.images.map((image) => `{ url: ${JSON.stringify(image.url)} }`).join(', ')
            assetsField = `assets: { images: [${images}] }`
        } else if (payload.assets?.videos) {
            const videos = payload.assets.videos.map((video) => `{ url: ${JSON.stringify(video.url)} }`).join(', ')
            assetsField = `assets: { videos: [${videos}] }`
        }
        const assetsLine = assetsField ? `,\n    ${assetsField}` : ''

        return `
mutation CreatePost {
  createPost(input: {
    ${inputFields}
    ${assetsLine}
  }) {
    __typename
    ... on PostActionSuccess {
      post {
        id
      }
    }
    ... on MutationError {
      message
    }
  }
}
`.trim()
    }

    async requestBufferGraphQL(query, variables = undefined) {
        const config = {
            method: 'post',
            url: BUFFER_GRAPHQL_URL,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.bufferAccessToken}`
            },
            data: { query, variables }
        }
        const response = await axios(config)
        return response.data
    }

    async initializeBufferChannelId() {
        if (!this.bufferAccessToken) {
            throw new Error('TW_BUFFER_ACCESS_TOKEN is required')
        }

        const organizationsData = await this.requestBufferGraphQL(`
query GetOrganizations {
  account {
    organizations {
      id
    }
  }
}
`.trim())
        const organizations = organizationsData?.data?.account?.organizations ?? []

        for (const organization of organizations) {
            if (typeof organization?.id !== 'string') continue
            if (organization.id.length === 0) continue

            const channelsData = await this.requestBufferGraphQL(`
query GetChannels($organizationId: String!) {
  channels(input: {
    organizationId: $organizationId
  }) {
    id
    service
  }
}
`.trim(), {
                organizationId: organization.id
            })

            const channels = channelsData?.data?.channels ?? []
            const xChannel = channels.find((channel) => {
                const service = channel.service?.toLowerCase()
                return service === 'twitter' || service === 'x'
            })
            if (xChannel?.id) {
                this.bufferChannelId = xChannel.id
                return this.bufferChannelId
            }
        }

        throw new Error('Buffer X channel is not found')
    }

    async createPost(payload) {
        if (!this.bufferAccessToken || !this.bufferChannelId) {
            throw new Error('TW_BUFFER_ACCESS_TOKEN and TW_BUFFER_CHANNEL_ID are required')
        }

        try {
            const responseData = await this.requestBufferGraphQL(this.buildBufferMutation(payload))
            const result = responseData?.data?.createPost
            if (!result || result.__typename === 'MutationError') {
                const message = result?.message || responseData?.errors?.[0]?.message || 'Unknown Buffer API error'
                throw new Error(message)
            }
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
            if (type === "video/mp4") {
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
        const data = {
            "value1": text,
            "value2": imageURL
        }
        const config = {
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
            const responseStatus = error.response?.status
            console.error(`Failed to tweet on WebHook. code:${responseStatus}`)
            throw error
        }
    }
}

export default Twitter
