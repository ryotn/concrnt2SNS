import test from "node:test"
import assert from "node:assert/strict"
import Twitter from "../../src/Clients/Twitter.js"

class MockTwitter extends Twitter {
    constructor(...args) {
        super(...args)
        const presetChannelId = args[5] || "bufferChannelId"
        this.bufferChannelId = presetChannelId
        this.bufferChannelIdError = undefined
        this.bufferChannelIdPromise = Promise.resolve(presetChannelId)
        this.queries = []
        this.twitterClient = {
            v2: {
                tweet: async (payload) => {
                    this.lastTweetPayload = payload
                }
            }
        }
    }

    async createPost(payload) {
        this.lastPayload = payload
    }

    async uploadMedia() {
        return ["mock-media-id"]
    }

    async initializeBufferChannelId() {
        if (this.useApiChannelResolver) {
            return super.initializeBufferChannelId()
        }
        return "mock-constructor-channel-id"
    }

    async initializeBufferChannelIdFromApi() {
        this.useApiChannelResolver = true
        try {
            return await super.initializeBufferChannelId()
        } finally {
            this.useApiChannelResolver = false
        }
    }

    setGraphQLResponses(responses) {
        this.mockGraphQLResponses = [...responses]
    }

    async requestBufferGraphQL(query, variables) {
        if (!this.queries) this.queries = []
        this.queries.push({ query, variables })
        return this.mockGraphQLResponses?.shift()
    }
}

test("テキストのみ投稿ではBuffer向けpayloadが生成される", async () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferProfileId")
    await twitter.tweet("https://music.youtube.com/watch?v=1", [])

    assert.deepEqual(twitter.lastPayload, {
        text: "https://youtube.com/watch?v=1",
        channelId: "bufferProfileId",
        schedulingType: "automatic",
        mode: "shareNow"
    })
})

test("画像投稿は最大4枚までpayloadに含める", () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferProfileId")
    const files = [1, 2, 3, 4, 5].map((i) => ({ type: "image/jpeg", url: `https://example.com/${i}.jpg` }))

    const payload = twitter.buildBufferPayload("images", files)

    assert.deepEqual(payload.assets, {
        images: [
            { url: "https://example.com/1.jpg" },
            { url: "https://example.com/2.jpg" },
            { url: "https://example.com/3.jpg" },
            { url: "https://example.com/4.jpg" }
        ]
    })
})

test("動画投稿はvideoフィールドを使う", () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferProfileId")
    const payload = twitter.buildBufferPayload("video", [{ type: "video/mp4", url: "https://example.com/v.mp4" }])

    assert.deepEqual(payload.assets, { videos: [{ url: "https://example.com/v.mp4" }] })
})

test("画像と動画の同時投稿はエラーにする", () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferProfileId")

    assert.throws(
        () => twitter.buildBufferPayload("mixed", [
            { type: "image/png", url: "https://example.com/1.png" },
            { type: "video/mp4", url: "https://example.com/v.mp4" }
        ])
    )
})

test("動画2本以上の同時投稿はエラーにする", () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferProfileId")

    assert.throws(
        () => twitter.buildBufferPayload("multi video", [
            { type: "video/mp4", url: "https://example.com/v1.mp4" },
            { type: "video/mp4", url: "https://example.com/v2.mp4" }
        ])
    )
})

test("isMediaFlagが無ければBuffer経由で投稿する", async () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferProfileId")
    await twitter.tweet("text only", [])

    assert.ok(twitter.lastPayload)
    assert.equal(twitter.lastTweetPayload, undefined)
})

test("isMediaFlagがあればX API経由で投稿する", async () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferProfileId")
    await twitter.tweet("flag media", [{ type: "image/jpeg", url: "https://example.com/1.jpg", flag: "porn" }])

    assert.equal(twitter.lastPayload, undefined)
    assert.deepEqual(twitter.lastTweetPayload, {
        text: "flag media",
        media: { media_ids: ["mock-media-id"] }
    })
})

test("Buffer投稿クエリはchannelIdとimagesを含む", () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferChannelId")
    const payload = twitter.buildBufferPayload("images", [{ type: "image/jpeg", url: "https://example.com/1.jpg" }])
    const query = twitter.buildBufferMutation(payload)

    assert.ok(query.includes('channelId: "bufferChannelId"'))
    assert.ok(query.includes('assets: { images: [{ url: "https://example.com/1.jpg" }] }'))
})

test("Buffer投稿クエリはテキスト投稿時にschedulingTypeとmodeを含む", () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken", "bufferChannelId")
    const payload = twitter.buildBufferPayload("text only", [])
    const query = twitter.buildBufferMutation(payload)

    assert.match(query, /schedulingType: automatic/)
    assert.match(query, /mode: shareNow/)
    assert.doesNotMatch(query, /assets:/)
})

test("起動時にBuffer APIからX Channel IDを取得する", async () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken")
    twitter.setGraphQLResponses([
        {
            data: {
                account: {
                    organizations: [{ id: "org-1" }]
                }
            }
        },
        {
            data: {
                channels: [
                    { id: "ch-facebook", service: "facebook" },
                    { id: "ch-twitter", service: "twitter" }
                ]
            }
        }
    ])

    const channelId = await twitter.initializeBufferChannelIdFromApi()

    assert.equal(channelId, "ch-twitter")
    assert.equal(twitter.bufferChannelId, "ch-twitter")
    assert.deepEqual(twitter.queries[1].variables, { organizationId: "org-1" })
})

test("起動時にX Channel IDが見つからなければエラーにする", async () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken")
    twitter.setGraphQLResponses([
        {
            data: {
                account: {
                    organizations: [{ id: "org-1" }]
                }
            }
        },
        {
            data: {
                channels: [{ id: "ch-facebook", service: "facebook" }]
            }
        }
    ])

    await assert.rejects(
        twitter.initializeBufferChannelIdFromApi(),
        /Buffer X channel is not found/
    )
})

test("複数Organizationを探索してX Channel IDを取得する", async () => {
    const twitter = new MockTwitter("apiKey", "apiKeySecret", "token", "tokenSecret", "bufferAccessToken")
    twitter.setGraphQLResponses([
        {
            data: {
                account: {
                    organizations: [{ id: "org-1" }, { id: "org-2" }]
                }
            }
        },
        {
            data: {
                channels: [{ id: "ch-facebook", service: "facebook" }]
            }
        },
        {
            data: {
                channels: [{ id: "ch-twitter-2", service: "twitter" }]
            }
        }
    ])

    const channelId = await twitter.initializeBufferChannelIdFromApi()

    assert.equal(channelId, "ch-twitter-2")
    assert.deepEqual(twitter.queries[1].variables, { organizationId: "org-1" })
    assert.deepEqual(twitter.queries[2].variables, { organizationId: "org-2" })
})
