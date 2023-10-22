import { Config, HttpResponse } from "@fermyon/spin-sdk"
const ui = require("../assets/out.html")
const decoder = new TextDecoder()
const encoder = new TextEncoder()

async function handleAuth(authToken: string): Promise<boolean> {
    let username = Config.get("sqlite_username")
    let password = Config.get("sqlite_password")
    let hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(`${username}:${password}`).buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""); // convert b
    return `Bearer ${hashHex}` == authToken
}

function returnHtml(): HttpResponse {
    return {
        status: 200,
        headers: {
            "content-type": "text/html",
        },
        body: ui.default
    }
}

export { returnHtml, handleAuth }