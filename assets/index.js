const { el, mount } = redom

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let authKey = null
class Query {
    constructor(cb) {
        this.input = el("input.query-input", { type: "text", placeholder: "Input Search Query" })
        this.submit = el("button", { onclick: function (e) { cb(e, this.input.value) }.bind(this) }, "Execute")
        this.el = el("div.query", this.input, this.submit)
    }
}

class ResultBox {
    constructor() {
        this.content = el("code")
        this.el = el("pre.result", this.content)
    }
    update(data) {
        this.content.textContent = data
    }
}

class App {
    constructor() {
        this.query = new Query(this.execute.bind(this))
        this.resultBox = new ResultBox()
        this.el = el("div", this.query, this.resultBox)
    }
    async execute(e, val) {
        if (!authKey) {
            authKey = await authKey
        }
        let resp = await fetch(window.location.origin + "/internal/sqlite/execute",
            {
                headers: {
                    "Authorization": `Bearer ${authKey}`
                },
                method: "POST",
                body: val
            })
        if (resp.status == 403) {
            alert("wrong username or password, clock ok to re-enter")
            authKey = getAuthKey()
            return
        }
        let data = await resp.text()
        this.resultBox.update(data)
    }
}

async function getAuthKey() {
    let username = prompt("Enter User name to access web cli")
    let password = prompt("Enter password to access the web cli")
    let hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(`${username}:${password}`))
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""); // convert bytes to hex string
    return hashHex;
}

async function init() {
    authKey = await getAuthKey()
    let app = new App()
    mount(document.getElementById("app"), app)
}

init()