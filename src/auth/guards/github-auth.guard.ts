import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GithubAuthGuard extends AuthGuard("github") {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const redirectUri = request.query?.redirect_uri as string | undefined;
    // Pass client redirect_uri as OAuth state so we can redirect back to app/mobile after login
    return redirectUri ? { state: redirectUri } : {};
  }
}
