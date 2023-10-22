const { el, mount, list, setAttr, setChildren } = redom
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const model = {
    state: {
        loggedin: false,
        authkey: null
    }
}

const INTRO_TEXT = `Welcome to Spin SQL Explorer!

Type ".help" to list all available commands.
`

const HELP_TEXT = `The list of commands is 
.help to display help and list all commands
.tables to display all the tables
.dump to download a dump of the database
.schema to list the schema of the tables
.format to change the output format between json and table
.database to choose a different db label to run queries against
`

const UNKNOWN_DOT_COMMAND = "Unknown usage of dot command. Type \".help\" to list all known commands"

class Prompt {
    constructor(prefix, callback, isPassword, handleArrowKeys) {
        this.handleArrowKeys = handleArrowKeys
        this.callback = callback
        this.input = el("input", {
            id: "hello",
            tabindex: 1,
            onkeydown: function (e) {
                if (e.keyCode === 13) {
                    e.preventDefault()
                    this.callback(this.input.value)
                }
                handleArrowKeys && handleArrowKeys(e)
            }.bind(this)
        })
        setAttr(this.input, { type: isPassword ? "password" : "text" })
        this.prefix = el("span.prefix", prefix)
        this.el = el("div.prompt", this.prefix, this.input)
    }
    update(prefix, isPassword) {
        this.input.value = ""
        this.prefix.textContent = prefix
        setAttr(this.input, { type: isPassword ? "password" : "text" })
        this.input.focus()
    }
    setFocus() {
        this.input.focus()
    }
    alterValue(value) {
        this.input.value = value
    }
}

class Li {
    constructor() {
        this.el = el("div.output");
    }
    update(data) {
        if (data.raw) {
            this.el.innerHTML = data.raw
            return
        }
        this.el.textContent = data.text
        if (data.type) {
            this.el.classList.add(data.type)
        }
    }
}

class LoginComponent {
    constructor(callback) {
        this.callback = callback
        this.username = ""
        this.password = ""
        this.isPassword = false
        this.state = 0
        this.history = list("div", Li)
        this.historyList = [{ text: `Enter credentials to login`, type: "" }]
        this.prompt = new Prompt("username:", this.handle_callback.bind(this))
        this.el = el("div", this.history, this.prompt)
        this.history.update(this.historyList)
        this.prompt.setFocus()
    }
    async handle_callback(value) {
        switch (this.state) {
            case 0:
                this.username = value
                this.historyList.push({ text: `username:${value}`, type: "" })
                this.state = 1
                this.prompt.update("password:", true)
                break;
            case 1:
                this.password = value
                this.prompt.textContent = "password:"
                this.historyList.push({ text: `password:********`, type: "" })
                if (await authenticate(this.username, this.password)) {
                    this.callback()
                } else {
                    this.historyList.push({ text: "Login credentials are wrong, retry" })
                    this.state = 0
                    this.prompt.update("username:", false)
                }
                break
        }
        this.history.update(this.historyList)
    }
    setFocus() {
        this.prompt.setFocus()
    }
}


