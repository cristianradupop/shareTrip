import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { isAllowedAuthPath } from "@/lib/auth-paths";

const handlers = toNextJsHandler(auth);

function guard(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const pathname = new URL(req.url).pathname.replace(/^\/api\/auth/, "");
    if (!isAllowedAuthPath(pathname)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return handler(req);
  };
}

export const GET = guard(handlers.GET);
export const POST = guard(handlers.POST);
