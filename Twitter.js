const twV2 = require('twitter-api-v2')
const axios = require('axios')

class Twitter {
    constructor(apiKey, apiKeySecret, token, tokenSecret, webhookURL, webhookURLImage) {
        this.twitterClient = new twV2.TwitterApi({
            appKey: apiKey,
            appSecret: apiKeySecret,
            accessToken: token,
            accessSecret: tokenSecret,
        })

        this.webhookURL = webhookURL
        this.tweetAtWebHookImage = webhookURLImage
    }

    async tweet(text, filesBuffer) {
        const mediaIds = await this.uploadMedia(filesBuffer)

        if (mediaIds.length > 0) {
            if (filesBuffer.length == 1 && filesBuffer[0].type == "image/jpeg" && this.tweetAtWebHookImage) {
                this.tweetAtWebHook(this.tweetAtWebHookImage, text, filesBuffer[0].url)
            } else {
                await this.twitterClient.v2.tweet({
                    text: text,
                    media: { media_ids: mediaIds }
                })
            }
        } else {
            if (this.webhookURL != undefined) {
                this.tweetAtWebHook(this.webhookURL, text)
            } else {
                await this.twitterClient.v2.tweet({
                    text: text
                })
            }
        }
    }

    async uploadMedia(filesBuffer) {
        return await Promise.all(filesBuffer.map(async (file) => {
            const buffer = file.buffer
            const type = file.type
            let option = { mimeType: type }
            if (type == "video/mp4") {
                option.longVideo = true
            }
            const id = await this.twitterClient.v1.uploadMedia(buffer, option)

            return id
        }))
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
            console.log(`Failed to tweet on WebHook. code:${responseStatus}`)
        }
    }
}

module.exports = Twitter