class CommandComponent {
    constructor(callback, unauthorizedCallback, keycodeHandler) {
        this.database = "default"
        this.callback = callback
        this.unauthorizedCallback = unauthorizedCallback
        this.keycodeHandler = keycodeHandler
        this.outputFomat = "json"
        this.multilineStatus = {
            state: false,
            comment: false
        }
        this.commandHistory = []
        this.commandHistoryIndex = null
        this.multilineHistory = list("div", Li)
        this.multilineHistoryList = []
        this.inputSegment = ""
        this.prompt = new Prompt("> ", this.handle_callback.bind(this), false, this.handleKeyinputs.bind(this))
        this.el = el("div", this.multilineHistory, this.prompt)
        this.prompt.setFocus()
    }
    handleKeyinputs(e) {
        // Handle Arrow keys 
        if (e.keyCode === 38) {
            if (this.commandHistory.length == 0 || this.commandHistoryIndex == 0) {
                return
            }
            if (!this.commandHistoryIndex) {
                this.commandHistory.push(this.prompt.input.value)
                this.commandHistoryIndex = this.commandHistory.length - 2
                this.prompt.alterValue(this.commandHistory[this.commandHistoryIndex])
            } else {
                this.commandHistoryIndex -= 1
                this.prompt.alterValue(this.commandHistory[this.commandHistoryIndex])
            }
        } else if (e.keyCode === 40) {
            if (this.commandHistory.length == 0 || this.commandHistoryIndex == null) {
                return
            }
            this.commandHistoryIndex++
            if (this.commandHistoryIndex + 1 >= this.commandHistory.length) {
                this.prompt.alterValue(this.commandHistory.pop())
                this.commandHistoryIndex = null
            } else {
                this.prompt.alterValue(this.commandHistory[this.commandHistoryIndex])
            }
        }

        // Handle ctrl + c
        if (event.ctrlKey && event.key === 'c' || event.key === 'C') {
            this.cancelCommand()
        }

        this.keycodeHandler && this.keycodeHandler(e)

    }
    handle_callback(value) {
        value = value.trim()
        if (!value) {
            return
        }

        if (this.multilineStatus.state) {
            // Already in the middle of a multiline statement
            if (this.multilineStatus.comment) { this.handleMutlilineComment(value) }
            else {
                this.handleCommand(value)
            }
        } else {
            // handle single line comments
            if (this.isSingleComment(value)) {
                this.callback({ text: value, type: "comment" })
                this.resetInputSegment()
                this.prompt.update("> ")
                return
            }

            if (value.startsWith(".")) {
                this.handleDotcommand(value)
                return
            }
            // Check if begining of multiline comment
            if (this.isMultiCommentStart(value)) {
                this.handleMutlilineComment(value)
                return
            }
            // check if command is terminated with a semicolon
            this.handleCommand(value)
        }

    }
    isSingleComment(value) {
        return value.startsWith("--")
    }
    isMultiCommentStart(value) {
        return value.startsWith("/*")
    }
    handleMutlilineComment(value) {
        let prefix = ""
        if (!this.multilineStatus.state) {
            value.startsWith("--")
            this.multilineStatus.comment = true
            this.multilineStatus.state = true
            this.inputSegment = value
            prefix = ">"
        } else {
            this.inputSegment += `\n ${value}`
        }
        if (value.endsWith("*/")) {
            this.callback({ text: this.inputSegment, type: "multiline-comment" })
            this.resetInputSegment()
            return
        }
        this.multilineHistoryList.push({ text: `${prefix} ${value}` })
        this.multilineHistory.update(this.multilineHistoryList)
        this.prompt.update("")
    }
    async handleCommand(value) {
        let prefix = this.multilineStatus.state ? "" : ">"
        this.inputSegment += ` ${value}`
        if (value.endsWith(";")) {
            await this.runStatement(this.inputSegment)
            return
        } else {
            this.multilineStatus.state = true
        }
        this.multilineHistoryList.push({ text: `${prefix} ${value}` })
        this.multilineHistory.update(this.multilineHistoryList)
        this.prompt.update("")

    }
    handleDotcommand(value) {
        let args = value.split(" ")
        if (value == ".help") {
            this.callback({ text: `> ${value}`, type: "command" })
            this.callback({ text: HELP_TEXT })
        } else if (value == ".tables") {
            this.runStatement("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite%';", ".tables")
        } else if (args[0] == ".schema") {
            if (args.length > 2) {
                this.callback({ text: `> ${value}` })
                this.callback({ text: "ERROR: Takes at most 1 argument" })
                this.resetInputSegment()
                return
            }
            if (args[1]) {
                this.runStatement(`SELECT sql FROM sqlite_master WHERE name = '${args[1]}' AND name NOT LIKE 'sqlite%';;`, `.schema ${args[1]}`)
            } else {
                this.runStatement("SELECT sql FROM sqlite_master where name NOT LIKE 'sqlite%';", `.schema`)
            }
        } else if (args[0] == ".dump") {
            if (args.length > 1) {
                this.callback({ text: `> ${value}` })
                this.callback({ text: "ERROR: Currently takes no argumments", type: "error" })
                this.resetInputSegment()
                return
            }
            this.dump()
        } else if (args[0] == ".format") {
            if (args.length != 2) {
                this.callback({ text: `> ${value}`, type: "command" })
                this.callback({ text: "ERROR: It takes exactly one argument (eg) .format json", type: "error" })
                this.resetInputSegment()
                return
            }
            if (args[1] != "json" && args[1] != "table") {
                this.callback({ text: `> ${value}` })
                this.callback({ text: "ERROR: Argument can only be either \"json\" or \"table\"", type: "error" })
                this.resetInputSegment()
                return
            }
            this.callback({ text: `> ${value}`, type: "command" })
            this.callback({ text: `Changed output formatting to ${args[1]}`, type: "download-success" })
            this.outputFomat = args[1]
            this.commandHistory.push(value)
        } else if (args[0] == ".database") {
            if (args.length == 1) {
                this.callback({ text: `> ${value}` })
                this.callback({ text: `Current active database is \"${this.database}\"`, type: "" })
                this.resetInputSegment()
                return
            }
            if (args.length != 2) {
                this.callback({ text: `> ${value}` })
                this.callback({ text: "ERROR: Takes exactly one argument (e.g) \".databse new-label\"", type: "error" })
                this.resetInputSegment()
                return
            }
            this.database = args[1]
            this.callback({ text: `> ${value}`, type: "command" })
            this.callback({ text: `Switched database label to ${args[1]}`, type: "download-success" })

        } else {
            this.callback({ text: UNKNOWN_DOT_COMMAND })
        }
        this.resetInputSegment()
    }
    async runStatement(value, commandName) {
        if (this.commandHistoryIndex != null) {
            this.commandHistory.pop()
        }
        this.commandHistory.push(commandName || value)
        let res = await executeRequest(value, this.database)
        this.callback({ text: `> ${commandName || value} `, type: "command" })
        if (res.status == "failed" && res.reason == "unauthorized") {
            this.unauthorizedCallback()
        }
        if (res.status == "success") {
            if (this.outputFomat == "json") {
                this.callback({ text: `${JSON.stringify(res.data.rows, null, 2)} `, type: "success" })
            } else {
                this.callback({ raw: jsonToHtmlTable(res.data.rows, res.data.columns) })
            }
        } else {
            this.callback({ text: `ERROR: ${res.reason} `, type: "error" })
            if (res.reason.trim() == "InternalError: Error::AccessDenied") {
                this.callback({ text: `check if the database label \"${this.database}\" exists`, type: "warn" })
                this.callback({ text: `if label exists, make sure explorer component has access to it`, type: "warn" })
            }
        }
        this.resetInputSegment()
    }
    async dump() {
        let res = await dumpDB()
        if (res.status == "success") {
            this.callback({ text: `> .dump`, type: "statement" })
            this.callback({ text: `Dumped database to file named "dump.sql" successfully`, type: "download-success" })
            downloadTextFile(res.data, "dump.sql")
        } else {
            this.callback({ text: `ERROR: ${res.reason} `, type: "error" })
        }
        this.resetInputSegment()
    }
    setFocus() {
        this.prompt.setFocus()
    }
    cancelCommand() {
        this.inputSegment += this.prompt.input.value
        this.callback({ text: `> ${this.inputSegment} `, type: "cancelled" })
        this.callback({ text: `^C `, type: "cancelled" })
        this.resetInputSegment()
    }
    resetInputSegment() {
        this.multilineStatus.state = false
        this.multilineStatus.comment = false
        this.inputSegment = ""
        this.multilineHistoryList = []
        this.multilineHistory.update(this.multilineHistoryList)
        this.prompt.update("> ")
        this.commandHistoryIndex = null
    }
}

