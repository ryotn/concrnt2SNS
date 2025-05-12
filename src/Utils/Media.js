import sharp from 'sharp'

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

            return {
                "url": url,
                "buffer": buffer,
                "uint8Array": dataArray,
                "type": "video/mp4",
                "flag": file.flag,
                "aspectRatio": {
                    width: 4,
                    height: 3
                },
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

    getAspectRatio(width, height) {
        if (width === 0 || height === 0) {
            return {
                width: 4,
                height: 3
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