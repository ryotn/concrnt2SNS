import ogs from "open-graph-scraper";
import sharp from "sharp";

class OgImage {
  static async getOgImage(url) {
    try {
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
    } catch (e) {
      console.error(e)
      return undefined
    }
  }

  static async getImage(ogImageUrl) {
    try {
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
    } catch (e) {
      console.error(e)
      return undefined
    }
  }
}

export default OgImage