class App {
    constructor() {
        this.ismouseDown = false
        this.isMouseDrag = false
        this.loginComponent = new LoginComponent(this.authenticated.bind(this))
        this.commandComponent = new CommandComponent(this.addCommandOutputHistory.bind(this), this.setupAuth.bind(this), this.keyDownHandler.bind(this))
        this.history = list("div", Li)
        this.historyList = []
        this.intro = el("div.intro", INTRO_TEXT)
        if (model.state.loggedin) {
            this.el = el("div.cli-window", this.intro, this.history, this.commandComponent)
        } else {
            this.el = el("div.cli-window", this.loginComponent)
        }
        document.addEventListener("mouseup", function (e) {
            if (!this.isMouseDrag)
                this.setFocus()
            this.isMouseDrag = false
            this.ismouseDown = false
        }.bind(this))
        this.el.addEventListener("mousemove", function (e) {
            if (this.ismouseDown) {
                this.isMouseDrag = true
            }
        }.bind(this))
        this.el.addEventListener("mousedown", function (e) {
            this.ismouseDown = true
        }.bind(this))
        document.addEventListener("keypress", function (e) {
            this.ismouseDown = false
            this.isMouseDrag = false
            this.setFocus()
        }.bind(this))

    }
    keyDownHandler(e) {
        if (event.ctrlKey && event.key === 'l' || event.key === 'L') {
            this.clearScreen()
        }
    }
    clearScreen() {
        this.historyList = []
        this.history.update(this.historyList)
    }
    setFocus() {
        if (!model.state.loggedin) {
            this.loginComponent.setFocus()
        } else {
            this.commandComponent.setFocus()
        }
    }
    authenticated() {
        model.state.loggedin = true
        setChildren(this.el, [this.intro, this.history, this.commandComponent])
    }
    addCommandOutputHistory(data) {
        this.historyList.push(data)
        this.history.update(this.historyList)
    }
    setupAuth() {
        model.state.authkey = null
        this.loginComponent = new LoginComponent(this.authenticated.bind(this))
        setChildren(this.el, [this.intro, this.loginComponent])
    }
}

