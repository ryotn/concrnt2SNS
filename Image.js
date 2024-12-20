
import sharp from 'sharp'

class Image {
    async downloader(files) {
        const filesImage = files.filter((file) => file.type.indexOf("image") >= 0)
        const filesVideo = files.filter((file) => file.type.indexOf("video") >= 0)

        const images = await Promise.all(filesImage.map(async (file) => {
            const url = file.url
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const resize = await this.resize(arrayBuffer)
            const dataArray = new Uint8Array(resize)

            return {
                "url": url,
                "buffer": resize,
                "uint8Array": dataArray,
                "type": "image/jpeg"
            }
        }))

        const videos = await Promise.all(filesVideo.map(async (file) => {
            const url = file.url
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const buffer = new Buffer.from(arrayBuffer)
            const dataArray = new Uint8Array(buffer)

            return {
                "url": url,
                "buffer": buffer,
                "uint8Array": dataArray,
                "type": "video/mp4"
            }
        }))

        return images.concat(videos)
    }

    async resize(arrayBuffer) {
        const imgSharp = new sharp(arrayBuffer)
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

        return img
    }
}

export default Image