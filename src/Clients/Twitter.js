import { TwitterApi } from 'twitter-api-v2'
import axios from 'axios'

const MAX_MEDIA_UPLOAD_RETRYS = 3
// コンカレのラベルとTwitterのラベルの対応
// hardが何を指すのか不明・・・とりあえずgraphic_violenceにしておく
// warnはotherにしておく
const WARNING_LABEL = { 'porn': 'adult_content', 'hard': 'graphic_violence', 'nude': 'adult_content', 'warn': 'other' }

class Twitter {
    sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

    constructor(apiKey, apiKeySecret, token, tokenSecret, bufferToken, bufferProfileId) {
        this.twitterClient = new TwitterApi({
            appKey: apiKey,
            appSecret: apiKeySecret,
            accessToken: token,
            accessSecret: tokenSecret,
        })

        this.bufferToken = bufferToken
        this.bufferProfileId = bufferProfileId
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
        const canUseBuffer = this.bufferToken && this.bufferProfileId && !isMediaFlag &&
            ((isImagesOnly && filesBuffer.length <= 4) || isVideoOnly)

        try {
            if (canUseBuffer) {
                const mediaURLs = filesBuffer.map(item => item.url)
                const mediaType = isVideoOnly ? 'video' : (mediaURLs.length > 0 ? 'image' : undefined)
                await this.tweetAtBuffer(text, mediaURLs, mediaType)
                return
            } else if (filesBuffer.length > 0 || isMediaFlag) {
                const mediaIds = await this.uploadMedia(filesBuffer)
                if (mediaIds.length > 0) payload.media = { media_ids: mediaIds }
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
        let data = new URLSearchParams()
        data.append('text', text)
        data.append('profile_ids[]', this.bufferProfileId)
        data.append('now', 'true')

        if (mediaType === 'image') {
            mediaURLs.forEach(url => {
                data.append('media[photo][]', url)
            })
        } else if (mediaType === 'video' && mediaURLs.length > 0) {
            data.append('media[video]', mediaURLs[0])
        }

        let config = {
            method: 'post',
            url: 'https://api.bufferapp.com/1/updates/create.json',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${this.bufferToken}`
            },
            data: data.toString()
        }

        try {
            await axios(config)
        } catch (error) {
            const responseStatus = error.response ? error.response.status : 'unknown'
            console.error(`Failed to tweet via Buffer. code:${responseStatus}`)
            throw error
        }
    }
}

export default Twitter