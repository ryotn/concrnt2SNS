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
        try {
            if (filesBuffer.length == 1 && filesBuffer[0].type == "image/jpeg" && this.bufferToken && this.bufferProfileId && !isMediaFlag) {
                await this.tweetAtBuffer(text, filesBuffer[0].url)
                return
            } else if (filesBuffer.length > 0 || isMediaFlag) {
                const mediaIds = await this.uploadMedia(filesBuffer)
                if (mediaIds.length > 0) payload.media = { media_ids: mediaIds }
            } else if (this.bufferToken && this.bufferProfileId) {
                await this.tweetAtBuffer(text)
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

    async tweetAtBuffer(text, imageURL = undefined) {
        let data = new URLSearchParams()
        data.append('text', text)
        data.append('profile_ids[]', this.bufferProfileId)
        data.append('now', 'true')

        if (imageURL) {
            data.append('media[photo]', imageURL)
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