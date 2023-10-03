import { HandleRequest, HttpRequest, HttpResponse, Router } from "@fermyon/spin-sdk"
import {
  returnHtml
} from "./utils"
import { execute } from "./sqlite"
const router = Router()

router.post("/internal/sqlite/execute", async (_, req: HttpRequest) => { return await execute(req) })
router.get("*", returnHtml)

export const handleRequest: HandleRequest = async function (request: HttpRequest): Promise<HttpResponse> {
  return await router.handleRequest(request, request)
}
