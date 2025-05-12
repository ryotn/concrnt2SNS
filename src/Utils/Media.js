import sharp from 'sharp'
import MP4Box from 'mp4box'

class Media {
    async downloader(files) {
        const filesImage = files.filter((file) => file.type.indexOf("image") >= 0)
        const filesVideo = files.filter((file) => file.type.indexOf("video") >= 0)

        const images = await Promise.all(filesImage.map(async (file) => {
            const url = file.url
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const resize = await this.resize(arrayBuffer)
            const dataArray = new Uint8Array(resize.img)

            return {
                "url": url,
                "buffer": resize.img,
                "uint8Array": dataArray,
                "type": "image/jpeg",
                "flag": file.flag,
                "aspectRatio": resize.aspectRatio,
            }
        }))

        const videos = await Promise.all(filesVideo.map(async (file) => {
            const url = file.url
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const buffer = new Buffer.from(arrayBuffer)
            const dataArray = new Uint8Array(buffer)

            const { width, height } = await this.getVideoResolution(arrayBuffer)
            console.log(`width:${width}, height:${height}`)
            const aspectRatio = this.getAspectRatio(width, height)

            return {
                "url": url,
                "buffer": buffer,
                "uint8Array": dataArray,
                "type": "video/mp4",
                "flag": file.flag,
                "aspectRatio": aspectRatio,
            }
        }))

        return images.concat(videos)
    }

    async resize(arrayBuffer) {
        const imgSharp = new sharp(arrayBuffer)
        const metadata = await imgSharp.metadata()
        const width = metadata.width
        const height = metadata.height

        let quality = 100
        let size = 10000000
        let img
        while (size >= 976560) {
            const data = await imgSharp.resize({ width: 2048 }).jpeg({
                quality: quality,
                chromaSubsampling: '4:4:4'
            }).keepExif().toBuffer()
            img = data
            size = data.length

            quality -= 5
        }

        return {
            img: img,
            aspectRatio: this.getAspectRatio(width, height)
        }
    }

    async getVideoResolution(arrayBuffer) {
        return new Promise((resolve) => {
            const mp4boxFile = MP4Box.createFile()
            arrayBuffer.fileStart = 0  // 初期位置を指定

            mp4boxFile.onReady = function (info) {
                const videoTrack = info.tracks.find(track => 
                    track.codec.startsWith('avc') || // H.264
                    track.codec.startsWith('hev') || // H.265/HEVC
                    track.codec.startsWith('mp4v') ||// MPEG-4 Visual
                    track.codec.startsWith('hvc1')   // H.265/HEVC (別のFourCC)
                )
                if (videoTrack && videoTrack.video) {
                    const width = videoTrack.video.width
                    const height = videoTrack.video.height
                    resolve({ width: width, height: height })  // 解像度を返す
                } else {
                    resolve({ width: 0, height: 0 })  // トラックが見つからなかった場合は { 0, 0 } を返す
                }
            }

            mp4boxFile.onError = function (err) {
                console.error('エラーが発生しました:', err)
                resolve({ width: 0, height: 0 })  // エラーが発生した場合も { 0, 0 } を返す
            }

            mp4boxFile.appendBuffer(arrayBuffer)  // ArrayBuffer を直接渡す
            mp4boxFile.flush()
        })
    }

    getAspectRatio(width, height) {
        // 幅または高さが 0 または未定義等の無効な値（falsy）であれば、アスペクト比 1:1 を返す
        if (!width || !height) {
            return {
                width: 1,
                height: 1
            }
        }
        const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
        const ratioGCD = gcd(width, height)

        const ratioW = width / ratioGCD
        const ratioH = height / ratioGCD

        return {
            width: ratioW,
            height: ratioH
        }
    }
}

export default Media