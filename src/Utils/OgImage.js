import ogs from "open-graph-scraper";
import sharp from "sharp";
import axios from 'axios';

const GOOGLE_FAVICON_URL = "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url="

class OgImage {
  static async getOgImage(url, ccClient = undefined) {
    try {
      const { ogImageUrl, title, description } = await this.getOgp(url, ccClient)
      const ogImage = await this.getImage(ogImageUrl)

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

  static async getOgp(url, ccClient = undefined) {
    let ogImageUrl = ""
    let title = ""
    let description = ""
    if (ccClient && "world.concrnt.hyperproxy.summary" in ccClient?.domainServices) {
      const summaryUrl = `https://${ccClient.host}${ccClient.domainServices['world.concrnt.hyperproxy.summary'].path}?url=${encodeURIComponent(url)}`
      try {
        const { data } = await axios.get(summaryUrl)
        if (data.thumbnail) { // thumbnailがあれば使う
          ogImageUrl = data.thumbnail
        } else if (data.icon.endsWith(".ico")) {  // faviconがico形式の場合は、GoogleのFavicon取得APIを使う
          ogImageUrl = GOOGLE_FAVICON_URL + url
        } else { // それ以外は、iconを使う
          ogImageUrl = data.icon
        }
        title = data.title
        description = data.description
      } catch (e) {
        console.error(e)
      }
    }
    
    if (!ogImageUrl) { // ccClientがない場合や、ccClientのsummaryが取得できなかった場合は、OpenGraphを使う
      const { result } = await ogs({ url: url })
      ogImageUrl = result.ogImage?.at(0)?.url ?? GOOGLE_FAVICON_URL + url
      if (!title) title = result.ogTitle ?? ""
      if (!description) description = result.ogDescription ?? ""
    }

    return {
      ogImageUrl: ogImageUrl,
      title: title,
      description: description,
    }
  }
}

export default OgImage
