
import { readFile } from 'fs/promises'
const workDir = process.cwd()
const emojiMap = JSON.parse(await readFile(`${workDir}/src/Utils/emojiMap.json`))
const CC_IMG_PATTERN = /\!\[[^\]]*]\([^\)]*\)/g
const CC_VIDEO_PATTERN = /<video.*(?!<\/video>)\/video>/g
const CC_DETAILS_PATTERN = /<details>[\s\S]*?<\/details>/g
const CC_SUMMARY_PATTERN = /<summary>[\s\S]*?<\/summary>/g
const CC_HTMLTAG_AND_RN_PATTERN = /<[^>]*>|\r?\n/g
const CC_URL_PATTERN = /https?:\/\/[\w/:%#\$&\?~\.=\+\-@]+/g
const TW_USERNAME_MAX_LENGTH = 15
const CC_REPLY_MENTION_PATTERN = new RegExp(`(^|[^A-Za-z0-9_])[@＠]([A-Za-z0-9_]{1,${TW_USERNAME_MAX_LENGTH}})\\b`, "g")

class ConcrntMessageAnalysis {
    getPlaneText(body) {
        return body
            .removeMarkdown()
            .replaceEmojis()
            .replaceSpecialCharacter()
    }

    getURLs(body) {
        return body.match(CC_URL_PATTERN) ?? []
    }

    getMediaFiles(body) {
        const medias = this.getMedias(body.replace(CC_DETAILS_PATTERN, ""))
        const sensitiveMedias = body.match(CC_DETAILS_PATTERN)?.map((details) => {
            return this.getMedias(details)
        }).flat(Infinity) ?? []

        return medias.concat(sensitiveMedias)
    }

    getMedias(body) {
        const flag = body.match(CC_SUMMARY_PATTERN)?.[0]?.replace(CC_HTMLTAG_AND_RN_PATTERN, "") ?? undefined
        const images = body.match(CC_IMG_PATTERN)?.map((url) => {
            return {
                url: url.match(CC_URL_PATTERN)?.[0] ?? "",
                type: "image",
                flag: flag
            }
        }) ?? []

        const videos = body.match(CC_VIDEO_PATTERN)?.map((url) => {
            return {
                url: url.match(CC_URL_PATTERN)?.[0] ?? "",
                type: "video",
                flag: flag
            }
        }) ?? []

        return images.concat(videos)
    }
}

String.prototype.removeMarkdown = function() {
    return this
        // Remove summary block
        .replace(CC_SUMMARY_PATTERN, "")
        // Remove HTML tags
        .replace(/<\/?[^>]+(>|$)/g, "")
        // Remove headers
        .replace(/^(#{1,6})\s+(.*)/gm, "$2")
        // Remove inline code
        .replace(/`([^`]*)`/g, "$1")
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, "")
        // Remove images
        .replace(/!\[.*?\]\(.*?\)/g, "")
        // Remove links
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
        // Remove horizontal rules
        .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "")
        // Remove unordered list items
        .replace(/^\s*[-*+]\s+/gm, "")
        // Remove ordered list items
        .replace(/^\s*\d+\.\s+/gm, "")
        // Remove extra spaces and newlines
        .replace(/^\s+|\s+$/g, "")
}

String.prototype.replaceEmojis = function() {
    return this.replace(/:([a-zA-Z0-9_]+):/g, (match, p1) => {
        //完全一致
        for (const key in emojiMap) {
            if (key === match.replace(/:/g, "")) {
                return emojiMap[key]
            }
        }
        //部分一致
        for (const key in emojiMap) {
            if (key.length <= 2) continue
            if (match.indexOf(key) > 0) {
                return emojiMap[key]
            }
        }
        return match
    })
}

String.prototype.replaceSpecialCharacter = function() {
    const replaceReplyMention = (text) => {
        return text.replace(CC_REPLY_MENTION_PATTERN, "$1[@]$2")
    }

    let result = ""
    let currentIndex = 0

    for (const urlMatch of this.matchAll(CC_URL_PATTERN)) {
        const url = urlMatch[0]
        const index = urlMatch.index
        result += replaceReplyMention(this.slice(currentIndex, index))
        result += url
        currentIndex = index + url.length
    }

    result += replaceReplyMention(this.slice(currentIndex))
    return result
}

export default ConcrntMessageAnalysis
