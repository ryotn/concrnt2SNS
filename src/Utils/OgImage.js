import sharp from "sharp";
import axios from 'axios';
import MetaTagExtractor from './MetaTagExtractor.js';

const GOOGLE_FAVICON_URL = "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url="

class OgImage {
  static async getOgImage(url, ccClient = undefined) {
    try {
      const { ogImageUrl, title, description } = await this.getOgp(url, ccClient)
      const ogImage = ogImageUrl ? await this.getImage(ogImageUrl) : undefined

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

    if (!ogImageUrl) { // ccClientがない場合や、ccClientのsummaryが取得できなかった場合は、MetaTagExtractorを使う
      const extractor = new MetaTagExtractor()
      const meta = await extractor.extractMeta(url)
      
      if (this.containsAmazonShortURL(url) && meta.images?.length > 0) {
        // Amazonの短縮URLの場合、imagesの中から特定のパターンを持つ画像を選ぶ
        // https://zenn.dev/st43/scraps/f9940dbba495d3
        const imageUrl = this.findTargetAmazonImageFromMeta(meta)
        ogImageUrl = imageUrl ? imageUrl : ""
      } else {
        ogImageUrl = meta.images?.at(0) ?? GOOGLE_FAVICON_URL + url
      }
      if (meta.og?.title || meta.title) title = meta.og?.title || meta.title
      if (meta.og?.description || meta.description) description = meta.og?.description || meta.description
    }

    return {
      ogImageUrl: ogImageUrl,
      title: title,
      description: description,
    }
  }

  static containsAmazonShortURL(text) {
    const pattern = /https?:\/\/(?:a\.co|amzn\.to|amzn\.asia|amzn\.eu|(?:www\.)?amazon\.co\.jp)\/[^\s]+/i
    return pattern.test(text)
  }

  static findTargetAmazonImage(json) {
    const prefix = "https://m.media-amazon.com/images/I/"

    // 条件に合うURLを探す
    const image = json.ogImage.find(item =>
      item.url &&
      item.url.startsWith(prefix) &&
      item.url.includes("_SX") &&
      item.url.includes("_SY")
    )

    if (!image) return undefined

    const originalUrl = image.url

    // originalUrl例: 
    // https://m.media-amazon.com/images/I/51Di4bc19jL.__AC_SX300_SY300_QL70_ML2_.jpg

    // 画像IDを取り出す（prefixの後ろと、ドット（.）より前まで）
    // 例: "51Di4bc19jL"
    const idMatch = originalUrl.match(/https:\/\/m\.media-amazon\.com\/images\/I\/([^\.]+)\./)

    if (!idMatch || !idMatch[1]) return undefined

    const imageId = idMatch[1]

    // 新しいURLフォーマットに埋め込む
    const newUrl = `https://m.media-amazon.com/images/I/${imageId}.jpg_BO30,255,255,255_UF900,850_SR1910,1000,0,AmazonEmber,50,4,0,0_QL100_.jpg`

    return newUrl
  }

  static findTargetAmazonImageFromMeta(meta) {
    const prefix = "https://m.media-amazon.com/images/I/"

    // 条件に合うURLを探す
    const imageUrl = meta.images.find(url =>
      url &&
      url.startsWith(prefix) &&
      url.includes("_SX") &&
      url.includes("_SY")
    )

    if (!imageUrl) return undefined

    // originalUrl例: 
    // https://m.media-amazon.com/images/I/51Di4bc19jL.__AC_SX300_SY300_QL70_ML2_.jpg

    // 画像IDを取り出す（prefixの後ろと、ドット（.）より前まで）
    // 例: "51Di4bc19jL"
    const idMatch = imageUrl.match(/https:\/\/m\.media-amazon\.com\/images\/I\/([^\.]+)\./)

    if (!idMatch || !idMatch[1]) return undefined

    const imageId = idMatch[1]

    // 新しいURLフォーマットに埋め込む
    const newUrl = `https://m.media-amazon.com/images/I/${imageId}.jpg_BO30,255,255,255_UF900,850_SR1910,1000,0,AmazonEmber,50,4,0,0_QL100_.jpg`

    return newUrl
  }
}

export default OgImage
