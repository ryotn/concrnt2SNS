import ogs from "open-graph-scraper";
import sharp from "sharp";

class OgImage {
  static async getOgImage(url) {
    if (url == undefined) {
      return undefined
    }

    const { result } = await ogs({ url: url })
    const ogImageUrl = result.ogImage?.at(0)?.url
    const ogImage = await this.getImage(ogImageUrl)
    const title = result.ogTitle || ""
    const description = result.ogDescription || ""

    return {
      imageUrl: ogImageUrl,
      type: "image/jpeg",
      url: url,
      description: description,
      title: title,
      uint8Array: new Uint8Array(ogImage),
    }
  }

  static async getImage(ogImageUrl) {
    if (ogImageUrl != undefined) {
      const res = await fetch(ogImageUrl)
      const buffer = await res.arrayBuffer()

      return await sharp(buffer)
        .resize(800, null, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 80,
          progressive: true,
        })
        .toBuffer()
    } else {
      return Buffer.from("")
    }
  }
}

export default OgImage
