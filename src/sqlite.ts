import { Sqlite, HttpRequest, HttpResponse } from "@fermyon/spin-sdk"
import { handleAuth } from "./utils"

async function execute(req: HttpRequest): Promise<HttpResponse> {

    if (!(await handleAuth(req.headers["authorization"]))) {
        return {
            status: 403
        }
    }
    let db = Sqlite.openDefault()
    let result = db.execute(req.text(), [])
    return {
        status: 200,
        body: JSON.stringify(result.rows, null, 2)
    }
}

export { execute }