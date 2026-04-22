import test from "node:test"
import assert from "node:assert/strict"
import ConcrntMessageAnalysis from "./ConcrntMessageAnalysis.js"

const analysis = new ConcrntMessageAnalysis()

test("reply mentionのみを無効化し、通常文字は維持する", () => {
    assert.equal(analysis.getPlaneText("hello @user"), "hello [@]user")
    assert.equal(analysis.getPlaneText("@user test"), "[@]user test")
    assert.equal(analysis.getPlaneText("hello @!"), "hello @!")
    assert.equal(analysis.getPlaneText("mail user@example.com"), "mail user@example.com")
})

test("URL内の@は置換しない", () => {
    assert.equal(analysis.getPlaneText("https://example.com/@user"), "https://example.com/@user")
    assert.equal(
        analysis.getPlaneText("https://user@example.com/path と @reply"),
        "https://user@example.com/path と [@]reply"
    )
})
