import { HandleRequest, HttpRequest, HttpResponse, Router } from "@fermyon/spin-sdk"
import {
  handleAuth,
  returnHtml
} from "./utils"
import { dump, execute } from "./sqlite"
const router = Router()

router.post("/internal/sqlite/execute", async (_, req: HttpRequest) => { return await execute(req) })
router.get("/internal/sqlite/validateLogin", async (_, req: HttpRequest) => { return await validateLogin(req) })
router.post("/internal/sqlite/dump", async (_, req: HttpRequest) => { return await dump(req) })
router.get("*", returnHtml)

async function validateLogin(req: HttpRequest) {
  if ((await handleAuth(req.headers["authorization"]))) {
    return {
      status: 200
    }
  }
  return {
    status: 401
  }
}

export const handleRequest: HandleRequest = async function (request: HttpRequest): Promise<HttpResponse> {
  return await router.handleRequest(request, request)
}
