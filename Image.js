
const sharp = require('sharp')

class Image {
    async downloader(files) {
        return await Promise.all(files.map(async (file) => {
            const url = file.url
            const type = file.type
            if (type.indexOf("image") >= 0) { //動画は一旦無視
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
            }
        }))
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

module.exports = Image