import { BskyAgent, RichText } from '@atproto/api'
import OgImage from '../Utils/OgImage.js'
import axios from 'axios'

const MAX_MEDIA_UPLOAD_RETRYS = 3

class AtProtocol {
    sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

    constructor() {
        this.agent = undefined
        this.aud = undefined
    }

    static async build(service, Identifier, appPassword) {
        const atProtocol = new AtProtocol()

        atProtocol.agent = new BskyAgent({
            service: service
        })

        const loginResult = await atProtocol.agent.login({
            identifier: Identifier,
            password: appPassword
        })

        console.log(`BS Login : ${loginResult}`)
        // audの取得
        // あんまりイケてないカモ・・・
        const jwt = loginResult.data.accessJwt.split(".").map((jwt) => {
            try {
                return JSON.parse(atob(jwt))
            } catch (e) {
                return {}
            }
        })

        atProtocol.aud = jwt[1].aud

        return atProtocol
    }

    async post(text, urls, filesBuffer) {
        const medias = await this.uploadMedia(filesBuffer)
        const ogImage = (urls?.at(0)) ? await OgImage.getOgImage(urls?.at(0)) : undefined
        const rt = new RichText({
            text: text
        })
        await rt.detectFacets(this.agent)

        const record = {
            text: rt.text,
            facets: rt.facets,
            createdAt: new Date().toISOString(),
            langs: ["ja"],
        }

        if (medias != undefined) {
            record.embed = medias
        } else if (ogImage != undefined) {
            record.embed = await this.uploadOgImage(ogImage)
        } else {
            record.embed = {
                $type: 'app.bsky.feed.post'
            }
        }

        try {
            await this.agent.post(record)
        } catch (error) {
            console.error('AtProtocol:Failed to post')
            console.error(error)
        }
    }

    async uploadBlob(data, type) {
        let retryCount = 0
        while (retryCount < MAX_MEDIA_UPLOAD_RETRYS) {
            try {
                return await this.agent.uploadBlob(
                    data,
                    {
                        encoding: type,
                    }
                )
            } catch (error) {
                retryCount++
                console.error(`Retry uploadBlob. retryCount:${retryCount}`)
                console.error(error)
                await this.sleep(1000)
            }
        }

        throw new Error("Failed to upload media.")
    }

    async uploadOgImage(ogImage) {
        const external = {
            uri: ogImage.url,
            title: ogImage.title,
            description: ogImage.description,
        }

        if (ogImage.uint8Array.length > 0) {
            // Retryしてもアップロードできない場合は諦める
            try {
                const uploadedImage = await this.uploadBlob(ogImage.uint8Array, ogImage.type)
                external.thumb = {
                    $type: "blob",
                    ref: {
                        $link: uploadedImage.data.blob.ref.toString(),
                    },
                    mimeType: uploadedImage.data.blob.mimeType,
                    size: uploadedImage.data.blob.size,
                }
            } catch (error) {
                console.error(error)
            }
        }

        return {
            $type: "app.bsky.embed.external",
            external: external
        }
    }

    async uploadMedia(filesBuffer) {
        //Blueskyは動画1つだけ、かつ1ファイル50MBまでアップできる
        const video = filesBuffer.filter((file) => file.type.indexOf("video") >= 0).shift()
        if (video != undefined) {
            try {
                let videoUploadResult = await this.uploadVideo(video.uint8Array)
                let jobId = videoUploadResult.jobId
                let retryCount = 0
                if (jobId) {
                    while (true) {
                        const jobStatus = await this.getVideoJobStatus(jobId)
                        console.log(jobStatus)
                        if (jobStatus.jobStatus.state == "JOB_STATE_COMPLETED") {
                            return {
                                $type: 'app.bsky.embed.video',
                                video: jobStatus.jobStatus.blob
                            }
                        } else if (jobStatus.jobStatus.state == "JOB_STATE_FAILED") {
                            console.log("Video processing failed. Retrying...")
                            retryCount++
                            if (retryCount >= MAX_MEDIA_UPLOAD_RETRYS) {
                                throw new Error("Video processing failed after 3 retries.")
                            }
                            videoUploadResult = await this.uploadVideo(video.uint8Array)
                            jobId = videoUploadResult.jobId
                        }

                        await this.sleep(1000)
                    }
                }
            } catch (error) {
                console.error(error)
            }
        }

        let images = await Promise.all(filesBuffer.filter((file) => file.type.indexOf("image") >= 0).map(async (file) => {
            try {
                const result = await this.uploadBlob(file.uint8Array, file.type)
                return {
                    alt: "",
                    image: result.data.blob,
                    aspectRatio: {
                        width: 3,
                        height: 2
                    }
                }
            } catch (error) {
                // Retryしてもアップロードできない場合は諦める
                console.error(error)
                return undefined
            }
        }))

        images = images.filter(v => v) //空要素を除外

        if (images.length > 0) {
            return {
                $type: 'app.bsky.embed.images',
                images: images
            }
        } else {
            return undefined
        }
    }

    // 一日にアップできる制限の取得
    // 使わないけどとりあえず入れておく
    /*async getUploadVideoLimit() {
        const authResult = await this.getServiceAuth('did:web:video.bsky.app', 'app.bsky.video.getUploadLimits')

        if (!authResult.success) {
            return {
                canUpload: false
            }
        }

        const token = authResult.token

        const res = await axios.get('https://video.bsky.app/xrpc/app.bsky.video.getUploadLimits', {
            'headers': {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })

        return res.data
    }*/

    async getVideoJobStatus(jobId) {
        const authResult = await this.getServiceAuth('did:web:video.bsky.app', 'app.bsky.video.getJobStatus')

        if (!authResult.success) {
            return {
                canUpload: false
            }
        }

        const token = authResult.token

        try {
            const res = await axios.get(`https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${jobId}`, {
                'headers': {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })

            return res.data
        } catch (error) {
            console.log(error)
            return { jobId: "" }
        }
    }

    async uploadVideo(data) {
        let retryCount = 0
        const did = encodeURIComponent(this.agent.did)
        const name = encodeURIComponent(`${this.getFormatDate()}.mp4`)

        while (retryCount < MAX_MEDIA_UPLOAD_RETRYS) {
            const authResult = await this.getServiceAuth(this.aud, 'com.atproto.repo.uploadBlob')
            const token = authResult.token

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=${did}&name=${name}`,
                headers: {
                    'Content-Type': 'video/mp4',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                data: data
            }

            try {
                const res = await axios(config)
                return res.data
            } catch (error) {
                const responseStatus = error.response?.status
                const responseData = error.response?.data
                if (responseStatus == 409) { //409は同じデータがアップロード済みで再利用できるのでリトライしない
                    console.log(`Video upload failed. code:${responseStatus}`)
                    console.log(responseData)
                    return responseData
                } else if (responseStatus == 400) { //400はファイルサイズが50MB以上か、60秒以上の動画の場合
                    throw new Error(`Failed to upload video. ${responseData.error}`)
                }

                retryCount++
                console.error(`Retry uploadVideo. retryCount:${retryCount}`)
                console.error(error)
                await this.sleep(1000)
            }
        }

        throw new Error("Failed to upload video.")
    }

    getFormatDate() {
        const dtf = new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
        })

        return dtf.format(new Date()).replace(/[\/.: ]/g, '-')
    }

    async getServiceAuth(aud, lxm) {
        const result = await this.agent.com.atproto.server.getServiceAuth({
            aud: aud,
            lxm: lxm
        })

        return {
            success: result.success,
            token: result.data.token
        }
    }

}

export default AtProtocol