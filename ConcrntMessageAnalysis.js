
const emojiMap = require('./emojiMap.json')
const CC_IMG_PATTERN = /\!\[[^\]]*]\([^\)]*\)/g
const CC_VIDEO_PATTERN = /<video.*(?!<\/video>)\/video>/g
const CC_URL_PATTERN = /https?:\/\/[\w/:%#\$&\?~\.=\+\-]+/

class ConcrntMessageAnalysis {
    getPlaneText(body) {
        return this.replaceEmojis(this.removeMarkdown(body), emojiMap)
    }

    getMediaFiles(body) {
        const images = body.match(CC_IMG_PATTERN)?.map((url) => {
            return {
                url: url.match(CC_URL_PATTERN)?.[0] ?? "",
                type: "image"
            }
        }) ?? []

        const videos = body.match(CC_VIDEO_PATTERN)?.map((url) => {
            return {
                url: url.match(CC_URL_PATTERN)?.[0] ?? "",
                type: "video"
            }
        }) ?? []

        return images.concat(videos)
    }

String.prototype.removeMarkdown = function() {
    return this
        // Remove HTML tags
        .replace(/<\/?[^>]+(>|$)/g, "")
        // Remove emphasis (bold, italic, strikethrough)
        .replace(/(\*{1,2}|_{1,2}|~{2})(.*?)\1/g, "$2")
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
        .replace(/\n{2,}/g, "\n");
}

String.prototype.replaceEmojis = function() {
    return this.replace(/:([a-zA-Z0-9_]+):/g, (match, p1) => {
        for (const key in emojiMap) {
            if (match.indexOf(key) > 0) {
                return emojiMap[key];
            }
        }
        return match
    })
}
}

module.exports = ConcrntMessageAnalysis