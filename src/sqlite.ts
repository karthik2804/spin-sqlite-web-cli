import { Sqlite, HttpRequest, HttpResponse } from "@fermyon/spin-sdk"
import { handleAuth } from "./utils"

interface ExecuteRequest {
    statement: string
    database: string
}

async function execute(req: HttpRequest): Promise<HttpResponse> {

    if (!(await handleAuth(req.headers["authorization"]))) {
        return {
            status: 401
        }
    }
    let req_data = req.json() as ExecuteRequest
    let db = Sqlite.openDefault()
    let result
    try {
        result = db.execute(req_data.statement, [])
        return {
            status: 200,
            body: JSON.stringify({
                status: "success",
                data: {
                    columns: result.columns,
                    rows: result.rows
                }
            })
        }
    } catch (err) {
        //@ts-ignore
        console.log(err.message)
        return {
            status: 400,
            body: JSON.stringify({
                status: "failed",
                //@ts-ignore
                reason: err.toString()
            })
        }
    }
}

async function dump(req: HttpRequest): Promise<HttpResponse> {
    if (!(await handleAuth(req.headers["authorization"]))) {
        return {
            status: 401
        }
    }

    let response = "BEGIN TRANSACTION;\n"

    let db = Sqlite.openDefault()
    try {

        let tables = db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite%'", [])
        tables.rows.map(k => {
            // for each table get schema
            let shcema = db.execute(`SELECT sql FROM sqlite_master where name = '${k["name"]}';`, [])
            shcema.rows.map(k => {
                response += k["sql"] as string + ";\n"
            })
            let data = db.execute(`SELECT * from ${k["name"]}`, [])
            let fields = "("
            data.columns.map((k, i) => {
                if (i == 0) {
                    fields += k
                } else {
                    fields += `,${k}`
                }
            })
            fields += ")"
            data.rows.map(k => {
                let temp = ""
                data.columns.map((field, i) => {
                    if (i == 0) {
                        temp += `"${k[field]}"`
                    } else {
                        temp += `,"${k[field]}"`
                    }
                })
                response += `INSERT INTO test ${fields} VALUES (${temp});\n`
            })
        })
        response += "COMMIT;"
        response = response.replace(/CREATE TABLE/g, "CREATE TABLE IF NOT EXISTS")
        console.log(response)
        return {
            status: 200,
            body: JSON.stringify({
                status: "success",
                data: response
            })
        }
    } catch (err) {
        return {
            status: 400,
            body: JSON.stringify({
                status: "failed",
                //@ts-ignore
                reason: err.toString()
            })
        }
    }
}

export { execute, dump }