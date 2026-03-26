import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { GithubAuthGuard } from "./guards/github-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { ConfigService } from "@nestjs/config";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  /**
   * Resolve where to redirect after OAuth success.
   * Uses state (client redirect_uri) if present and allowed, otherwise default frontend.
   * For mobile: client must open backend URL with ?redirect_uri=<encoded_deep_link> and
   * ALLOWED_REDIRECT_SCHEMES must be set in production.
   */
  private getRedirectTarget(stateFromQuery: string | undefined): string {
    const envMode = this.configService.get<string>("ENV_MODE") || "dev";
    const isProduction = envMode === "prod" || envMode === "production";
    const defaultUrl = isProduction
      ? this.configService.get<string>("PROD_URL")
      : this.configService.get<string>("DEV_URL") || "http://localhost:3000";
    const defaultTarget = `${defaultUrl?.replace(/\/$/, "")}/auth/callback`;

    const raw =
      stateFromQuery && typeof stateFromQuery === "string"
        ? stateFromQuery.trim()
        : "";
    if (!raw) return defaultTarget;

    const allowedSchemes = this.configService.get<string>(
      "ALLOWED_REDIRECT_SCHEMES"
    );
    // Default matches the Capacitor app scheme in frontend/src/lib/capacitor.ts so
    // mobile OAuth works if the env var was not set on the deployed API.
    const defaultMobileScheme = "pineapplewallet";
    const schemes = [
      ...new Set(
        [
          defaultMobileScheme,
          ...(allowedSchemes
            ? allowedSchemes
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
            : []),
        ].filter(Boolean)
      ),
    ];

    try {
      const url = new URL(raw);
      // Allow https redirects to our configured frontend origins
      if (url.protocol === "https:" || url.protocol === "http:") {
        const prod = (this.configService.get<string>("PROD_URL") || "").replace(
          /\/$/,
          ""
        );
        const dev = (this.configService.get<string>("DEV_URL") || "").replace(
          /\/$/,
          ""
        );
        if (prod && raw.startsWith(prod)) return raw;
        if (dev && raw.startsWith(dev)) return raw;
      }
      // Allow custom URL schemes (e.g. pineapplewallet://auth/callback)
      if (url.protocol.endsWith(":")) {
        const scheme = url.protocol.slice(0, -1).toLowerCase();
        if (schemes.includes(scheme)) return raw;
      }
    } catch {
      // Invalid URL, use default
    }
    return defaultTarget;
  }

  @Post("register")
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: any, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtRefreshGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any) {
    return this.authService.refreshTokens(req.user.sub, req.user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
    @Body("refreshToken") refreshToken?: string
  ) {
    await this.authService.logout(user.sub, refreshToken);
    return { message: "Logged out successfully" };
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.login(req.user);
    const redirectTarget = this.getRedirectTarget(
      req.query?.state as string | undefined
    );
    const separator = redirectTarget.includes("?") ? "&" : "?";
    res.redirect(
      `${redirectTarget}${separator}accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
    );
  }

  @Get("github")
  @UseGuards(GithubAuthGuard)
  async githubAuth() {
    // Guard redirects to GitHub
  }

  @Get("github/callback")
  @UseGuards(GithubAuthGuard)
  async githubAuthCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.login(req.user);
    const redirectTarget = this.getRedirectTarget(
      req.query?.state as string | undefined
    );
    const separator = redirectTarget.includes("?") ? "&" : "?";
    res.redirect(
      `${redirectTarget}${separator}accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}
