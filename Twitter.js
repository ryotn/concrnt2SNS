const twV2 = require('twitter-api-v2')

class Twitter {
    constructor(apiKey, apiKeySecret, token, tokenSecret) {
        this.twitterClient = new twV2.TwitterApi({
            appKey: apiKey,
            appSecret: apiKeySecret,
            accessToken: token,
            accessSecret: tokenSecret,
        })
    }

    async tweet(text, filesBuffer) {
        const mediaIds = await this.uploadMedia(filesBuffer)
    
        if (mediaIds.length > 0) {
            await this.twitterClient.v2.tweet({
                text: text,
                media: { media_ids: mediaIds }
            })
        } else {
            await this.twitterClient.v2.tweet({
                text: text
            })
        }
    }

    async uploadMedia(filesBuffer) {
        return await Promise.all(filesBuffer.map(async (file) => {
            const buffer = file.buffer
            const type = file.type
            const id = await this.twitterClient.v1.uploadMedia(buffer, { mimeType: type })

            return id
        }))
    }
}

module.exports = Twitter