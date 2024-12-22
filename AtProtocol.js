import { BskyAgent, RichText } from '@atproto/api'
import axios from 'axios'

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

    async post(text, filesBuffer) {
        const medias = await this.uploadMedia(filesBuffer)
        const rt = new RichText({
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
            langs: ["ja"],
        }

        if (medias != undefined) {
            record.embed = medias
        }

        await this.agent.post(record)
    }

    async uploadMedia(filesBuffer) {
        //Blueskyは動画1つだけ、かつ1ファイル50MBまでアップできる
        const video = filesBuffer.filter((file) => file.type.indexOf("video") >= 0).shift()
        if (video != undefined) {
            const videoUploadResult = await this.uploadVideo(video.uint8Array)
            const jobId = videoUploadResult.jobId
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
                        console.log("Video processing failed.")
                        break
                    }

                    await this.sleep(1000)
                }
            }
        }

        const images = await Promise.all(filesBuffer.filter((file) => file.type.indexOf("image") >= 0).map(async (file) => {
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
        const authResult = await this.getServiceAuth(this.aud, 'com.atproto.repo.uploadBlob')
        const token = authResult.token
        const did = encodeURIComponent(this.agent.did)
        const name = encodeURIComponent(`${this.getFormatDate()}.mp4`)

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
            const responseStatus = error.response.status
            const responseData = error.response.data
            if (responseStatus != 409) {
                console.log(`Video upload failed. code:${responseStatus}`)
                console.log(responseData)
            }

            return responseData
        }
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