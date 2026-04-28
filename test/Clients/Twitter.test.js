import test from "node:test"
import assert from "node:assert/strict"
import Twitter from "../../src/Clients/Twitter.js"

class MockTwitter extends Twitter {
    async createPost(payload) {
        this.lastPayload = payload
    }
}

test("テキストのみ投稿ではBuffer向けpayloadが生成される", async () => {
    const twitter = new MockTwitter("", "", "", "", "token", "profile")
    await twitter.tweet("https://music.youtube.com/watch?v=1", [])

    assert.deepEqual(twitter.lastPayload, {
        text: "https://youtube.com/watch?v=1",
        profile_ids: ["profile"],
        now: true
    })
})

test("画像投稿は最大4枚までpayloadに含める", () => {
    const twitter = new MockTwitter("", "", "", "", "token", "profile")
    const files = [1, 2, 3, 4, 5].map((i) => ({ type: "image/jpeg", url: `https://example.com/${i}.jpg` }))

    const payload = twitter.buildBufferPayload("images", files)

    assert.deepEqual(payload.media, {
        photo: [
            "https://example.com/1.jpg",
            "https://example.com/2.jpg",
            "https://example.com/3.jpg",
            "https://example.com/4.jpg"
        ]
    })
})

test("動画投稿はvideoフィールドを使う", () => {
    const twitter = new MockTwitter("", "", "", "", "token", "profile")
    const payload = twitter.buildBufferPayload("video", [{ type: "video/mp4", url: "https://example.com/v.mp4" }])

    assert.deepEqual(payload.media, { video: "https://example.com/v.mp4" })
})

test("画像と動画の同時投稿はエラーにする", () => {
    const twitter = new MockTwitter("", "", "", "", "token", "profile")

    assert.throws(
        () => twitter.buildBufferPayload("mixed", [
            { type: "image/png", url: "https://example.com/1.png" },
            { type: "video/mp4", url: "https://example.com/v.mp4" }
        ])
    )
})
