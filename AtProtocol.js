const at = require('@atproto/api')

class AtProtocol {
    constructor(service, Identifier, appPassword) {
        this.agent = new at.BskyAgent({
            service: service
        })

        this.agent.login({
            identifier: Identifier,
            password: appPassword
        }).then(res => {
            console.log(`BS Login : ${res}`)
        })
    }

    async post(text, filesBuffer) {
        const images = await this.uploadMedia(filesBuffer)

        const rt = new at.RichText({
            text: text
        })
        await rt.detectFacets(this.agent)

        let record = {
            text: rt.text,
            facets: rt.facets,
            embed: {
                $type: 'app.bsky.feed.post',
            },
            createdAt: new Date().toISOString(),
        }

        if (images.length > 0) {
            record.embed = {
                $type: 'app.bsky.embed.images',
                images: images
            }
        }

        await this.agent.post(record)
    }

    async uploadMedia(filesBuffer) {
        return await Promise.all(filesBuffer.map(async (file) => {
            const result = await this.agent.uploadBlob(
                file.uint8Array,
                {
                    encoding: file.type,
                }
            )

            return {
                alt: "",
                image: result.data.blob,
                aspectRatio: {
                    width: 3,
                    height: 2
                }
            }
        }))
    }
}

module.exports = AtProtocol