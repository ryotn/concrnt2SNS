import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * MetaTagExtractor - OGP / Twitter Card / メタ情報抽出クラス
 * 
 * 任意のURLから以下のメタ情報を抽出:
 * - Open Graph (og:*)
 * - Twitter Card (twitter:*)
 * - <title>タグ
 * - <meta name="description"> / <meta name="keywords">
 * - 画像URLを配列で取得 (og:image, twitter:image など)
 */
class MetaTagExtractor {
  /**
   * 指定されたURLからメタ情報を抽出
   * @param {string} url - 対象のURL
   * @param {object} options - axiosのオプション (timeout, headers など)
   * @returns {Promise<object>} メタ情報オブジェクト
   */
  async extractMeta(url, options = {}) {
    try {
      const defaultOptions = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        maxRedirects: 5,
        ...options
      };

      const response = await axios.get(url, defaultOptions);
      const html = response.data;
      const $ = cheerio.load(html);

      // 基本情報の抽出
      const title = this._extractTitle($);
      const description = this._extractDescription($);
      const keywords = this._extractKeywords($);

      // OGP情報の抽出
      const og = this._extractOpenGraph($);

      // Twitter Card情報の抽出
      const twitter = this._extractTwitterCard($);

      // 画像URLの抽出（重複を除去）
      const images = this._extractImages(og, twitter, $);

      return {
        title,
        description,
        keywords,
        og,
        twitter,
        images
      };
    } catch (error) {
      console.error(`Error extracting meta from ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * タイトルの抽出（OGPタイトル優先、なければ通常のtitleタグ）
   * @private
   */
  _extractTitle($) {
    return $('meta[property="og:title"]').attr('content') || 
           $('meta[name="twitter:title"]').attr('content') ||
           $('title').text() || 
           '';
  }

  /**
   * 説明文の抽出
   * @private
   */
  _extractDescription($) {
    return $('meta[property="og:description"]').attr('content') || 
           $('meta[name="twitter:description"]').attr('content') ||
           $('meta[name="description"]').attr('content') || 
           '';
  }

  /**
   * キーワードの抽出
   * @private
   */
  _extractKeywords($) {
    return $('meta[name="keywords"]').attr('content') || '';
  }

  /**
   * Open Graph情報の抽出
   * @private
   */
  _extractOpenGraph($) {
    const og = {};
    
    $('meta[property^="og:"]').each((_, element) => {
      const property = $(element).attr('property');
      const content = $(element).attr('content');
      
      if (property && content) {
        // "og:" プレフィックスを除去してキー名を生成
        const key = property.replace('og:', '');
        
        // 既に同じキーが存在する場合は配列化
        if (og[key]) {
          if (Array.isArray(og[key])) {
            og[key].push(content);
          } else {
            og[key] = [og[key], content];
          }
        } else {
          og[key] = content;
        }
      }
    });
    
    return og;
  }

  /**
   * Twitter Card情報の抽出
   * @private
   */
  _extractTwitterCard($) {
    const twitter = {};
    
    $('meta[name^="twitter:"]').each((_, element) => {
      const name = $(element).attr('name');
      const content = $(element).attr('content');
      
      if (name && content) {
        // "twitter:" プレフィックスを除去してキー名を生成
        const key = name.replace('twitter:', '');
        
        // 既に同じキーが存在する場合は配列化
        if (twitter[key]) {
          if (Array.isArray(twitter[key])) {
            twitter[key].push(content);
          } else {
            twitter[key] = [twitter[key], content];
          }
        } else {
          twitter[key] = content;
        }
      }
    });
    
    return twitter;
  }

  /**
   * 画像URLの抽出と重複除去
   * @private
   */
  _extractImages(og, twitter, $) {
    const imageUrls = new Set();

    // OGP画像を追加
    if (og.image) {
      if (Array.isArray(og.image)) {
        og.image.forEach(url => imageUrls.add(url));
      } else {
        imageUrls.add(og.image);
      }
    }

    // Twitter画像を追加
    if (twitter.image) {
      if (Array.isArray(twitter.image)) {
        twitter.image.forEach(url => imageUrls.add(url));
      } else {
        imageUrls.add(twitter.image);
      }
    }

    // Twitter画像:srcも追加
    if (twitter['image:src']) {
      if (Array.isArray(twitter['image:src'])) {
        twitter['image:src'].forEach(url => imageUrls.add(url));
      } else {
        imageUrls.add(twitter['image:src']);
      }
    }

    // フォールバック: 他のメタタグから画像を抽出
    if (imageUrls.size === 0 && $) {
      // <meta name="image"> タグ
      const metaImage = $('meta[name="image"]').attr('content');
      if (metaImage) imageUrls.add(metaImage);

      // <link rel="image_src"> タグ
      const linkImageSrc = $('link[rel="image_src"]').attr('href');
      if (linkImageSrc) imageUrls.add(linkImageSrc);

      // <meta itemprop="image"> タグ（Schema.org）
      const itemPropImage = $('meta[itemprop="image"]').attr('content');
      if (itemPropImage) imageUrls.add(itemPropImage);

      // Amazon固有: landingImageタグ（JSON形式）
      const landingImage = $('#landingImage').attr('data-a-dynamic-image');
      if (landingImage) {
        try {
          const imageData = JSON.parse(landingImage);
          Object.keys(imageData).forEach(url => imageUrls.add(url));
        } catch (e) {
          // JSON parse error - skip
        }
      }

      // Amazon固有: imgBlkFrontタグ（主要商品画像）
      const imgBlkFront = $('#imgBlkFront').attr('data-a-dynamic-image');
      if (imgBlkFront) {
        try {
          const imageData = JSON.parse(imgBlkFront);
          Object.keys(imageData).forEach(url => imageUrls.add(url));
        } catch (e) {
          // JSON parse error - skip
        }
      }

      // 一般的な画像タグのフォールバック（最後の手段）
      if (imageUrls.size === 0) {
        $('img[src]').slice(0, 5).each((_, elem) => {
          const src = $(elem).attr('src');
          if (src && (src.startsWith('http') || src.startsWith('//'))) {
            // 相対URLを絶対URLに変換
            if (src.startsWith('//')) {
              imageUrls.add('https:' + src);
            } else if (src.startsWith('http')) {
              imageUrls.add(src);
            }
          }
        });
      }
    }

    return Array.from(imageUrls);
  }
}

export default MetaTagExtractor;