async function authenticate(username, password) {
    let hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(`${username}:${password}`))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    let res = await fetch(window.location.origin + "/internal/sqlite/validateLogin", {
        headers: {
            "Authorization": `Bearer ${hashHex} `
        },
        method: "GET",
    })
    if (res.ok) {
        model.state.authkey = hashHex
    }
    return res.status == 200
}

async function executeRequest(statement, database) {
    let resp = await fetch(window.location.origin + "/internal/sqlite/execute",
        {
            headers: {
                "Authorization": `Bearer ${model.state.authkey} `
            },
            method: "POST",
            body: JSON.stringify({ statement: statement, database: database })
        })
    if (resp.status == 401) {
        return {
            status: "failed",
            reason: "unauthorized"
        }
    }
    let data = await resp.json()
    if (data.status == "success") {
        return {
            status: "success",
            data: data.data
        }
    } else {
        const errorMessagePattern = /Error::Io\("(.*)"\)/
        const match = data.reason.match(errorMessagePattern);
        let reason = match && match[1] ? match[1] : data.reason
        return {
            status: "failed",
            reason: reason
        }
    }
}

async function dumpDB() {
    let resp = await fetch(window.location.origin + "/internal/sqlite/dump",
        {
            headers: {
                "Authorization": `Bearer ${model.state.authkey} `
            },
            method: "POST",
        })

    if (resp.status == 401) {
        return {
            status: "failed",
            reason: "unauthorized"
        }
    }
    let data = await resp.json()
    if (data.status == "success") {
        return {
            status: "success",
            data: data.data
        }
    } else {
        const errorMessagePattern = /Error::Io\("(.*)"\)/
        const match = data.reason.match(errorMessagePattern);
        let reason = match[1] ? match[1] : data.reason
        return {
            status: "failed",
            reason: reason
        }
    }
}

async function init() {
    // authKey = await getAuthKey()
    let app = new App()
    mount(document.getElementById("app"), app)
    app.setFocus()
}

document.addEventListener('DOMContentLoaded', function () {
    init()
});

function downloadTextFile(text, filename) {
    // Create a Blob object with the text content and specify the MIME type
    const blob = new Blob([text], { type: 'text/plain' });

    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;

    // Trigger a click event on the anchor element to start the download
    a.click();

    // Clean up by revoking the object URL to free up resources
    URL.revokeObjectURL(a.href);
}

function jsonToHtmlTable(data, headings) {
    var html = '<table>';
    console.log(data, headings)
    // Create table header
    html += '<thead><tr>';
    headings.forEach(function (heading) {
        html += '<th>' + heading + '</th>';
    });
    html += '</tr></thead>';

    // Create table body
    html += '<tbody>';
    data.forEach(function (item) {
        html += '<tr>';
        headings.forEach(function (heading) {
            html += '<td>' + (item[heading] || '') + '</td>'; // Use an empty string if the field is missing
        });
        html += '</tr>';
    });
    html += '</tbody>';

    html += '</table>';
    return html;
}